import { createAi } from './ai.js';
import { createApp } from './app.js';
import { createPgStore } from './pg-store.js';
import { viewerOwner } from './viewer.js';

let app;

export function handle(request) {
  app ??= createApp({
    store: createPgStore(),
    ai: createAi(),
    identify: viewerOwner,
  });
  return app(request);
}
