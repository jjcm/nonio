var proto = {
  init: function(){
    proto.fillImages()
    bind('#posts-list-container', 'click', proto.loadImage)
    contentPane.init()
  },
  fillImages: function(){
    var images = util.getDomArray('.fake-image')
    for(var i = 0; i < images.length; i++){
      images[i].style.backgroundImage = 'url("images/demo/' + Math.floor(Math.random() * 28) + '.jpg")'
    }
  },
  loadImage: function(e){
    var post = util.domInLineage(e.target, {className: 'post'})
    var img = post.querySelector('.fake-image')
    var url = img.style.backgroundImage.replace('url("', '').replace('")', '')

    document.getElementById('post-content').src = url
    contentPane.updateDimensions()
  }
}

var contentPane = {
  init: function(){
    window.addEventListener('resize', contentPane.resize)
    contentPane.updateDimensions()
  },
  contentWidth: 0,
  contentHeight: 0,
  updateDimensions: function(){
    var content = document.getElementById('post-content-container').children[0]
    contentPane.contentWidth = content.width
    contentPane.contentHeight = content.height
    contentPane.resize()
  },
  resize: function(){
    var post = document.getElementById('post')
    var contentY = (post.offsetWidth / contentPane.contentWidth) * contentPane.contentHeight
    if(contentY > post.offsetHeight - 350) {
      contentY = post.offsetHeight - 350
      var contentX = (contentY / contentPane.contentHeight) * contentPane.contentWidth
    }
    var content = document.getElementById('post-content-container')
    content.style.height = contentY
    
  }
}

document.addEventListener('DOMContentLoaded', proto.init)
