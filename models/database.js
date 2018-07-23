const fortune = require('fortune')
const pgAdapter = require('fortune-postgres')
    // Server
    const dbConnection = 'postgres://j@localhost:5432/soci'

//Local
// const dbConnection = 'postgres://ismailmellouli@localhost:5432/soci'


const store = fortune({
    post: {
        title: String,
        OC: Boolean,
        url: String,
        user: 'user',
        thumbnail: String,
        score: Number,
        grade: Number,
        date: Date,
        content: String,
        type: String,
        //I think maybe this declaration is wrong for the mapping. Because the field type is "tags" when it's postTags 
        //http://fortune.js.org/ has examples in their usage page
        tags: Array('postTag')
    },
    user: {
        username: String,
        avatar: String,
        balance: Number,
        contribution: Number,
        subscription: Date,
        email: String,
        accountConfirmed: Boolean,
        password: String,
        password_change_request_hash: String,
        lastLogin: Date,
        google_id: String,
        token: String,
        refreshToken: String
    },
    postTag: {
        tag: 'tag',
        post: 'post',
        upvotes: Number,
        downvotes: Number,
        date: Date
    },
    tag: {
        name: String,
        user: 'user',
        createdDate: Date
    },
    userVote: {
        post: 'post',
        tag: 'tag',
        user: 'user',
        date: Date,
        positive: Boolean
    },
    comment: {
        post: 'post',
        type: String,
        content: String,
        text: String,
        user: 'user',
        upvotes: Number,
        downvotes: Number,
        parent: 'comment'
    },
    commentVote: {
        comment: 'comment',
        post: 'post',
        user: 'user',
        date: Date,
        positive: Boolean
    },
    postReport: {
        post: 'post',
        fromUser: 'user',
        reportedUser: 'user',
        post: 'post',
        comment: 'comment',
        reasonNotOC: Boolean,
        reasonIllegal: Boolean,
        reason: String
    }
}, {
    adapter: [
        pgAdapter, {
            url: dbConnection
        }
    ]
})

module.exports = store
    /*
    store.request(
      {
        method: fortune.methods.create,
        type: 'post',
        payload: [{title: 'hello, world', OC: false}]
      }).then(result => {
      console.log(result)
    })
    */
    /*
    store.find('post', null, {match: {OC: false}}).then(results => {
      console.log(results.payload)
    })
    */