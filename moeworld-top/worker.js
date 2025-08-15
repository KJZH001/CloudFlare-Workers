// Website you intended to retrieve for users.
const upstream = 'doc-mc.moeworld.top'

// Custom pathname for the upstream website.
const upstream_path = '/'

// Website you intended to retrieve for users using mobile devices.
const upstream_mobile = 'doc-mc.moeworld.top'

// Countries and regions where you wish to suspend your service.
const blocked_region = [ 'KP', 'SY', 'PK', 'CU']

// IP addresses which you wish to block from using your service.
const blocked_ip_address = ['0.0.0.0', '127.0.0.1']

// Whether to use HTTPS protocol for upstream address.
const https = true

// Whether to disable cache.
const disable_cache = false

// Replace texts.
const replace_dict = {
    //'$upstream': '$custom_domain',
    //'//google.com': ''
}

// -------- NEW: well-known JSON 常量（注意无尾斜杠） --------
const WELLKNOWN_CLIENT = {
  "m.homeserver": { "base_url": "https://matrix.moeworld.top" }
}
// （可选）若需要联邦 delegation，再开启下面这行：
const WELLKNOWN_SERVER = { "m.server": "matrix.moeworld.top:443" }

addEventListener('fetch', event => {
  event.respondWith(fetchAndApply(event.request));
})

async function fetchAndApply(request) {
  const region = (request.headers.get('cf-ipcountry') || '').toUpperCase();
  const ip_address = request.headers.get('cf-connecting-ip') || '';
  const user_agent = request.headers.get('user-agent') || '';

  let url = new URL(request.url);

  // -------- NEW: 优先拦截 .well-known 路由并立即返回 JSON --------
  if (url.pathname === '/.well-known/matrix/client') {
    return handleWellKnownJSON(request, WELLKNOWN_CLIENT); // NEW
  }
  // （可选）若要同时提供 /.well-known/matrix/server，取消下一行注释：
  if (url.pathname === '/.well-known/matrix/server') { return handleWellKnownJSON(request, WELLKNOWN_SERVER); }

  // 其余请求维持你的原代理逻辑
  if (https === true) url.protocol = 'https:';
  else url.protocol = 'http:';

  // 你的脚本里 device_status 的 true/false 语义有点反直觉，这里按原样保留
  let upstream_domain = (await device_status(user_agent)) ? upstream : upstream_mobile;

  const url_hostname = url.hostname;
  url.host = upstream_domain;
  if (url.pathname === '/') url.pathname = upstream_path;
  else url.pathname = upstream_path + url.pathname;

  // 地域/IP 拦截（注意：.well-known 已在上面提前返回，不受拦截影响）
  if (blocked_region.includes(region)) {
    return new Response('Access denied: WorkersProxy is not available in your region yet.', { status: 403 });
  }
  if (blocked_ip_address.includes(ip_address)) {
    return new Response('Access denied: Your IP address is blocked by WorkersProxy.', { status: 403 });
  }

  // 继续走原来的反代
  let method = request.method;
  let new_request_headers = new Headers(request.headers);
  new_request_headers.set('Host', upstream_domain);
  new_request_headers.set('Referer', url.protocol + '//' + url_hostname);

  let original_response = await fetch(url.href, { method, headers: new_request_headers });

  const connection_upgrade = new_request_headers.get("Upgrade");
  if (connection_upgrade && connection_upgrade.toLowerCase() === "websocket") {
    return original_response;
  }

  let original_response_clone = original_response.clone();
  let response_headers = new Headers(original_response.headers);
  let status = original_response.status;

  if (disable_cache) response_headers.set('Cache-Control', 'no-store');

  // 保守放开 CORS（原脚本保留）
  response_headers.set('access-control-allow-origin', '*');
  response_headers.set('access-control-allow-credentials', 'true');
  response_headers.delete('content-security-policy');
  response_headers.delete('content-security-policy-report-only');
  response_headers.delete('clear-site-data');

  if (response_headers.get("x-pjax-url")) {
    response_headers.set("x-pjax-url", original_response.headers.get("x-pjax-url").replace("//" + upstream_domain, "//" + url_hostname));
  }

  const content_type = response_headers.get('content-type');
  let body;
  if (content_type && content_type.includes('text/html') && content_type.includes('UTF-8')) {
    body = await replace_response_text(original_response_clone, upstream_domain, url_hostname);
  } else {
    body = original_response_clone.body;
  }

  return new Response(body, { status, headers: response_headers });
}

// -------- NEW: 专门处理 .well-known JSON（含 CORS/缓存/预检） --------
function handleWellKnownJSON(request, payloadObj) {
  const h = new Headers({
    'content-type': 'application/json; charset=utf-8',
    // Matrix 规范建议 .well-known 提供 CORS
    'access-control-allow-origin': '*',                 // NEW
    'access-control-allow-credentials': 'true',         // NEW
    // 适度缓存，减少请求量；改动频率很低
    'cache-control': 'public, max-age=300, s-maxage=300' // NEW
  });

  if (request.method === 'OPTIONS') {
    h.set('access-control-allow-methods', 'GET,HEAD,OPTIONS');
    h.set('access-control-allow-headers', request.headers.get('access-control-request-headers') || '*');
    return new Response(null, { status: 204, headers: h });
  }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: h });
  }
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: h });
  }
  return Response.json(payloadObj, { headers: h });
}

async function replace_response_text(response, upstream_domain, host_name) {
  let text = await response.text()
  for (const iRaw in replace_dict) {
    let i = iRaw, j = replace_dict[iRaw];
    if (i === '$upstream') i = upstream_domain;
    else if (i === '$custom_domain') i = host_name;
    if (j === '$upstream') j = upstream_domain;
    else if (j === '$custom_domain') j = host_name;
    let re = new RegExp(i, 'g');
    text = text.replace(re, j);
  }
  return text;
}

async function device_status(user_agent_info) {
  var agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
  var flag = true;
  for (var v = 0; v < agents.length; v++) {
    if (user_agent_info.indexOf(agents[v]) > 0) { flag = false; break; }
  }
  return flag;
}
