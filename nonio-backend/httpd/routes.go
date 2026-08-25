package httpd

import (
	"net/http"

	"nonio-backend/httpd/handlers"
)

// OpenRoutes - routes that don't require auth
func OpenRoutes() map[string]func(http.ResponseWriter, *http.Request) {
	routes := map[string]func(http.ResponseWriter, *http.Request){
		"/": handlers.Home,

		"/posts":                  handlers.GetPosts,
		"/posts/":                 handlers.GetPostByURL,
		"/post/url-is-available/": handlers.CheckIfURLIsAvailable,
		"/post/encoding-complete": handlers.PostEncodingComplete,

		"/user/register":                  handlers.Register,
		"/user/login":                     handlers.Login,
		"/user/refresh-access-token":      handlers.RefreshAccessToken,
		"/user/username-is-available/":    handlers.CheckIfUsernameIsAvailable,
		"/user/forgot-password-request":   handlers.ForgotPasswordRequest,
		"/user/change-forgotten-password": handlers.ChangeForgottenPassword,
		"/users/":                         handlers.GetUser,

		"/comments": handlers.GetComments,

		// TAG ROUTES
		"/tags":  handlers.GetTags,
		"/tags/": handlers.GetTagsByPrefix,

		// COMMUNITY ROUTES
		"/communities":          handlers.GetCommunities,
		"/voice/presence/ws":    handlers.VoicePresenceWS,
		"/community/channel/ws": handlers.ChannelMessagesWS,

		"/stripe/webhooks": handlers.StripeWebhook,
	}

	return routes
}

// OptionalAuthRoutes - routes that optionally use auth
func OptionalAuthRoutes() map[string]func(http.ResponseWriter, *http.Request) {
	routes := map[string]func(http.ResponseWriter, *http.Request){
		"/communities/": handlers.GetCommunity,
	}
	return routes
}

// ProtectedRoutes - routes that require auth
func ProtectedRoutes() map[string]func(http.ResponseWriter, *http.Request) {
	routes := map[string]func(http.ResponseWriter, *http.Request){
		"/protected": handlers.GetTokenDetails,

		// POST ROUTES
		"/post/create":             handlers.CreatePost,
		"/post/delete":             handlers.DeletePost,
		"/post/parse-external-url": handlers.CheckExternalURLTitle,

		// COMMENT ROUTES
		"/comment/create":      handlers.CommentOnPost,
		"/comment/edit":        handlers.EditComment,
		"/comment/delete":      handlers.DeleteComment,
		"/comment/abandon":     handlers.AbandonComment,
		"/comment/add-vote":    handlers.AddCommentVote,
		"/comment/remove-vote": handlers.RemoveCommentVote,

		// POSTTAG ROUTES
		"/posttag/create":      handlers.CreatePostTag,
		"/posttag/add-vote":    handlers.AddPostTagVote,
		"/posttag/remove-vote": handlers.RemovePostTagVote,

		// COMMUNITY ROUTES
		"/community/create":                handlers.CreateCommunity,
		"/community/subscribe":             handlers.SubscribeToCommunity,
		"/community/unsubscribe":           handlers.UnsubscribeFromCommunity,
		"/communities/subscribed":          handlers.GetSubscribedCommunities,
		"/community/add-moderator":         handlers.AddModerator,
		"/community/remove-moderator":      handlers.RemoveModerator,
		"/community/add-member":            handlers.AddMember,
		"/community/remove-member":         handlers.RemoveMember,
		"/community/moderators":            handlers.GetModerators,
		"/community/update":                handlers.UpdateCommunity,
		"/community/ban":                   handlers.BanUser,
		"/community/unban":                 handlers.UnbanUser,
		"/community/users":                 handlers.GetCommunityUsers,
		"/community/financials":            handlers.GetCommunityFinancials,
		"/community/channels":              handlers.GetChannels,
		"/community/channel/create":        handlers.ChannelCreate,
		"/community/channel/messages":      handlers.ChannelMessages,
		"/community/channel/thread":        handlers.ChannelThread,
		"/community/channel/message/react": handlers.ChannelMessageReact,
		"/community/emojis":                handlers.GetCommunityEmojis,
		"/community/emoji/create":          handlers.CommunityEmojiCreate,
		"/emoji/create":                    handlers.UserEmojiCreate,
		"/emojis/sets":                     handlers.EmojiSets,
		"/emoji/subscribe":                 handlers.EmojiSubscribe,
		"/emoji":                           handlers.EmojiByID,

		// SUBSCRIPTION ROUTES
		"/subscriptions":       handlers.GetSubscriptions,
		"/subscription/create": handlers.CreateSubscription,
		"/subscription/delete": handlers.DeleteSubscription,

		// USER ROUTES
		"/user/change-password":      handlers.ChangePassword,
		"/user/update-description":   handlers.UpdateDescription,
		"/user/get-financials":       handlers.GetFinancials,
		"/user/get-financial-ledger": handlers.GetFinancialLedger,
		"/users/search":              handlers.SearchUsers,
		// TODO - set up the GetSettings route or something similar to return whether the user is a subscriber or not
		// "/user/get-settings":        handlers.GetSettings,
		"/user/choose-free-account": handlers.ChooseFreeAccount,

		// NOTIFICATIONS ROUTES
		"/notifications":              handlers.GetNotifications,
		"/notifications/unread-count": handlers.GetUnreadNotificationCount,
		"/notification/mark-read":     handlers.MarkNotificationRead,

		// VOTES ROUTES
		"/votes": handlers.GetVotes,

		// COMMENT VOTES ROUTES
		"/comment-votes": handlers.GetCommentVotes,
		//"/comment-votes/post/": handlers.GetCommentVotesForPost,
		// TODO "/comment-votes/user/":               handlers.GetCommentVotesForUser,

		"/stripe/subscription/create": handlers.StripeCreateSubscription,
		"/stripe/subscription/delete": handlers.StripeCancelSubscription,
		"/stripe/subscription/edit":   handlers.StripeEditSubscription,
		"/stripe/subscription":        handlers.StripeGetSubscription,
		"/stripe/price-config":        handlers.StripeGetPriceConfig,
		"/stripe/create-customer":     handlers.StripeCreateCustomer,
		"/stripe/get-connect-link":    handlers.GetConnectLink,

		// VOICE (LiveKit)
		"/voice/join":     handlers.VoiceJoin,
		"/voice/presence": handlers.VoicePresence,

		// ADMIN ROUTES
		"/admin/ban":  handlers.UserBan,
		"/admin/nuke": handlers.NukeUser,

		// DEV ROUTES (guarded inside handlers)
		"/dev/user/set-subscription": handlers.DevSetSubscription,
	}

	return routes
}
