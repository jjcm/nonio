import config from './config.js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

var http = require('http')
var fs = require('fs')
var path = require('path')
var pug = require('pug')
var url = require('url')
var mime = require('mime-types')
var prerender = require('prerender-node')
var zlib = require('zlib')
var crypto = require('crypto')

// Asset filenames are not content-hashed (/soci.js is always /soci.js), so this
// has to stay short enough that a deploy is picked up promptly. The win comes
// from revalidating into a 304 rather than from a long TTL, so there is no
// reason to reach for `immutable` here.
var STATIC_MAX_AGE = 300
var COMPRESSIBLE = /^(?:text\/|application\/(?:javascript|json|xml)$|image\/svg\+xml$)/
var MIN_GZIP_SIZE = 512

// Re-compressing the same asset for every request is the expensive part, not
// the compression itself, so results are keyed by path + ETag and computed once.
var gzipCache = new Map()

function gzipFor(key, buf){
  var hit = gzipCache.get(key)
  if(hit) return hit
  var out = zlib.gzipSync(buf)
  if(gzipCache.size > 512) gzipCache.clear()
  gzipCache.set(key, out)
  return out
}

// Send a body with an ETag, so a repeat visit revalidates into a 304 instead of
// downloading it again, and gzip it when that is worth doing.
function send(req, res, body, mimetype, etag, cacheControl){
  var headers = { 'Cache-Control': cacheControl }
  if(mimetype) headers['Content-Type'] = mimetype

  if(etag){
    headers.ETag = etag
    if(req.headers['if-none-match'] === etag){
      res.writeHead(304, headers)
      res.end()
      return
    }
  }

  if(COMPRESSIBLE.test(mimetype || '')){
    headers.Vary = 'Accept-Encoding'
    if(/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length >= MIN_GZIP_SIZE){
      body = gzipFor(req.url + '|' + etag, body)
      headers['Content-Encoding'] = 'gzip'
    }
  }

  headers['Content-Length'] = body.length
  res.writeHead(200, headers)
  res.end(body)
}

// The app shell renders identical output for every request but costs ~30ms to
// compile, and that lands on every cold document load and on every SPA deep
// link. Render it once and reuse.
//
// Editing a template still takes effect without a restart: pug reports the
// includes it pulled in, so the cache is validated by stat-ing the entry
// template plus its dependencies. That is ~20 stats, far cheaper than a
// recompile, and unlike a filesystem watcher it cannot silently miss a change.
var pugCache = new Map()

// The ES module graph is ~68 files at depth 2-3: the browser discovers
// components only after soci-components.js arrives, and lib helpers one hop
// later. Emitting <link rel="modulepreload"> for the whole graph lets the
// first response fetch everything in parallel over h2 instead of paying one
// RTT per depth level. Crawled once per process; deploys restart the server.
var moduleGraph = (function(){
  var seen = new Set()
  var IMPORT_RE = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g
  function crawl(url){
    if(seen.has(url)) return
    seen.add(url)
    var src
    try { src = fs.readFileSync('.' + url, 'utf-8') } catch(e) { return }
    var m
    while((m = IMPORT_RE.exec(src))){
      var spec = m[1] || m[2]
      if(!spec) continue
      if(spec.startsWith('.')) crawl(path.posix.normalize(path.posix.join(path.posix.dirname(url), spec)))
      else if(spec.startsWith('/')) crawl(spec)
    }
  }
  crawl('/soci.js')
  crawl('/components/soci-components.js')
  return Array.from(seen)
})()

function newestMtime(files){
  var newest = 0
  for(var i = 0; i < files.length; i++){
    try {
      var m = fs.statSync(files[i]).mtimeMs
      if(m > newest) newest = m
    } catch(e) {
      // A deleted include should force a recompile so pug reports the error.
      return Infinity
    }
  }
  return newest
}

function renderPug(file){
  var hit = pugCache.get(file)
  if(hit && newestMtime(hit.files) <= hit.mtime) return hit

  var fn = pug.compileFile(file)
  var files = [file].concat(fn.dependencies || [])
  var html = fn({ preloadModules: moduleGraph })
  var entry = {
    body: Buffer.from(html, 'utf-8'),
    etag: '"' + crypto.createHash('md5').update(html).digest('hex') + '"',
    files: files,
    mtime: newestMtime(files)
  }
  pugCache.set(file, entry)
  return entry
}


var server = http.createServer(function (req, res) {

  var sociServer = () => {
      var ext = path.extname(req.url)
      if(fs.existsSync('.' + req.url)) {
        switch(ext){
          case '.pug':
            handler.pug(req,res)
            break
          case '':
            handler.folder(req, res)
            break
          default:
            handler.file(req, res)
            break
        }
      }
      else {
        console.log(req.method + ' | ' + 'PATH   | ' + req.url)
        let cached = renderPug('index.pug')
        // no-cache still allows a 304, so the shell is revalidated on every
        // visit (a deploy is picked up immediately) without resending 30KB.
        send(req, res, cached.body, 'text/html', cached.etag, 'no-cache')
      }
  }

  sociServer()
  return 0

  if(config.PRERENDER_HOST){
    //console.log(`Showing prerendered page: ${prerender.shouldShowPrerenderedPage(req)}`)
    if(prerender.shouldShowPrerenderedPage(req)) {
      console.log(prerender.getPrerenderedPageResponse(req, res => {
        console.log(res)
      }))
    }
    prerender.set("prerenderServiceUrl", config.PRERENDER_HOST)
    console.log(req.headers['user-agent'])
    prerender(req, res, sociServer)
  }
  else sociServer()
})

var sss = function(req) {
  var userAgent = req.headers['user-agent']
    , bufferAgent = req.headers['x-bufferbot']
    , isRequestingPrerenderedPage = false;

  if(!userAgent) return false;
  if(req.method != 'GET' && req.method != 'HEAD') return false;
  if(req.headers && req.headers['x-prerender']) return false;

  console.log('basic checks passed')

  //if it contains _escaped_fragment_, show prerendered page
  var parsedQuery = url.parse(req.url, true).query;
  if(parsedQuery && parsedQuery['_escaped_fragment_'] !== undefined) isRequestingPrerenderedPage = true;

  //if it is a bot...show prerendered page
  if(prerender.crawlerUserAgents.some(function(crawlerUserAgent){ return userAgent.toLowerCase().indexOf(crawlerUserAgent.toLowerCase()) !== -1;})) isRequestingPrerenderedPage = true;
  console.log(`it was a crawler? ${isRequestingPrerenderedPage}`)

  //if it is BufferBot...show prerendered page
  if(bufferAgent) isRequestingPrerenderedPage = true;

  console.log('almost there')
  //if it is a bot and is requesting a resource...dont prerender
  if(prerender.extensionsToIgnore.some(function(extension){return req.url.toLowerCase().indexOf(extension) !== -1;})) return false;

  console.log('almost there 2')
  //if it is a bot and not requesting a resource and is not whitelisted...dont prerender
  if(Array.isArray(prerender.whitelist) && prerender.whitelist.every(function(whitelisted){return (new RegExp(whitelisted)).test(req.url) === false;})) return false;

  //if it is a bot and not requesting a resource and is not blacklisted(url or referer)...dont prerender
  console.log('almost there 3')
  if(Array.isArray(prerender.blacklist) && prerender.blacklist.some(function(blacklisted){
    var blacklistedUrl = false
      , blacklistedReferer = false
      , regex = new RegExp(blacklisted);

    blacklistedUrl = regex.test(req.url) === true;
    if(req.headers['referer']) blacklistedReferer = regex.test(req.headers['referer']) === true;

    return blacklistedUrl || blacklistedReferer;
  })) return false;

  return isRequestingPrerenderedPage;
}

var handler = {
  error: function(req, res, err){
    res.writeHead(404, { 'Content-Type' : 'text/html' })
    res.end(err.message, 'utf-8')
    console.log(err)
  },
  pug: function(req, res){
    var filePath = '.' + req.url
    console.log(req.method + ' | ' + 'PUG    | ' + req.url)
    fs.readFile(filePath, 'utf8', (err, data) => {
      if(err){
        handler.error(req, res, err)
      }
      else {
        var html = pug.render(data, {doctype: 'html'})
        res.writeHead(200, { 'Content-Type' : 'text/html' })
        res.end(html, 'utf-8')
      }
    })
  },
  folder: function(req, res){
    var html = 'no index found'
    var filePath = '.' + req.url
    console.log(req.method + ' | ' + 'FOLDER | ' + req.url)
    fs.readdir(filePath, function(err, files){
      if(err) {
        console.log(err)
        res.writeHead(200, { 'Content-Type' : 'text/html' })
        res.end(err.toString(), 'utf-8')
        return 0
      }
      if(files.indexOf('index.pug') != -1){
        if(!filePath.match(/\/$/)) filePath += '/'

        // This is the path that serves "/", i.e. the app shell for every cold
        // visit to the homepage.
        var cached = renderPug(filePath + 'index.pug')
        send(req, res, cached.body, 'text/html', cached.etag, 'no-cache')
        return 0
      }
      else {
        res.writeHead(200, { 'Content-Type' : 'text/html' })
        html = '<h1>Directory Listing</h1><ul>'
        for(var i = 0; i < files.length; i++){
          var path = req.url + files[i]
          html += '<li><a href="' + path + '">' + files[i] + '</a></li>'
        }
      }
      res.end(html, 'utf-8')
    })
  },
  file: function(req, res){
    console.log(req.method + ' | ' + 'FILE   | ' + req.url)
    var mimetype = mime.lookup(req.url)
    if(mimetype == 'video/mp4' && req.headers.range){
      var file = req.url
      var range = req.headers.range
      var positions = range.replace(/bytes=/, "").split("-")
      var start = parseInt(positions[0], 10)

      fs.stat(file, function(err, stats) {
        var total = stats.size
        var end = positions[1] ? parseInt(positions[1], 10) : total - 1
        var chunksize = (end - start) + 1

        res.writeHead(206, {
          "Content-Range": "bytes " + start + "-" + end + "/" + total,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4"
        });

        var stream = fs.createReadStream(file, { start: start, end: end })
          .on("open", function() {
            stream.pipe(res)
          }).on("error", function(err) {
            res.end(err)
          })
      })
    }
    else {
      var filePath = '.' + req.url
      fs.stat(filePath, function(statErr, stats){
        if(statErr || !stats.isFile()){
          res.writeHead(404,{"Content-type":"text/plain"})
          res.end("Sorry the page was not found")
          return
        }
        // size + mtime, the same shape nginx uses. Cheap, and it changes
        // whenever the file does, so no hashing of large assets is needed.
        var etag = '"' + stats.size.toString(16) + '-' + stats.mtimeMs.toString(16) + '"'
        if(req.headers['if-none-match'] === etag){
          res.writeHead(304, { 'ETag': etag, 'Cache-Control': 'public, max-age=' + STATIC_MAX_AGE })
          res.end()
          return
        }
        fs.readFile(filePath, function(err, data){
          if(err){
            res.writeHead(404,{"Content-type":"text/plain"})
            res.end("Sorry the page was not found")
          }
          else {
            send(req, res, data, mimetype || undefined, etag, 'public, max-age=' + STATIC_MAX_AGE)
          }
        })
      })
    }
  }
}

var port = process.env.PORT || config.PORT
server.listen(port)
console.log(`listening on ${port}`)
console.log('-----------------')
