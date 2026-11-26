import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createApp } from './app.js';
import { createD1Store } from './d1-store.js';
import { createRestAi } from './gemini-rest.js';
import worker from '../worker/index.js';

function memoryD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../d1/0001_learner.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...params) {
          return {
            async first() {
              return statement.get(...params) ?? null;
            },
            async run() {
              statement.run(...params);
              return { success: true };
            },
          };
        },
      };
    },
  };
}

test('a D1 week stays on its cookie and a second browser starts empty', async () => {
  const app = createApp({ store: createD1Store(memoryD1()), ai: createRestAi('') });
  const saved = await app(new Request('http://phone.test/api/pathways', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      profile: {
        topic: 'Pottery',
        level: 'beginner',
        timeCommitment: '30min',
        motivation: 'a bowl',
      },
    }),
  }));
  assert.equal(saved.status, 200);
  const cookie = saved.headers.get('set-cookie').split(';')[0];
  const again = await app(new Request('http://phone.test/api/state', { headers: { cookie } }));
  const body = await again.json();
  assert.equal(body.profile.topic, 'Pottery');
  assert.equal(body.sampleMode, true);

  const other = await app(new Request('http://phone.test/api/state'));
  const fresh = await other.json();
  assert.equal(fresh.profile, null);
});

test('the worker serves the phone shell and refuses an unsigned API call', async () => {
  const env = {
    DB: memoryD1(),
    ASSETS: {
      async fetch() {
        return new Response('phone shell', { headers: { 'content-type': 'text/html' } });
      },
    },
  };
  const page = await worker.fetch(new Request('https://learning-companion.example/plan'), env);
  assert.equal(await page.text(), 'phone shell');

  const state = await worker.fetch(new Request('https://learning-companion.example/api/state'), env);
  assert.equal(state.status, 401);
  const denied = await state.json();
  assert.equal(denied.error, 'Sign in to open your week.');

  const spent = await worker.fetch(new Request('https://learning-companion.example/api/pathways', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      profile: { topic: 'Pottery', level: 'beginner', timeCommitment: '30min', motivation: '' },
    }),
  }), env);
  assert.equal(spent.status, 401);
  const sessions = await env.DB.prepare('select count(*) as n from sessions').bind().first();
  assert.equal(sessions.n, 0);
});
