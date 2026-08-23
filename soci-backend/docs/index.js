const PORT = 8889

var http = require('http')
var fs = require('fs')
var path = require('path')
var pug = require('pug')
var mime = require('mime-types')
var stylus = require('stylus')

var server = http.createServer(function (req, res) {
  var ext = path.extname(req.url)
  if(fs.existsSync('.' + req.url)) {
    switch(ext){
      case '.pug':
        handler.pug(req,res)
        break
      case '.styl':
        handler.styl(req,res)
        break
      case '':
        handler.folder(req, res)
        break
      default:
        handler.file(req, res)
        break
    }
  }
  else {
    console.log(req.method + ' | ' + 'PATH   | ' + req.url)
    let html = pug.renderFile('index.pug', {
      filters: {
        code: function(text, options){
          var entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;',
            "'": '&#39;',
            "/": '&#x2F;'
          }

          text = text.replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
          })

          var preClass = Object.keys(options).length > 1 ? Object.keys(options)[1] : ''
          text = "<pre class='" + preClass + "'><code class='language-" + Object.keys(options)[0] + "'>" + text + "</code></pre>"

          return text
        }
      }


    })
    res.end(html, 'utf-8')
  }
})

var handler = {
  error: function(req, res, err){
    res.writeHead(404, { 'Content-Type' : 'text/html' })
    res.end(err.message, 'utf-8')
    console.log(err)
  },
  pug: function(req, res){
    var filePath = '.' + req.url
    console.log(req.method + ' | ' + 'PUG    | ' + req.url)
    fs.readFile(filePath, 'utf8', (err, data) => {
      if(err){
        handler.error(req, res, err)
      }
      else {
        let html = pug.render(data, {
          filters: {
            code: function(text, options){
              var entityMap = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': '&quot;',
                "'": '&#39;',
                "/": '&#x2F;'
              }

              text = text.replace(/[&<>"'\/]/g, function (s) {
                return entityMap[s];
              })

              var preClass = Object.keys(options).length > 1 ? Object.keys(options)[1] : ''
              text = "<pre class='" + preClass + "'><code class='language-" + Object.keys(options)[0] + "'>" + text + "</code></pre>"

              return text
            }
          }
        })
        res.writeHead(200, { 'Content-Type' : 'text/html' })
        res.end(html, 'utf-8')
      }
    })
  },
  styl: function(req, res){
    var filePath = '.' + req.url
    console.log(req.method + ' | ' + 'STYLUS | ' + req.url)
    fs.readFile(filePath, 'utf8', (err, data) => {
      if(err){
        handler.error(req, res, err)
      }
      else {
        stylus.render(data, {filename: filePath}, (err, css) => {
          if(err){
            handler.error(req, res, err)
          }
          else {
            res.writeHead(200, { 'Content-Type' : 'text/css' })
            res.end(css, 'utf-8')
          }
        })
      }
    })
  },
  folder: function(req, res){
    var html = 'no index found'
    var filePath = '.' + req.url
    console.log(req.method + ' | ' + 'FOLDER | ' + req.url)
    fs.readdir(filePath, function(err, files){
      res.writeHead(200, { 'Content-Type' : 'text/html' })
      if(err) {
        console.log(err)
        res.end(err.toString(), 'utf-8')
        return 0
      }
      if(files.indexOf('index.pug') != -1){
        if(!filePath.match(/\/$/)) filePath += '/'

        html = pug.renderFile(filePath + 'index.pug', {
          filters: {
            code: function(text, options){
              var entityMap = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': '&quot;',
                "'": '&#39;',
                "/": '&#x2F;'
              }

              text = text.replace(/[&<>"'\/]/g, function (s) {
                return entityMap[s];
              })

              var preClass = Object.keys(options).length > 1 ? Object.keys(options)[1] : ''
              text = "<pre class='" + preClass + "'><code class='language-" + Object.keys(options)[0] + "'>" + text + "</code></pre>"

              return text
            }
          }
        })
      }
      else {
        html = '<h1>Directory Listing</h1><ul>'
        for(var i = 0; i < files.length; i++){
          var path = req.url + files[i]
          html += '<li><a href="' + path + '">' + files[i] + '</a></li>'
        }
      }
      res.end(html, 'utf-8')
    })
  },
  file: function(req, res){
    console.log(req.method + ' | ' + 'FILE   | ' + req.url)
    var mimetype = mime.lookup(req.url)
    if(mimetype == 'video/mp4' && req.headers.range){
      var file = req.url
      var range = req.headers.range
      var positions = range.replace(/bytes=/, "").split("-")
      var start = parseInt(positions[0], 10)

      fs.stat(file, function(err, stats) {
        var total = stats.size
        var end = positions[1] ? parseInt(positions[1], 10) : total - 1
        var chunksize = (end - start) + 1

        res.writeHead(206, {
          "Content-Range": "bytes " + start + "-" + end + "/" + total,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4"
        });

        var stream = fs.createReadStream(file, { start: start, end: end })
          .on("open", function() {
            stream.pipe(res)
          }).on("error", function(err) {
            res.end(err)
          })
      })
    }
    else {
      fs.readFile('.' + req.url, function(err, data){
        if(err){
          res.writeHead(404,{"Content-type":"text/plain"})
          res.end("Sorry the page was not found")
        }
        else {
          if(mimetype)
            res.writeHead(200, { 'Content-Type': mimetype })
          res.end(data)
        }
      })
    }
  }
}

server.listen(PORT)
console.log(`listening on ${PORT}`)
console.log('-----------------')
