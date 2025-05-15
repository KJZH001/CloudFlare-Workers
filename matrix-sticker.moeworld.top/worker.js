const AUTHORIZATION_TOKEN = 'syt_1234567890'; // 在这里填入你的Authorization值

async function handleRequest(request) {
  // 获取请求的 URL
  const url = new URL(request.url);

  // 检查请求路径是否匹配
  if (url.hostname === 'matrix-sticker.moeworld.top' && url.pathname.startsWith('/_matrix/media/v3/thumbnail/')) {
  // if (url.hostname === 'matrix-sticker.moeworld.workers.dev' && url.pathname.startsWith('/_matrix/media/v3/thumbnail/')) {
    // 修改路径和域名
    const newHostname = 'matrix.moeworld.top';
    const newPathname = url.pathname.replace('/_matrix/media/v3/thumbnail/', '/_matrix/client/v1/media/thumbnail/');

    // 创建新的 URL
    const newUrl = new URL(url);
    newUrl.hostname = newHostname;
    newUrl.pathname = newPathname;

    // 构建新的请求头，包括 Authorization
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${AUTHORIZATION_TOKEN}`);

    // 添加 Cloudflare 的缓存选项 
    // 使 Cloudflare 在边缘节点缓存内容 30 天，以免synapse反应不过来
    // cacheEverything: true 会缓存所有类型响应
    // cacheTtl: 2592000 (30 天)
    const modifiedRequest = new Request(newUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      cf: {
        cacheEverything: true,
        cacheTtl: 2592000
      }
    });

    // 发起代理请求
    const response = await fetch(modifiedRequest);

    // 创建一个新的 Response，并设置 Browser 缓存头，缓存 30 天
    // (public, max-age=2592000, immutable)
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cache-Control', 'public, max-age=2592000, immutable');

    // 返回新的响应对象
    return newResponse;
  }

  // 如果不匹配路径，返回一个 404 错误
  return new Response('Not Found', { status: 404 });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
