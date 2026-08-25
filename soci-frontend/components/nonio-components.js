import NonioComponent from './nonio-component.js'

import NonioRoute from "./nonio-route.js"
window.customElements.define('nonio-route', NonioRoute)

import NonioRouter from "./nonio-router.js"
window.nonioRouter = new NonioRouter()

import NonioAvatarUploader from "./nonio-avatar-uploader.js"
window.customElements.define('nonio-avatar-uploader', NonioAvatarUploader)

import NonioBanner from "./nonio-banner.js"
window.customElements.define('nonio-banner', NonioBanner)

import NonioButton from "./nonio-button.js"
window.customElements.define('nonio-button', NonioButton)

import NonioComment from "./nonio-comment.js"
window.customElements.define('nonio-comment', NonioComment)

import NonioContributionSlider from "./nonio-contribution-slider.js"
window.customElements.define('nonio-contribution-slider', NonioContributionSlider)

import NonioCommentList from "./nonio-comment-list.js"
window.customElements.define('nonio-comment-list', NonioCommentList)

import NonioHTMLPage from "./nonio-html-page.js"
window.customElements.define('nonio-html-page', NonioHTMLPage)

import NonioHTMLUploader from "./nonio-html-uploader.js"
window.customElements.define('nonio-html-uploader', NonioHTMLUploader)

import NonioIcon from "./nonio-icon.js"
window.customElements.define('nonio-icon', NonioIcon)

import NonioEmoji from "./nonio-emoji.js"
window.customElements.define('nonio-emoji', NonioEmoji)

import NonioImage from "./nonio-image.js"
window.customElements.define('nonio-image', NonioImage)

import NonioImageUploader from "./nonio-image-uploader.js"
window.customElements.define('nonio-image-uploader', NonioImageUploader)

import NonioInput from "./nonio-input.js"
window.customElements.define('nonio-input', NonioInput)

import NonioLedgerLi from "./nonio-ledger-li.js"
window.customElements.define('nonio-ledger-li', NonioLedgerLi)

import NonioLedgerMonth from "./nonio-ledger-month.js"
window.customElements.define('nonio-ledger-month', NonioLedgerMonth)

import NonioLedger from "./nonio-ledger.js"
window.customElements.define('nonio-ledger', NonioLedger)

import NonioLink from "./nonio-link.js"
window.customElements.define('nonio-link', NonioLink)

import NonioLinkInput from "./nonio-link-input.js"
window.customElements.define('nonio-link-input', NonioLinkInput)

import NonioModal from "./nonio-modal.js"
window.customElements.define('nonio-modal', NonioModal)

import NonioNotificationBadge from "./nonio-notification-badge.js"
window.customElements.define('nonio-notification-badge', NonioNotificationBadge)

import NonioMarkdownView from "./nonio-markdown-view.js"
window.customElements.define('nonio-markdown-view', NonioMarkdownView)

import NonioMessageRow from "./nonio-message-row.js"
window.customElements.define('nonio-message-row', NonioMessageRow)

import NonioPassword from "./nonio-password.js"
window.customElements.define('nonio-password', NonioPassword)

import NonioPost from "./nonio-post.js"
window.customElements.define('nonio-post', NonioPost)

import NonioPostLi from "./nonio-post-li.js"
window.customElements.define('nonio-post-li', NonioPostLi)

import NonioPostCard from "./nonio-post-card.js"
window.customElements.define('nonio-post-card', NonioPostCard)

import NonioPostList from "./nonio-post-list.js"
window.customElements.define('nonio-post-list', NonioPostList)

import {NonioSelect, NonioOption} from "./nonio-select.js"
window.customElements.define('nonio-select', NonioSelect)
window.customElements.define('nonio-option', NonioOption)

import NonioRadioButton from "./nonio-radio-button.js"
window.customElements.define('nonio-radio-button', NonioRadioButton)

import NonioRadioButtonGroup from "./nonio-radio-button-group.js"
window.customElements.define('nonio-radio-button-group', NonioRadioButtonGroup)

import NonioRadialProgress from "./nonio-radial-progress.js"
window.customElements.define('nonio-radial-progress', NonioRadialProgress)

import NonioSidebar from "./nonio-sidebar.js"
window.customElements.define('nonio-sidebar', NonioSidebar)

import NonioSidebarSwitcher from "./nonio-sidebar-switcher.js"
window.customElements.define('nonio-sidebar-switcher', NonioSidebarSwitcher)

import {NonioSidebarPanel, NonioSidebarCommunityPanel, NonioSidebarUserPanel} from "./nonio-sidebar-panel.js"
window.customElements.define('nonio-sidebar-panel', NonioSidebarPanel)
window.customElements.define('nonio-sidebar-community-panel', NonioSidebarCommunityPanel)
window.customElements.define('nonio-sidebar-user-panel', NonioSidebarUserPanel)

import NonioLoginModal from "./modals/nonio-login-modal.js"
window.customElements.define('nonio-login-modal', NonioLoginModal)

import NonioCreateAccountModal from "./modals/nonio-create-account-modal.js"
window.customElements.define('nonio-create-account-modal', NonioCreateAccountModal)

import NonioCreateCommunityModal from "./modals/nonio-create-community-modal.js"
window.customElements.define('nonio-create-community-modal', NonioCreateCommunityModal)

import NonioCreateChannelModal from "./modals/nonio-create-channel-modal.js"
window.customElements.define('nonio-create-channel-modal', NonioCreateChannelModal)

import NonioImageViewerModal from "./modals/nonio-image-viewer-modal.js"
window.customElements.define('nonio-image-viewer-modal', NonioImageViewerModal)

import "./modals/nonio-modal-manager.js"

import NonioTab from "./nonio-tab.js"
window.customElements.define('nonio-tab', NonioTab)

import NonioTabGroup from "./nonio-tab-group.js"
window.customElements.define('nonio-tab-group', NonioTabGroup)

import NonioTag from "./nonio-tag.js"
window.customElements.define('nonio-tag', NonioTag)

import NonioTagGroup from "./nonio-tag-group.js"
window.customElements.define('nonio-tag-group', NonioTagGroup)

import NonioTagLi from "./nonio-tag-li.js"
window.customElements.define('nonio-tag-li', NonioTagLi)

import NonioUrlInput from "./nonio-url-input.js"
window.customElements.define('nonio-url-input', NonioUrlInput)

import NonioVoiceChannelLi from "./nonio-voice-channel-li.js"
window.customElements.define('nonio-voice-channel-li', NonioVoiceChannelLi)

import NonioTextChannelLi from "./nonio-text-channel-li.js"
window.customElements.define('nonio-text-channel-li', NonioTextChannelLi)

import NonioTextChannelViewThreaded from "./nonio-text-channel-view-threaded.js"
window.customElements.define('nonio-text-channel-view', NonioTextChannelViewThreaded)

import NonioUsernameInput from "./nonio-username-input.js"
window.customElements.define('nonio-username-input', NonioUsernameInput)

import NonioUser from "./nonio-user.js"
window.customElements.define('nonio-user', NonioUser)

import NonioUserPicker from "./nonio-user-picker.js"
window.customElements.define('nonio-user-picker', NonioUserPicker)

import NonioUserComment from "./nonio-user-comment.js"
window.customElements.define('nonio-user-comment', NonioUserComment)

import NonioUserCommentList from "./nonio-user-comment-list.js"
window.customElements.define('nonio-user-comment-list', NonioUserCommentList)

import NonioVideo from "./nonio-video.js"
window.customElements.define('nonio-video', NonioVideo)

import NonioVideoUploader from "./nonio-video-uploader.js"
window.customElements.define('nonio-video-uploader', NonioVideoUploader)

import NonioEncodingProgress from "./nonio-encoding-progress.js"
window.customElements.define('nonio-encoding-progress', NonioEncodingProgress)