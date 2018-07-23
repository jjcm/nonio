var express = require('express')
var router = express.Router()

/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.user){
    console.log(req.user)
    res.render('index', {user: req.user.email})
  }
  else
    res.render('login')
})

router.get('/login', function(req, res, next){
  res.render('login')
})

module.exports = router
