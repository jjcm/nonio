var express = require('express');

const moment = require('moment');


var router = express.Router();
var store = require('../models/database.js')
var passport = require('passport')
const fortune = require('fortune')
const bcrypt = require('bcrypt')
const saltRounds = 11
const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
var passport = require('passport')
var Strategy = require('passport-local').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy,
    TwitterStrategy = require('passport-twitter').Strategy,
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var config = require('../config.js')

passport.use(new Strategy(
    function(username, password, next) {
            //console.log(username, password)

        store.find('user', null, { match: { username: username } }).then(results => {
            if (results.payload.records.count == 0) return next(null, false)
            var user = results.payload.records[0]
            console.log(user)

            bcrypt.compare(password, user.password, function(err, res) {
                console.log(res)
                if (res) return next(null, user)
                return next(null, false)
            })
        })
    }))

passport.serializeUser(function(user, done) {
  console.log('serializing the user')
  done(null, user)
})

passport.deserializeUser(function(user, done) {
  console.log('deserializing user')
  done(null, user)
})


passport.use(
  new GoogleStrategy({
    clientID: config.googleAuth.clientID,
    clientSecret: config.googleAuth.clientSecret,
    callbackURL: config.googleAuth.callbackURL
  }, 

  (token, refreshToken, profile, done) => {
    console.log("passport callback function")

    process.nextTick(function() {
        store.find('user', null, { match: { google_id: profile.id } }).then(results => {
            if (results.payload.records.count > 0) {
                console.log('existing google user found:')
                //console.log(results.payload.records[0]);
                return done(null, results.payload.records[0]);
            } else {
                console.log('creating new google user')
                var newGOUser = {
                    token: token,
                    google_id: profile.id,
                    email: profile.emails[0].value,
                    display_name: profile.displayName,
                    lastLogin: new Date()
                }
                store.create('user', newGOUser).then(results => {
                  console.log('creating new user in db')
                    //console.log("3", newGOUser);
                    return done(null, newGOUser);
                });

                // store.create('user', {}).then(results => {
                //         console.log("2", results.payload.records[0]);

                //         var newGOUser = {
                //             id: results.payload.records[0].id,
                //             token: token,
                //             google_id: profile.id,
                //             email: profile.emails[0].value,
                //             display_name: profile.displayName
                //         };
                //         console.log("3", newGOUser)
                //         store.create('google', newGOUser).then(newlyMadeGOUser => {
                //             console.log("4", newlyMadeGOUser)

                //             return done(null, newGOUser);
                //         })
                //     })
            }
        })
    });
}));

/* GET users listing. */
router.get('/', function(req, res, next) {
    //console.log(req.user)
    res.send(' <form action="/users/login" method="post"> <input name="username"> <input name="password"> <input type="submit"> </form> ');
});

router.post('/register', async function(req, res, next) {
    //console.log(req.body)
    var errors = {}
        //basic data checks
    if (!req.body.password) errors.password = 'password required'
    else if (req.body.password.length < 6) errors.password = 'password too short'

    if (req.body.password != req.body.passwordConfirmation) errors.passwordConfirmation = 'passwords dont match'
    if (!req.body.username) errors.username = 'username required'
    else if (await user.usernameInUse(req.body.username)) errors.username = 'username already taken'

    if (!req.body.email) errors.email = 'email required'
    else if (!emailRegex.test(req.body.email)) errors.email = 'not a valid email'
    else if (await user.emailInUse(req.body.email)) errors.email = 'email already taken'

    if (!req.body.contribution || req.body.contribution < 2 || req.body.contribution > 10) errors.contribution = 'contribution value was invalid or missing - try refreshing the page'

    //console.log(Object.keys(errors))
    if (Object.keys(errors).length != 0) {
        res.headers
        res.status(406).json(errors)
    } else {
        console.log('fields look good')
        bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
            store.create('user', {
                username: req.body.username,
                password: hash,
                email: req.body.email,
                contribution: parseInt(req.body.contribution),
                accountConfirmed: false,
                balance: 0,
                subscription: new Date()
            }).then(results => {
                //console.log(results)
            })
        })

        bcrypt.compare(req.body.password, '$2a$11$VtD7QR9KyRgw2WM81RFop.wLQoWgXePy74Jr4wHIMbzHWzVq5WEte', function(err, res) {
            //console.log(res)
        })
        res.redirect('/')
    }
})
router.get('/test', isAuthenticated,
    function(req, res) {
        //console.log("IN TEST", req.user)
            // do something with req.user
        res.send(req.user ? 200 : 401);
    }
);
router.post('/login', passport.authenticate('local', { failureRedirect: 'http://syd.jjcm.org/sociFrontend/login/#failure' }), function(req, res, next) {
    //console.log(req.user)
    res.redirect('/')
})

router.post('/checkUsername', function(req, res, next) {
    res.json({ taken: false })
})

router.post('/checkEmail', function(req, res, next) {
    res.json({ taken: false })
})

var user = {
    usernameInUse: function(username) {
        console.log(username)
        return new Promise(resolve => {
            store.find('user', [], { match: { username: username } }).then(results => {
                resolve(results.payload.count != 0)
            })
        })
    },
    emailInUse: function(email) {
        return new Promise(resolve => {
            store.find('user', [], { match: { email: email } }).then(results => {
                resolve(results.payload.count != 0)
            })
        })
    }

}

function isAuthenticated(req, res, next) {
    console.log("AUTH", req.headers);
    var authorization = req.headers["authorization"];
    //console.log(authorization)
    var items = authorization.split(/[ ]+/);

    if (items.length > 1 && items[0].trim() == "Bearer") {
        var token = items[1];
        console.log(token);
        store.find('google', null, { match: { token: token } }).then(results => {
            if (results.payload.records.count > 0) {
                //Auth success 
                next();

            } else {
                res.redirect("/");
            }
        })
    }

}

router.get('/facebook', passport.authenticate('facebook', { scope: 'email' }));

router.get('/facebook/callback',
    passport.authenticate('facebook', {
        successRedirect: '/',
        failureRedirect: '/signin'
    })
);

router.get('/twitter', passport.authenticate('twitter'));


router.get('/twitter/callback',
    passport.authenticate('twitter', {
        successRedirect: '/',
        failureRedirect: '/signin'
    })
);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }), function(req, res, next) {
    //console.log("FINISH", req.user);
    res.status(201).send("done")
});

router.get('/google/callback', passport.authenticate('google'), (req, res)=> {
  res.redirect("/");
})
/*
router.get('/google/callback',
    passport.authenticate('google', {
        successRedirect: '/posts',
        failureRedirect: '/signin'
    }),
    function(req, res, next) {
        console.log("FINISH", req.user)
        res.redirect("/");
    }
);
*/


module.exports = router;