var express = require('express')
var router = express.Router()
var store = require('../models/database.js')
const fortune = require('fortune');
const moment = require('moment');
const _ = require('underscore');


router.get('/', isAuthenticated, function(req, res, next) {
    let lastLogin = moment(req.user.lastLogin).utc().toDate();
    let lastMonth = moment().subtract(1, 'month').utc().toDate();
    let timespan;
    if (lastLogin < lastMonth) {
        timespan = lastLogin;
    } else {
        timespan = lastMonth;
    }
    store.find('tag', null).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            getpostTags(req, tagsIds, res, tagsMap, timespan);
        }
    }).catch(err => { console.log(err) });
});
router.get('/top', isAuthenticated, function(req, res, next) {
    let timespan = moment().subtract(50, 'years').utc().toDate();
    store.find('tag', null).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            getpostTags(req, tagsIds, res, tagsMap, timespan);
        }
    }).catch(err => { console.log(err) });
});
router.get('/top/day', isAuthenticated, function(req, res, next) {
    let lastDay = moment().subtract(1, 'days').utc().toDate();
    store.find('tag', null).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            getpostTags(req, tagsIds, res, tagsMap, lastDay);
        }
    }).catch(err => { console.log(err) });
});

router.get('/top/week', isAuthenticated, function(req, res, next) {
    let lastWeek = moment().subtract(1, 'weeks').utc().toDate();
    store.find('tag', null).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            getpostTags(req, tagsIds, res, tagsMap, lastWeek);
        }
    }).catch(err => { console.log(err) });
});


router.get('/top/month', isAuthenticated, function(req, res, next) {
    let lastMonth = moment().subtract(1, 'months').utc().toDate();
    store.find('tag', null).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            getpostTags(req, tagsIds, res, tagsMap, lastMonth);
        }
    }).catch(err => { console.log(err) });
});
router.get('/top/year', isAuthenticated, function(req, res, next) {
    let lastYear = moment().subtract(1, 'years').utc().toDate();
    store.find('tag', null).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            getpostTags(req, tagsIds, res, tagsMap, lastYear);
        }
    }).catch(err => { console.log(err) });
});


router.get('/new', isAuthenticated, function(req, res, next) {
    store.find('tag', null, { sort: { createdDate: false } }).then(results => {
        let tagsIds = [];
        if (results) {
            results.payload.records.forEach(tag => {
                tagsIds.push(tag.id);
            });
            let tagsMap = new Map();
            results.payload.records.forEach(tag => {
                tagsMap.set(tag.id, tag);
            });
            store.find('postTag', null, { match: { tag: tagsIds } }).then(postTags => {
                if (postTags) {
                    postTags.payload.records.forEach(postTag => {
                        // console.log(postTag.tag, tagsMap.get(postTag.tag))
                        if (tagsMap.get(postTag.tag).count) {
                            let t = tagsMap.get(postTag.tag)
                            t.count++;
                            tagsMap.set(t.id, t);
                        } else {
                            let t = tagsMap.get(postTag.tag)
                            t.count = 1;
                            tagsMap.set(t.id, t);
                        }
                    })
                }
                let tagsValue = []
                for (var tag of tagsMap.entries()) {
                    var key = tag[0],
                        value = tag[1];
                    tagsValue.push(value);
                }
                res.send(tagsValue);
            }).catch(err => { console.log(err) });
        }
    }).catch(err => { console.log(err) });
});




router.get('/:tag/popular', function(req, res, next) {
    var range = {
        date: [new Date(Date.now() - 497330022), new Date()]
    }
    store.find('postTag', null, { range: range }, [
        ['post'],
        ['tag']
    ]).then(results => {
        console.log(results)
        if (results)
            res.json(results.payload)
    }).catch(err => {
        console.log(err)
    })
});
router.get('/:tag/top', isAuthenticated, function(req, res, next) {
    var options = {
        match: { tag: req.params.tag },
        sort: { upvotes: false },
    }
    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        if (results) {
            let posts = results.payload.include.post.slice(0, 100);
            res.json(results.payload);
        }
    }).catch(err => {
        console.log(err)
    });
});

router.get('/:tag/top/day', isAuthenticated, function(req, res, next) {
    let lastDay = moment().subtract(1, 'days').utc().toDate();
    let now = moment().utc().toDate();
    var options = {
        match: { tag: req.params.tag },
        sort: { upvotes: false },
        range: { date: [lastDay, now] },
    }
    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        if (results) {
            let posts = results.payload.include.post.slice(0, 100);
            res.json(results.payload);
        }
    }).catch(err => {
        console.log(err)
    });
    // store.find('postTag', null, options, [
    //     ['post'],
    //     ['tag']
    // ]).then(results => {
    //     if (results) {
    //         console.log(results)

    //         let postIds = [];
    //         results.payload.records.forEach(record => {
    //             postIds.push(record.post)
    //         });
    //         store.find('post', postIds, [
    //             ['tags']
    //         ]).then(post => {
    //             if (post) {
    //                 let posts = post.payload.records.slice(0, 100);
    //                 res.send(posts);
    //             }
    //         }).catch(err => { console.log(err) });

    //     }
    // }).catch(err => {
    //     console.log(err)
    // });

});



router.get('/:tag/top/week', isAuthenticated, function(req, res, next) {
    let lastWeek = moment().subtract(1, 'week').utc().toDate();
    let now = moment().utc().toDate();
    var options = {
        match: { tag: req.params.tag },
        sort: { upvotes: false },
        limit: 100,
        range: { date: [lastWeek, now] },
    }
    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        if (results) {
            let posts = results.payload.include.post.slice(0, 100);
            res.json(posts);
        }
    }).catch(err => {
        console.log(err)
    });

});

router.get('/:tag/top/month', isAuthenticated, function(req, res, next) {
    let lastMonth = moment().subtract(1, 'month').utc().toDate();
    let now = moment().utc().toDate();
    var options = {
        match: { tag: req.params.tag },
        sort: { upvotes: false },
        // limit: 100,
        range: { date: [lastMonth, now] },
    }
    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        if (results) {
            let posts = results.payload.include.post.slice(0, 100);
            res.json(posts);
        }
    }).catch(err => {
        console.log(err)
    });
});

router.get('/:tag/top/year', isAuthenticated, function(req, res, next) {
    let lastYear = moment().subtract(1, 'year').utc().toDate();
    let now = moment().utc().toDate();
    var options = {
            match: { tag: req.params.tag },
            sort: { upvotes: false },
            range: { date: [lastYear, now] },
        }
        // store.find('postTag', null, options, [
        //     ['post'],
        //     ['tag']
        // ]).then(results => {
        //     if (results) {
        //         console.log(results.payload.records)

    //         let postIds = [];
    //         results.payload.records.forEach(record => {
    //             postIds.push(record.post)
    //         });
    //         store.find('post', postIds, [
    //             ['tags']
    //         ]).then(post => {
    //             if (post) {
    //                 let posts = post.payload.records.slice(0, 100);
    //                 res.send(posts);
    //             }
    //         }).catch(err => { console.log(err) });

    //     }
    // }).catch(err => {
    //     console.log(err)
    // });
    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        if (results) {
            let posts = results.payload.include.post.slice(0, 100);
            res.json(posts);
        }
    }).catch(err => {
        console.log(err)
    });

});



router.get('/:tag/new', isAuthenticated, function(req, res, next) {
    var options = {
        match: { tag: req.params.tag },
        sort: { date: true },
        // limit: 100,
    }

    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        if (results) {
            let posts = results.payload.include.post.slice(0, 100);
            res.json(posts);
        }
    }).catch(err => {
        console.log(err)
    });
})

router.get('/:tag/top/:range', function(req, res, next) {
    getTopPostTags(req.params.range, res)
});
router.get('/:tag/top/:range/offset/:offset', function(req, res, next) {
    getTopPostTags(req.params.range, res, req.params.offset)
});

router.get('/:tag', isAuthenticated, function(req, res, next) {
    let lastLogin = moment(req.user.lastLogin).utc().toDate();
    let lastDay = moment().subtract(1, 'days').utc().toDate();
    let now = moment().utc().toDate();
    let options = {
        match: { tag: req.params.tag },
        sort: { upvotes: false },
    }
    if (lastLogin < lastDay) {
        console.log(1);
        store.find('postTag', null, options, [
            ['post'],
            ['tag']
        ]).then(results => {
            if (results) {
                let posts = results.payload.include.post.slice(0, 100);
                console.log(posts.length)

                res.json(posts);
            }
        }).catch(err => {
            console.log(err)
        });
        // store.find('postTag', null, options, [
        //     ['post'],
        //     ['tag'],
        // ]).then(results => {
        //     if (results) {
        //         let postIds = [];
        //         results.payload.records.forEach(record => {
        //             postIds.push(record.post)
        //         });
        //         store.find('post', postIds, { range: { date: [lastLogin, now] } }).then(post => {
        //             if (post) {
        //                 let posts = post.payload.records.slice(0, 100);
        //                 res.send(posts);
        //             }
        //         }).catch(err => { console.log(err) });
        //     }
        // }).catch(err => { console.log(err) });

    } else {
        console.log('2');

        store.find('postTag', null, options, [
            ['post'],
            ['tag']
        ]).then(results => {
            if (results) {
                let posts = results.payload.include.post.slice(0, 100);
                console.log(results.payload.include.post.length)
                res.json(results.payload);
            }
        }).catch(err => {
            console.log(err)
        });
    }

});



function getTopPostTags(timespan, res, offset) {
    if (!offset) offset = 0
    var msInDay = 24 * 60 * 60 * 1000
    switch (timespan) {
        case 'day':
            timespan = msInDay
            break
        case 'week':
            timespan = msInDay * 7
            break
        case 'month':
            timespan = msInDay * 31
            break
        case 'year':
            timespan = msInDay * 365
            break
        default:
            timespan = msInDay * 7
            break
    }

    var range = {
        date: [new Date(Date.now() - timespan), new Date()]
    }

    var options = {
        range: range,
        sort: { upvotes: false },
        offset: offset,
        limit: 100
    }

    store.find('postTag', null, options, [
        ['post'],
        ['tag']
    ]).then(results => {
        console.log(results)
        if (results)
            res.json(results.payload)
    }).catch(err => {
        console.log(err)
    })
}

function isAuthenticated(req, res, next) {
    // console.log("AUTH", req.headers);
    console.log('AUTH');
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

}

function getpostTags(req, tagsIds, res, tagsMap, timespan) {
    let now = moment().utc().toDate();
    store.find('postTag', null, { match: { tag: tagsIds } }, { range: { date: [timespan, now] } }).then(postTags => {
        if (postTags) {
            postTags.payload.records.forEach(postTag => {
                // console.log(postTag.tag, tagsMap.get(postTag.tag))
                if (tagsMap.get(postTag.tag).count) {
                    let t = tagsMap.get(postTag.tag)
                    t.count++;
                    tagsMap.set(t.id, t);
                } else {
                    let t = tagsMap.get(postTag.tag)
                    t.count = 1;
                    tagsMap.set(t.id, t);
                }
            })
        }
        let tagsValue = []
        for (var tag of tagsMap.entries()) {
            var key = tag[0],
                value = tag[1];
            tagsValue.push(value);
        }
        let stortedTags = _.sortBy(tagsValue, 'count');
        stortedTags = stortedTags.reverse();
        let tags = stortedTags.slice(0, 100);
        res.send(tags);
    }).catch(err => { console.log(err) });
}
module.exports = router;