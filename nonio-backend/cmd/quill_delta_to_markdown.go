package main

import (
	"encoding/json"
	"strings"
)

type quillDelta struct {
	Ops []quillOp `json:"ops"`
}

type quillOp struct {
	Insert     interface{}            `json:"insert"`
	Attributes map[string]interface{} `json:"attributes"`
}

func looksLikeQuillDelta(s string) bool {
	t := strings.TrimSpace(s)
	return strings.HasPrefix(t, "{") && strings.Contains(t, "\"ops\"")
}

func quillDeltaJSONToMarkdown(s string) (string, bool) {
	var d quillDelta
	if err := json.Unmarshal([]byte(s), &d); err != nil {
		return "", false
	}
	return deltaToMarkdown(d), true
}

func deltaToMarkdown(d quillDelta) string {
	var out []string
	var line strings.Builder
	inCodeBlock := false

	flushLine := func(attrs map[string]interface{}) {
		text := strings.TrimRight(line.String(), " ")
		line.Reset()

		header := intAttr(attrs, "header", 0)
		list := strAttr(attrs, "list", "")
		indent := intAttr(attrs, "indent", 0)
		codeBlock := boolAttr(attrs, "code-block")

		if inCodeBlock && !codeBlock {
			out = append(out, "```")
			inCodeBlock = false
		}

		if codeBlock {
			if !inCodeBlock {
				out = append(out, "```")
				inCodeBlock = true
			}
			out = append(out, text)
			return
		}

		if header > 0 {
			if header > 6 {
				header = 6
			}
			out = append(out, strings.Repeat("#", header)+" "+text)
			out = append(out, "")
			return
		}

		if list != "" {
			pad := strings.Repeat("  ", clamp(indent, 0, 12))
			bullet := "- "
			if list == "ordered" {
				bullet = "1. "
			}
			out = append(out, pad+bullet+text)
			return
		}

		out = append(out, text)
		out = append(out, "")
	}

	for _, op := range d.Ops {
		attrs := op.Attributes

		switch ins := op.Insert.(type) {
		case string:
			if ins == "\n" {
				flushLine(attrs)
				continue
			}

			parts := strings.Split(ins, "\n")
			for i, part := range parts {
				chunk := escapeMarkdownText(part)
				chunk = applyInlineAttrs(chunk, attrs)
				line.WriteString(chunk)
				if i < len(parts)-1 {
					flushLine(nil)
				}
			}
		case map[string]interface{}:
			if img, ok := ins["image"].(string); ok && img != "" {
				line.WriteString("![](" + img + ")")
			}
		}
	}

	if inCodeBlock {
		out = append(out, "```")
		inCodeBlock = false
	}

	res := strings.TrimRight(strings.Join(out, "\n"), "\n")
	return strings.TrimSpace(res)
}

func applyInlineAttrs(text string, attrs map[string]interface{}) string {
	if attrs == nil || text == "" {
		return text
	}

	if link, ok := attrs["link"].(string); ok && link != "" {
		text = "[" + text + "](" + link + ")"
	}
	if boolAttr(attrs, "code") {
		text = "`" + strings.ReplaceAll(text, "`", "\\`") + "`"
	}
	if boolAttr(attrs, "strike") {
		text = "~~" + text + "~~"
	}
	if boolAttr(attrs, "italic") {
		text = "*" + text + "*"
	}
	if boolAttr(attrs, "bold") {
		text = "**" + text + "**"
	}

	return text
}

func escapeMarkdownText(s string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"`", "\\`",
		"*", "\\*",
		"_", "\\_",
		"{", "\\{",
		"}", "\\}",
		"[", "\\[",
		"]", "\\]",
		"(", "\\(",
		")", "\\)",
		"#", "\\#",
		"+", "\\+",
		"-", "\\-",
		".", "\\.",
		"!", "\\!",
		">", "\\>",
	)
	return replacer.Replace(s)
}

func boolAttr(attrs map[string]interface{}, key string) bool {
	if attrs == nil {
		return false
	}
	v, ok := attrs[key]
	if !ok || v == nil {
		return false
	}
	switch vv := v.(type) {
	case bool:
		return vv
	case float64:
		return vv != 0
	case int:
		return vv != 0
	case string:
		return vv != "" && vv != "0" && vv != "false"
	default:
		return false
	}
}

func strAttr(attrs map[string]interface{}, key, def string) string {
	if attrs == nil {
		return def
	}
	if v, ok := attrs[key]; ok {
		if s, ok := v.(string); ok && s != "" {
			return s
		}
	}
	return def
}

func intAttr(attrs map[string]interface{}, key string, def int) int {
	if attrs == nil {
		return def
	}
	if v, ok := attrs[key]; ok && v != nil {
		switch vv := v.(type) {
		case float64:
			return int(vv)
		case int:
			return vv
		case int64:
			return int(vv)
		}
	}
	return def
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}


