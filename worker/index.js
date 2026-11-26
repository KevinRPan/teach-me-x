import { createApp } from '../server/app.js';
import { createD1Store } from '../server/d1-store.js';
import { createRestAi } from '../server/gemini-rest.js';
import { viewerOwner } from '../server/viewer.js';
import { serveShell } from './shell.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const app = createApp({
        store: createD1Store(env.DB),
        ai: createRestAi(env.GEMINI_API_KEY),
        identify: viewerOwner,
      });
      return app(request);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return serveShell(request);
  },
};
