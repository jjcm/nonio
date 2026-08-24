export function filterToType(filter) {
  if (!filter || filter === 'all') return ''
  switch (filter) {
    case 'images': return 'image'
    case 'videos': return 'video'
    case 'blogs': return 'blog'
    case 'links': return 'link'
    case 'audio': return 'audio'
    default: return filter
  }
}


