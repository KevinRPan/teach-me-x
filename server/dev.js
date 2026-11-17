import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './index.js';

const apiPort = Number(process.env.API_PORT || 8787);
const webPort = Number(process.env.PORT || 5173);
const server = startServer({ port: apiPort, serveStaticFiles: false });

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`API port ${apiPort} is already in use.`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

server.on('listening', () => {
  console.log(`API http://127.0.0.1:${apiPort}`);
});

const viteBin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/vite/bin/vite.js');
const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
  stdio: 'inherit',
  env: process.env,
});

function shutdown(code = 0) {
  if (!vite.killed) vite.kill('SIGTERM');
  server.close();
  process.exit(code);
}

vite.on('exit', (code) => {
  server.close();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
