const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://open.bigmodel.cn/api/anthropic').replace(/\s|`/g, '');
const API_TIMEOUT_MS = process.env.API_TIMEOUT_MS ? Number(process.env.API_TIMEOUT_MS) : 30000;
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';

function redactHeaders(headers) {
  const redacted = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (key.includes('authorization') || key.includes('x-api-key') || key.includes('cookie') || key.includes('token') || key.includes('secret') || key.includes('key')) {
      redacted[k] = '[REDACTED]';
    } else {
      redacted[k] = typeof v === 'string' ? v : String(v);
    }
  }
  return redacted;
}

function redactBody(text) {
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      const clone = JSON.parse(JSON.stringify(obj));
      function walk(o) {
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v && typeof v === 'object') {
            walk(v);
          } else if (typeof v === 'string') {
            const kl = k.toLowerCase();
            if (kl.includes('token') || kl.includes('secret') || kl.includes('key')) {
              o[k] = '[REDACTED]';
            }
          }
        }
      }
      walk(clone);
      return JSON.stringify(clone);
    }
  } catch {}
  return text;
}

function logRequest({ method, url, headers, body }) {
  const now = new Date().toISOString();
  const safeHeaders = redactHeaders(headers || {});
  const safeBody = typeof body === 'string' ? redactBody(body) : body;
  console.log(`[${now}] ${method} ${url}`);
  console.log(`Headers: ${JSON.stringify(safeHeaders)}`);
  if (safeBody && safeBody.length) {
    console.log(`Body: ${safeBody}`);
  }
}

function buildTargetUrl(pathWithPrefix) {
  const p = pathWithPrefix.startsWith('/anthropic/') ? pathWithPrefix.slice('/anthropic/'.length) : pathWithPrefix;
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/${p}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const bodyBuffer = Buffer.concat(chunks);
    const bodyText = bodyBuffer.toString('utf8');
    logRequest({ method: req.method, url: url.pathname + url.search, headers: req.headers, body: bodyText });

    if (!url.pathname.startsWith('/anthropic/')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', hint: 'Use path /anthropic/<...> to proxy' }));
      return;
    }

    const target = buildTargetUrl(url.pathname + url.search);

    const outHeaders = { ...req.headers };
    delete outHeaders.host;
    delete outHeaders['content-length'];
    outHeaders['x-api-key'] = ANTHROPIC_AUTH_TOKEN ? ANTHROPIC_AUTH_TOKEN : outHeaders['x-api-key'];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(target, {
        method: req.method,
        headers: outHeaders,
        body: bodyBuffer.length ? bodyBuffer : undefined,
        signal: controller.signal,
      });

      const respHeaders = {};
      response.headers.forEach((v, k) => {
        respHeaders[k] = v;
      });
      res.writeHead(response.status, respHeaders);
      const respBody = Buffer.from(await response.arrayBuffer());
      res.end(respBody);
    } catch (e) {
      const status = e.name === 'AbortError' ? 504 : 502;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e.message || String(e) }));
    } finally {
      clearTimeout(timer);
    }
  });
});

server.listen(PORT, () => {
  const now = new Date().toISOString();
  console.log(`[${now}] Proxy listening on http://localhost:${PORT}`);
  console.log(`Target base: ${BASE_URL}`);
});

