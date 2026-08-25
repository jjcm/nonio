const MIN_EMOJI_NAME_LENGTH = 2
const MAX_TOKEN_NAME_LENGTH = 32

function isWordChar(ch) {
  return !!ch && /[A-Za-z0-9_]/.test(ch)
}

function isEmojiNameChar(ch) {
  return !!ch && /[a-z0-9_]/.test(ch)
}

function isMentionNameChar(ch) {
  return !!ch && /[A-Za-z0-9_]/.test(ch)
}

export function scanRichTextTokens(text, options = {}) {
  const source = typeof text === 'string' ? text : String(text || '')
  const enableEmoji = options.emoji !== false
  const enableMentions = options.mentions !== false
  const parts = []
  let cursor = 0
  let i = 0

  const pushText = (end) => {
    if (end > cursor) parts.push({ type: 'text', text: source.slice(cursor, end) })
    cursor = end
  }

  while (i < source.length) {
    const ch = source[i]

    if (enableEmoji && ch === ':') {
      let j = i + 1
      while (j < source.length && isEmojiNameChar(source[j]) && (j - i - 1) <= MAX_TOKEN_NAME_LENGTH) j++
      const name = source.slice(i + 1, j)
      if (
        name.length >= MIN_EMOJI_NAME_LENGTH &&
        name.length <= MAX_TOKEN_NAME_LENGTH &&
        source[j] === ':'
      ) {
        pushText(i)
        parts.push({
          type: 'emoji',
          name,
          text: `:${name}:`,
        })
        i = j + 1
        cursor = i
        continue
      }
    }

    if (enableMentions && ch === '@') {
      const prev = i > 0 ? source[i - 1] : ''
      if (!isWordChar(prev)) {
        let j = i + 1
        while (j < source.length && isMentionNameChar(source[j]) && (j - i - 1) <= MAX_TOKEN_NAME_LENGTH) j++
        const username = source.slice(i + 1, j)
        if (username.length >= MIN_EMOJI_NAME_LENGTH && username.length <= MAX_TOKEN_NAME_LENGTH) {
          pushText(i)
          parts.push({
            type: 'mention',
            username,
            text: `@${username}`,
          })
          i = j
          cursor = i
          continue
        }
      }
    }

    i++
  }

  pushText(source.length)
  return parts
}

export function decorateTextNode(node, options = {}) {
  if (!node || !node.parentNode || !node.nodeValue) return false
  const parts = scanRichTextTokens(node.nodeValue, options)
  if (!parts.some((part) => part.type !== 'text')) return false

  const doc = node.ownerDocument
  const frag = doc.createDocumentFragment()
  const mentionHref = options.mentionHref || ((username) => `/user/${encodeURIComponent(username)}`)

  parts.forEach((part) => {
    if (part.type === 'text') {
      frag.appendChild(doc.createTextNode(part.text))
      return
    }
    if (part.type === 'emoji') {
      const emoji = doc.createElement('nonio-emoji')
      emoji.dataset.emojiName = part.name
      emoji.setAttribute('name', part.name)
      frag.appendChild(emoji)
      return
    }
    const link = doc.createElement('a')
    link.className = 'mention'
    link.href = mentionHref(part.username)
    link.textContent = part.text
    frag.appendChild(link)
  })

  node.replaceWith(frag)
  return true
}

export function decorateRichTextElement(root, options = {}) {
  if (!root) return
  const skipSelector = options.skipSelector || 'pre, code, a, script, style, textarea, input, button'
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  let node = walker.nextNode()
  while (node) {
    const parent = node.parentElement
    if (
      parent &&
      !parent.closest(skipSelector) &&
      node.nodeValue &&
      (node.nodeValue.includes(':') || node.nodeValue.includes('@'))
    ) {
      nodes.push(node)
    }
    node = walker.nextNode()
  }
  nodes.forEach((textNode) => decorateTextNode(textNode, options))
}

export function getActiveTokenQuery(text, caretOffset) {
  const safeText = typeof text === 'string' ? text : String(text || '')
  const offset = Math.max(0, Math.min(Number.isFinite(caretOffset) ? caretOffset : safeText.length, safeText.length))
  const prefix = safeText.slice(0, offset)

  const mentionMatch = prefix.match(/(?:^|[\s([{\n])@([A-Za-z0-9_]*)$/)
  const emojiMatch = prefix.match(/(?:^|[\s([{\n]):([a-z0-9_]*)$/)

  const mentionToken = mentionMatch ? {
    type: 'mention',
    query: mentionMatch[1] || '',
    start: prefix.length - (mentionMatch[1] || '').length - 1,
    end: offset,
  } : null

  const emojiToken = emojiMatch ? {
    type: 'emoji',
    query: emojiMatch[1] || '',
    start: prefix.length - (emojiMatch[1] || '').length - 1,
    end: offset,
  } : null

  if (!mentionToken && !emojiToken) return null
  if (!mentionToken) return emojiToken
  if (!emojiToken) return mentionToken
  return mentionToken.start > emojiToken.start ? mentionToken : emojiToken
}
