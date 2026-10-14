/* Lazy custom-element loader.
 *
 * soci-components.js used to statically import all ~65 modules (~500 KB raw),
 * and ES module semantics meant nothing executed until the slowest import
 * arrived — every route paid for the whole graph before first paint. Now only
 * the shell (sidebar, routing, chrome) is eager; everything else is defined
 * on demand from this registry.
 *
 * Elements upgrade in place when their definition lands, so route DOM can
 * attach before its modules arrive. soci-route delays `routeactivate` (where
 * page scripts call component methods) until routeReady() resolves, which
 * keeps upgrade timing invisible to page code. A failed import resolves
 * anyway (the route still activates) and is retried on the next request.
 */

// element name -> module path. Modules here export the class as default.
export const REGISTRY = {
  'soci-avatar-uploader': './soci-avatar-uploader.js',
  'soci-banner': './soci-banner.js',
  'soci-comment': './soci-comment.js',
  'soci-comment-list': './soci-comment-list.js',
  'soci-contribution-slider': './soci-contribution-slider.js',
  'soci-emoji': './soci-emoji.js',
  'soci-encoding-progress': './soci-encoding-progress.js',
  'soci-html-page': './soci-html-page.js',
  'soci-html-uploader': './soci-html-uploader.js',
  'soci-image': './soci-image.js',
  'soci-image-uploader': './soci-image-uploader.js',
  'soci-input': './soci-input.js',
  'soci-ledger': './soci-ledger.js',
  'soci-ledger-li': './soci-ledger-li.js',
  'soci-ledger-month': './soci-ledger-month.js',
  'soci-link-input': './soci-link-input.js',
  'soci-markdown-view': './soci-markdown-view.js',
  'soci-message-row': './soci-message-row.js',
  'soci-password': './soci-password.js',
  'soci-post': './soci-post.js',
  'soci-post-card': './soci-post-card.js',
  'soci-post-li': './soci-post-li.js',
  'soci-post-list': './soci-post-list.js',
  'soci-radial-progress': './soci-radial-progress.js',
  'soci-radio-button': './soci-radio-button.js',
  'soci-radio-button-group': './soci-radio-button-group.js',
  'soci-tab': './soci-tab.js',
  'soci-tab-group': './soci-tab-group.js',
  'soci-tag': './soci-tag.js',
  'soci-tag-group': './soci-tag-group.js',
  'soci-text-channel-li': './soci-text-channel-li.js',
  'soci-text-channel-view': './soci-text-channel-view-threaded.js',
  'soci-url-input': './soci-url-input.js',
  'soci-user-comment': './soci-user-comment.js',
  'soci-user-comment-list': './soci-user-comment-list.js',
  'soci-user-picker': './soci-user-picker.js',
  'soci-username-input': './soci-username-input.js',
  'soci-video': './soci-video.js',
  'soci-video-uploader': './soci-video-uploader.js',
  'soci-voice-channel-li': './soci-voice-channel-li.js',
  'soci-login-modal': './modals/soci-login-modal.js',
  'soci-create-account-modal': './modals/soci-create-account-modal.js',
  'soci-create-community-modal': './modals/soci-create-community-modal.js',
  'soci-create-channel-modal': './modals/soci-create-channel-modal.js',
  'soci-image-viewer-modal': './modals/soci-image-viewer-modal.js'
}

// Shared element groups, composed into per-route packs below.
const FEED = ['soci-post-list', 'soci-post-li', 'soci-post-card', 'soci-tag-group', 'soci-tag', 'soci-markdown-view', 'soci-emoji', 'soci-radio-button', 'soci-radio-button-group']
const COMMENTS = ['soci-comment', 'soci-comment-list', 'soci-input', 'soci-markdown-view', 'soci-emoji']
const USER_COMMENTS = ['soci-user-comment-list', 'soci-user-comment', ...COMMENTS]

// route id (soci-route#id in index.pug) -> elements it needs to paint.
export const PACKS = {
  'tags': FEED,
  'post': ['soci-post', 'soci-tag-group', 'soci-tag', 'soci-video', 'soci-image', 'soci-html-page', 'soci-encoding-progress', 'soci-radial-progress', ...COMMENTS],
  'user': [...FEED, ...USER_COMMENTS],
  'notifications': USER_COMMENTS,
  'submit': ['soci-url-input', 'soci-tab', 'soci-tab-group', 'soci-link-input', 'soci-image-uploader', 'soci-video-uploader', 'soci-html-uploader', 'soci-encoding-progress', 'soci-radial-progress', 'soci-input', 'soci-emoji', 'soci-post-li', 'soci-tag-group', 'soci-tag', 'soci-markdown-view'],
  'text-channel': ['soci-text-channel-view', 'soci-message-row', 'soci-input', 'soci-emoji', 'soci-markdown-view', 'soci-image'],
  'admin-create': [],
  'admin-subscribe': ['soci-contribution-slider'],
  'admin-forgot-password': [],
  'admin-change-forgotten-password': ['soci-password'],
  'admin-settings': ['soci-avatar-uploader', 'soci-password', 'soci-input', 'soci-emoji'],
  'admin-financials': ['soci-ledger', 'soci-ledger-month', 'soci-ledger-li', 'soci-banner', 'soci-input', 'soci-emoji'],
  'admin-emojis': ['soci-emoji'],
  'about': [],
  'privacy-policy': [],
  'contact': [],
  'community-settings': ['soci-avatar-uploader', 'soci-input', 'soci-emoji', 'soci-radio-button-group', 'soci-radio-button'],
  'community-users': ['soci-user-picker'],
  'community-financials': [],
  'community-emojis': ['soci-emoji']
}

// modal name (soci-modal-manager registry) -> elements the modal mounts.
export const MODAL_PACKS = {
  login: ['soci-login-modal', 'soci-password'],
  createAccount: ['soci-create-account-modal', 'soci-username-input', 'soci-password'],
  createCommunity: ['soci-create-community-modal'],
  createChannel: ['soci-create-channel-modal', 'soci-radio-button-group', 'soci-radio-button'],
  imageViewer: ['soci-image-viewer-modal']
}

const pending = new Map()

function load(name) {
  if (customElements.get(name)) return Promise.resolve()
  const path = REGISTRY[name]
  if (!path) return Promise.resolve()
  if (pending.has(name)) return pending.get(name)

  const p = import(path)
    .then(m => {
      if (!customElements.get(name)) customElements.define(name, m.default)
    })
    .catch(err => {
      // Resolve so routes still activate; forget the attempt so a later
      // ensure() retries instead of caching the failure forever.
      pending.delete(name)
      console.warn(`soci-loader: failed to load <${name}>`, err)
    })
  pending.set(name, p)
  return p
}

export function ensure(names) {
  return Promise.all((names || []).map(load))
}

export function routeReady(routeId) {
  return ensure(PACKS[routeId])
}

// Warm the rest of the registry once the page is idle, so later SPA
// navigations find their definitions already local. Sequential on purpose:
// a burst of 40 imports would compete with lazy-loading feed media.
export function warmup() {
  if (navigator.connection?.saveData) return
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 2000))
  const run = async () => {
    for (const name of Object.keys(REGISTRY)) await load(name)
  }
  if (document.readyState === 'complete') idle(run)
  else window.addEventListener('load', () => idle(run), { once: true })
}
