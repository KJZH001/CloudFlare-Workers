addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    const url = new URL(request.url)
    // 构建新的 URL，替换主机名为 blog.moeworld.tech
    url.hostname = 'project.moeworld.tech'
    // 返回 301 重定向响应
    return Response.redirect(url.toString(), 301)
  }
  