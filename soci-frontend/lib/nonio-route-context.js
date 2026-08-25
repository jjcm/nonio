export default class NonioRouteContext {
  static get community() {
    let path = window.location.pathname
    let match = path.match(/^\/@([\w-]+)/)
    return match ? match[1] : null
  }

  static get path() {
    return window.location.pathname
  }
}

