var express = require('express')
var cors = require('cors')
var path = require('path')
var favicon = require('serve-favicon')
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var stylus = require('stylus')
var store = require('./models/database.js')
var session = require('express-session')({
    secret: 'ninjapotatoes',
    resave: true,
    saveUninitialized: true
})


var index = require('./routes/index')
var cookieSession = require('cookie-session')
var users = require('./routes/users')
var tags = require('./routes/tags')
var posts = require('./routes/posts')
var comments = require('./routes/comments')



var passport = require('passport')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(cors())
app.use(stylus.middleware(path.join(__dirname, 'public')))
app.use(express.static(path.join(__dirname, 'public')))
app.use(session)
app.use(passport.initialize())
app.use(passport.session())

app.use('/', index)
app.use('/users', users)
app.use('/api/tags', tags)
app.use('/api/posts', posts)
app.use('/api/comments', comments)




// catch 404 and forward to error handler
app.use(function(req, res, next) {
    console.log('asdf')
    var err = new Error('Not Found')
    console.log(req.url)
    err.status = 404
    next(err)
});

// error handler
app.use(function(err, req, res, next) {
    console.log('asdf2')
    console.log(err)
        // set locals, only providing error in development
    res.locals.message = err.message
    res.locals.error = req.app.get('env') === 'development' ? err : {}

    // render the error page
    res.status(err.status || 500)
    res.render('error')
});

module.exports = app