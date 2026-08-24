// Adapted from soci-backend/httpd/middleware/gzip.go (stdlib-only); kept as a
// copy so this CDN stays buildable as a standalone module.
package util

import (
	"bufio"
	"compress/gzip"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
)

// gzipMinSize is the smallest body worth compressing. Below roughly this size
// the gzip header and trailer cost more than the compression saves, and most of
// the API's small acknowledgement responses fall in that range.
const gzipMinSize = 512

var gzipPool = sync.Pool{
	New: func() interface{} {
		w, _ := gzip.NewWriterLevel(nil, gzip.DefaultCompression)
		return w
	},
}

// Gzip compresses JSON and text responses for clients that ask for it.
//
// The API's feed payloads are the largest thing a client downloads during an
// in-app navigation and they are highly compressible JSON, so on a slow
// connection the uncompressed transfer sits directly on the critical path
// between the click and the destination rendering.
//
// Requests that are upgrading to a WebSocket are passed straight through: those
// handlers hijack the connection, and wrapping the writer would break them.
func Gzip(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !clientAcceptsGzip(r) || isWebSocketUpgrade(r) {
			next(w, r)
			return
		}

		// Vary is set unconditionally on eligible requests so shared caches key
		// on the encoding even when this particular body ends up uncompressed.
		w.Header().Add("Vary", "Accept-Encoding")

		gw := &gzipResponseWriter{ResponseWriter: w, status: http.StatusOK}
		defer gw.finish()
		next(gw, r)
	}
}

func clientAcceptsGzip(r *http.Request) bool {
	for _, enc := range strings.Split(r.Header.Get("Accept-Encoding"), ",") {
		// Strip any q-value; we only care that gzip is listed at all.
		if name, _, _ := strings.Cut(strings.TrimSpace(enc), ";"); strings.EqualFold(name, "gzip") {
			return true
		}
	}
	return false
}

func isWebSocketUpgrade(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket") ||
		strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade")
}

// gzipResponseWriter holds the first bytes of the body back until it knows
// whether compressing is worthwhile, so the decision can depend on both the
// content type the handler chose and the size it actually wrote.
type gzipResponseWriter struct {
	http.ResponseWriter
	gz      *gzip.Writer
	buf     []byte
	status  int
	decided bool
	headed  bool
}

func (g *gzipResponseWriter) WriteHeader(status int) {
	// Held back so headers can still be adjusted once the body size is known.
	g.status = status
}

func (g *gzipResponseWriter) Write(p []byte) (int, error) {
	if g.decided {
		if g.gz != nil {
			return g.gz.Write(p)
		}
		return g.ResponseWriter.Write(p)
	}

	g.buf = append(g.buf, p...)
	if len(g.buf) >= gzipMinSize {
		g.decide(compressibleContentType(g.Header().Get("Content-Type")))
	}
	return len(p), nil
}

// decide commits to an encoding, emits the header and flushes whatever body has
// been buffered so far.
func (g *gzipResponseWriter) decide(compress bool) {
	g.decided = true

	if compress {
		g.Header().Set("Content-Encoding", "gzip")
		// The buffered length is the uncompressed length, so it must not be
		// advertised; Go will chunk the response instead.
		g.Header().Del("Content-Length")
		gz := gzipPool.Get().(*gzip.Writer)
		gz.Reset(g.ResponseWriter)
		g.gz = gz
	}

	g.writeHeaderOnce()

	if len(g.buf) > 0 {
		if g.gz != nil {
			g.gz.Write(g.buf)
		} else {
			g.ResponseWriter.Write(g.buf)
		}
		g.buf = nil
	}
}

func (g *gzipResponseWriter) writeHeaderOnce() {
	if g.headed {
		return
	}
	g.headed = true
	g.ResponseWriter.WriteHeader(g.status)
}

// finish flushes a body that never reached gzipMinSize, and closes the gzip
// stream so its trailer is written.
func (g *gzipResponseWriter) finish() {
	if !g.decided {
		g.decide(false)
	}
	if g.gz != nil {
		g.gz.Close()
		gzipPool.Put(g.gz)
		g.gz = nil
	}
}

func (g *gzipResponseWriter) Flush() {
	if !g.decided {
		g.decide(compressibleContentType(g.Header().Get("Content-Type")))
	}
	if g.gz != nil {
		g.gz.Flush()
	}
	if f, ok := g.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Hijack passes through so that any handler taking over the connection still
// can, even though upgrade requests already skip this middleware.
func (g *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := g.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("gzip: underlying ResponseWriter is not a http.Hijacker")
	}
	g.decided = true
	g.headed = true
	g.buf = nil
	return h.Hijack()
}

func compressibleContentType(ct string) bool {
	mediaType, _, _ := strings.Cut(ct, ";")
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))
	if strings.HasPrefix(mediaType, "text/") {
		return true
	}
	switch mediaType {
	case "application/json", "application/javascript", "application/xml", "image/svg+xml":
		return true
	}
	return false
}
