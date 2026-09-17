import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const host = '127.0.0.1';
const port = 4173;
const root = process.cwd();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp'
};

async function existingFile(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const candidate = path.resolve(root, `.${pathname}`);

    if (!candidate.startsWith(root + path.sep) && candidate !== root) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    let filePath = pathname === '/' ? path.join(root, 'index.html') : await existingFile(candidate);

    if (!filePath && path.extname(pathname) === '') {
      filePath = path.join(root, 'index.html');
    }

    if (!filePath) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const body = await readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentType
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Test server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`Groovy test server listening on http://${host}:${port}`);
});
