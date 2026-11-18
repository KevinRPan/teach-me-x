import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createAi } from './ai.js';
import { loadEnvFile } from './env.js';
import { createStore } from './store.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

export function safeStaticPath(root, pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const rootResolved = path.resolve(root);
  const relative = decoded.startsWith('/') ? decoded.slice(1) : decoded;
  const target = path.resolve(rootResolved, relative);
  if (target !== rootResolved && !target.startsWith(`${rootResolved}${path.sep}`)) return null;
  return target;
}

async function readLimitedBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_000) {
      const error = new Error('That request is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function writeNodeResponse(res, response) {
  const headers = {};
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === 'set-cookie') continue;
    headers[key] = value;
  }
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  if (cookies.length > 0) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  return response.arrayBuffer().then((buffer) => {
    res.end(Buffer.from(buffer));
  });
}

async function serveStatic(res, dist, pathname) {
  const target = safeStaticPath(dist, pathname);
  if (!target) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad path');
    return;
  }

  const sendFile = async (file) => {
    const data = await readFile(file);
    const ext = path.extname(file);
    const cache = ext === '.html' || ext === '.webmanifest' ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  };

  try {
    const found = await stat(target);
    if (found.isFile()) {
      await sendFile(target);
      return;
    }
  } catch {
    // Fall through to the single-page app shell for client routes.
  }

  if (path.extname(pathname)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    await sendFile(path.join(dist, 'index.html'));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Build the app first with npm run build.');
  }
}

export function startServer({ port = 8787, serveStaticFiles = false, dist = 'dist' } = {}) {
  loadEnvFile();
  const store = createStore(process.env.DB_PATH || path.join('data', 'companion.sqlite'));
  const ai = createAi();
  const app = createApp({ store, ai });
  const root = path.resolve(dist);

  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || `127.0.0.1:${port}`;
      const requestUrl = new URL(req.url || '/', `http://${host}`);
      if (serveStaticFiles && !requestUrl.pathname.startsWith('/api/')) {
        await serveStatic(res, root, requestUrl.pathname);
        return;
      }
      const body = await readLimitedBody(req);
      const request = new Request(requestUrl, {
        method: req.method,
        headers: req.headers,
        body: body && body.length > 0 ? body : undefined,
      });
      await writeNodeResponse(res, await app(request));
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error(error);
      const message = status === 500 ? 'Something went wrong. Try again.' : error.message;
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: message }));
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const server = startServer({ port, serveStaticFiles: true });
  server.on('listening', () => {
    console.log(`Learning Companion http://127.0.0.1:${port}`);
  });
}
