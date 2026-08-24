/* Eager shell: only what paints above the fold on every route — routing,
 * sidebar, and the chrome primitives they slot. Everything else is defined
 * lazily by soci-loader.js: per-route packs load when a route activates
 * (soci-route awaits routeReady before dispatching routeactivate), modal
 * packs load when a modal opens, and the remainder warms up after the page
 * is idle. Keep this list lean — every import here gates first paint. */
import { warmup } from './soci-loader.js'

import SociRoute from "./soci-route.js"
window.customElements.define('soci-route', SociRoute)

import SociIcon from "./soci-icon.js"
window.customElements.define('soci-icon', SociIcon)

import SociLink from "./soci-link.js"
window.customElements.define('soci-link', SociLink)

import SociButton from "./soci-button.js"
window.customElements.define('soci-button', SociButton)

import SociUser from "./soci-user.js"
window.customElements.define('soci-user', SociUser)

import SociModal from "./soci-modal.js"
window.customElements.define('soci-modal', SociModal)

import SociNotificationBadge from "./soci-notification-badge.js"
window.customElements.define('soci-notification-badge', SociNotificationBadge)

import {SociSelect, SociOption} from "./soci-select.js"
window.customElements.define('soci-select', SociSelect)
window.customElements.define('soci-option', SociOption)

import SociTagLi from "./soci-tag-li.js"
window.customElements.define('soci-tag-li', SociTagLi)

import SociSidebar from "./soci-sidebar.js"
window.customElements.define('soci-sidebar', SociSidebar)

import SociSidebarSwitcher from "./soci-sidebar-switcher.js"
window.customElements.define('soci-sidebar-switcher', SociSidebarSwitcher)

import {SociSidebarPanel, SociSidebarCommunityPanel, SociSidebarUserPanel} from "./soci-sidebar-panel.js"
window.customElements.define('soci-sidebar-panel', SociSidebarPanel)
window.customElements.define('soci-sidebar-community-panel', SociSidebarCommunityPanel)
window.customElements.define('soci-sidebar-user-panel', SociSidebarUserPanel)

import "./modals/soci-modal-manager.js"

// Routes upgrade on the define above; instantiating the router activates the
// current route, whose activate() kicks off its lazy pack immediately.
import SociRouter from "./soci-router.js"
window.sociRouter = new SociRouter()

warmup()
