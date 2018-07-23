var posts = {
  init: function(){
    window.addEventListener('resize', posts.checkTitles)
    console.log('ayy')
    console.log(posts)
    posts.vueify()
  },
  vueify: function(){
    var posts = new Vue({
      el: '#posts-list-container',
      data: {
        posts: postData
      },
      mounted: function(){
        window.posts.checkTitles()
      },
      computed: {
        updatedTimes: function(){
          postData.map(function(post){
            post.date = new Date()
            let date = (Date.now() - Date.parse(post.date)) / 1000 / 60
            if(date > 60 * 24 * 30) date = Math.floor(date / 60 / 24 / 30) + ' months ago'
            else if(date > 60 * 24) date = Math.floor(date / 60 / 24) + ' days ago'
            else if(date > 60) date = Math.floor(date / 60) + ' hours ago'
            else date = Math.ceil(date) + ' minutes ago'

            post.date = date

            let topTagScore = 0
            post.tags.forEach((tag)=>{
              topTagScore = Math.max(topTagScore, tag.upvotes - tag.downvotes)
              tag.top = false
            })

            post.tags.forEach((tag)=>{
              if(tag.upvotes - tag.downvotes == topTagScore)
                tag.top = true
            })
          })

          return postData
        }
      }
    })
  },
  checkTitles: function(e){
    document.querySelectorAll('.big-title').forEach(posts.adjustTitleToFit)
  },
  adjustTitleToFit: function(dom){
    if(dom.offsetWidth <= dom.parentElement.offsetWidth){
      dom.parentElement.classList.add('big')
    }
    else dom.parentElement.classList.remove('big')
  }
}

document.addEventListener('DOMContentLoaded', posts.init)

var postData = [
  {
    "title": "I hiked alone all day, ran away from two moose, and took a picture of the most amazing view from the summit. Alta, Utah, USA, [4000x6000]", 
    "OC": true, 
    "url": "non.io/this_is_crazy", 
    "user": {
      "username": "wombodombo",
      "avatar": "images/demo/image-5.jpg"
    },
    "thumbnail": "images/demo/image-12.jpg",
    "score": 148,
    "grade": null,
    "date": "2018-02-14 20:43",
    "content": "img.non.io/fullres/this_is_crazy.jpg",
    "type": "image",
    "tags": [
      {
        "tag": "funny",
        "upvotes": 92,
        "downvotes": 0,
        "date": "2018-02-14 8:43pm"
      },
      {
        "tag": "meme",
        "upvotes": 38,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      },
      {
        "tag": "image",
        "upvotes": 18,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      }
    ]
  }, 
  {
    "title": "So, once upon a time this thing happend. This is a story all about how my life just got turned upside down", 
    "OC": true, 
    "url": "non.io/this_is_crazy", 
    "user": {
      "username": "wombodombo",
      "avatar": "images/demo/image-4.jpg"
    },
    "thumbnail": "images/demo/image-6.jpg",
    "score": 148,
    "grade": null,
    "date": "2018-02-14 20:43",
    "content": "img.non.io/fullres/this_is_crazy.jpg",
    "type": "image",
    "tags": [
      {
        "tag": "funny",
        "upvotes": 92,
        "downvotes": 0,
        "date": "2018-02-14 8:43pm"
      },
      {
        "tag": "meme",
        "upvotes": 38,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      },
      {
        "tag": "image",
        "upvotes": 18,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      }
    ]
  }, 
  {
    "title": "So this is a story all about how my life just got turned upside down", 
    "OC": true, 
    "url": "non.io/this_is_crazy", 
    "user": {
      "username": "wombodombo",
      "avatar": "images/demo/image-4.jpg"
    },
    "thumbnail": "images/demo/image-6.jpg",
    "score": 148,
    "grade": null,
    "date": "2018-02-14 20:43",
    "content": "img.non.io/fullres/this_is_crazy.jpg",
    "type": "image",
    "tags": [
      {
        "tag": "funny",
        "upvotes": 92,
        "downvotes": 0,
        "date": "2018-02-14 8:43pm"
      },
      {
        "tag": "meme",
        "upvotes": 38,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      },
      {
        "tag": "image",
        "upvotes": 18,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      }
    ]
  }, 
  {
    "title": "So this is a story all about how my life just got turned upside down", 
    "OC": true, 
    "url": "non.io/this_is_crazy", 
    "user": {
      "username": "wombodombo",
      "avatar": "images/demo/image-4.jpg"
    },
    "thumbnail": "images/demo/image-6.jpg",
    "score": 148,
    "grade": null,
    "date": "2018-02-14 20:43",
    "content": "img.non.io/fullres/this_is_crazy.jpg",
    "type": "image",
    "tags": [
      {
        "tag": "funny",
        "upvotes": 92,
        "downvotes": 0,
        "date": "2018-02-14 8:43pm"
      },
      {
        "tag": "meme",
        "upvotes": 38,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      },
      {
        "tag": "image",
        "upvotes": 18,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      }
    ]
  }, 
  {
    "title": "So and so gets elected", 
    "OC": true, 
    "url": "non.io/So and so gets elected", 
    "user": {
      "username": "mrWilson",
      "avatar": "images/demo/image-1.jpg"
    },
    "thumbnail": "images/demo/image-8.jpg",
    "score": 132,
    "grade": null,
    "date": "2018-02-14 22:02",
    "content": "Some longform writing content blah blah blah...",
    "type": "blog",
    "tags": [
      {
        "tag": "news",
        "upvotes": 92,
        "downvotes": 0,
        "date": "2018-02-14 10:02pm"
      },
      {
        "tag": "politics",
        "upvotes": 38,
        "downvotes": 0,
        "date": "2018-02-14 10:44pm"
      }
    ]
  }
]


