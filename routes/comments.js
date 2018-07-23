var express = require('express');
var router = express.Router();
var store = require('../models/database.js');
const fortune = require('fortune');
const moment = require('moment');
const _ = require('underscore');



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

module.exports = router;