var express = require('express');
var router = express.Router();
var store = require('../models/database.js');
const fortune = require('fortune');
const moment = require('moment');
const _ = require('underscore');




router.get('/', isAuthenticated, function(req, res, next) {
    let lastLogin = moment(req.user.lastLogin).utc().toDate();
    let lastDay = moment().subtract(1, 'days').utc().toDate();
    let now = moment().utc().toDate();

    if (lastLogin < lastDay) {
        store.find('post', null, { range: { date: [lastLogin, now] } }).then(results => {
            if (results) {
                let stortedPosts = _.sortBy(results.payload.records, 'score');
                stortedPosts = stortedPosts.reverse();
                let posts = stortedPosts.slice(0, 100);
                res.send(posts);
            }

        }).catch(err => { console.log(err) });
    } else {
        store.find('post', null, { range: { date: [lastDay, now] } }).then(results => {
            if (results) {
                let stortedPosts = _.sortBy(results.payload.records, 'score');
                stortedPosts = stortedPosts.reverse();
                let posts = stortedPosts.slice(0, 100);
                res.send(posts);
            }
        }).catch(err => { console.log(err) });
    }

});

router.get('/new', isAuthenticated, function(req, res, next) {
    store.find('post', null).then(results => {
        if (results) {
            let stortedPosts = _.sortBy(results.payload.records, 'date');
            stortedPosts = stortedPosts.reverse();
            let posts = stortedPosts.slice(0, 100);

            res.send(posts);
        }
    }).catch(err => { console.log(err) });
});

router.get('/top', isAuthenticated, function(req, res, next) {
    store.find('post', null, {}).then(results => {
        if (results) {
            let stortedPosts = _.sortBy(results.payload.records, 'score');
            stortedPosts = stortedPosts.reverse();
            let posts = stortedPosts.slice(0, 100);
            console.log(posts.length);
            res.send(posts);
        }
    });
});

router.get('/top/day', isAuthenticated, function(req, res, next) {
    let lastDay = moment().subtract(1, 'days').toDate();
    let now = moment().toDate();

    store.find('post', null, { range: { date: [lastDay, now] } }).then(results => {
        if (results) {
            let stortedPosts = _.sortBy(results.payload.records, 'score');
            stortedPosts = stortedPosts.reverse();
            let posts = stortedPosts.slice(0, 100);
            res.send(posts);
        }
    }).catch(err => { console.log(err) });

});

router.get('/top/week', isAuthenticated, function(req, res, next) {
    lastWeek = moment().subtract(1, 'week').toDate();
    let now = moment().toDate();

    store.find('post', null, { range: { date: [lastWeek, now] } }).then(results => {
        if (results) {
            let stortedPosts = _.sortBy(results.payload.records, 'score');
            stortedPosts = stortedPosts.reverse();
            let posts = stortedPosts.slice(0, 100);
            res.send(posts);
        }
    }).catch(err => { console.log(err) });
});

router.get('/top/month', isAuthenticated, function(req, res, next) {
    lastMonth = moment().subtract(1, 'month').toDate();
    let now = moment().toDate();


    store.find('post', null, { range: { date: [lastMonth, now] } }).then(results => {
        if (results) {
            let stortedPosts = _.sortBy(results.payload.records, 'score');
            stortedPosts = stortedPosts.reverse();
            let posts = stortedPosts.slice(0, 100);
            console.log(posts.length);
            res.send(posts);
        }
    }).catch(err => { console.log(err) });
});

router.get('/top/year', isAuthenticated, function(req, res, next) {
    lastYear = moment().subtract(1, 'year').toDate();
    let now = moment().toDate();


    store.find('post', null, { range: { date: [lastYear, now] } }).then(results => {
        if (results) {
            let stortedPosts = _.sortBy(results.payload.records, 'score');
            stortedPosts = stortedPosts.reverse();
            let posts = stortedPosts.slice(0, 100);
            res.send(posts);
        }
    }).catch(err => { console.log(err) });
});

router.get('/:url', function(req, res, next) {
    store.find('post', null, { match: { url: req.params.url } }).then(posts => {
        if (posts.payload.count == 1) {
            res.send(posts.payload.records[0]);
        } else if (posts.payload.count > 1) {
            res.status(401).send("Post should have a uniq URL");
        } else {
            res.status(401).send("Post with this URL does not exist");

        }
    }).catch(err => {
        console.log(err)
    });
});

router.get('tag/:tag', isAuthenticated, function(req, res, next) {
    //   store.find('post', null, {match: {name: req.params.tag}}).then(results => {
    store.find('postTag', null, { match: { tag: req.params.tag } }, [
        ['post'],
        ['tag']
    ]).then(results => {

        console.log(results)
        if (results)
            res.json(results.payload.include.post)
    }).catch(err => {
        console.log(err)
    })
});



// router.get('/search', (req, res, next) => {
//     var queries = req.query;
//     console.log(queries);
//     for (var key in queries) {
//         if (queries.hasOwnProperty(key)) {
//             console.log(key + " -> " + queries[key]);
//             store.find('post', null, {
//                 match: {
//                     [key]: queries[key]
//                 }
//             }).then((posts) => {
//                 res.json(posts);
//             }, (err) => {
//                 console.log('unable to return the data for a single post referenced by its url', err);
//             })
//         } else {
//             console.log('erreur');
//         }
//     }
// });





function isAuthenticated(req, res, next) {
    if(req.user) next()
    else res.status(401).send('You must be logged in to view this')
    /*
    var authorization = req.headers["authorization"];
    if (!authorization) {
        res.status(401).send("You should be logged in to see this content")
        return;
    }
    var items = authorization.split(/[ ]+/);

    if (items.length > 1 && items[0].trim() == "Bearer") {
        var token = items[1];
        // console.log(token);
        store.find('user', null, { match: { token: token } }).then(results => {
            if (results.payload.records.count > 0) {
                //Auth success 
                req.user = results.payload.records[0];
                next();
            } else {
                // res.redirect("/");
                res.status(401).send("You should be logged in to see this content")
            }
        })
    }
    */

}

module.exports = router;