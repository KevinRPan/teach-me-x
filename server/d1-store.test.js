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

test('the worker serves the phone shell and a practice week without Cursor sign-in', async () => {
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
  assert.equal(state.status, 200);
  const body = await state.json();
  assert.equal(body.sampleMode, true);
  assert.match(state.headers.get('set-cookie'), /lc_session=/);

  const spent = await worker.fetch(new Request('https://learning-companion.example/api/pathways', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: state.headers.get('set-cookie').split(';')[0] },
    body: JSON.stringify({
      profile: { topic: 'Pottery', level: 'beginner', timeCommitment: '30min', motivation: '' },
    }),
  }), env);
  assert.equal(spent.status, 200);
  assert.equal((await spent.json()).sampleMode, true);
});

test('the worker leaves practice mode when the Gemini key is set', async () => {
  const env = {
    DB: memoryD1(),
    GEMINI_API_KEY: 'present',
    ASSETS: { async fetch() { return new Response('phone shell'); } },
  };
  const state = await worker.fetch(new Request('https://learning-companion.example/api/state'), env);
  assert.equal(state.status, 200);
  assert.equal((await state.json()).sampleMode, false);
});

test('a phone guest can use a live model without Cursor sign-in', async () => {
  const app = createApp({
    store: createD1Store(memoryD1()),
    ai: {
      sampleMode: false,
      async pathways() { throw new Error('not called'); },
      async plan() { throw new Error('not called'); },
      async revise() { throw new Error('not called'); },
      async chat() { throw new Error('not called'); },
    },
    identify: async () => null,
    practiceGuests: true,
  });
  const state = await app(new Request('http://phone.test/api/state'));
  assert.equal(state.status, 200);
  assert.equal((await state.json()).sampleMode, false);
});

test('a signed-out caller is refused when the host does not allow guests', async () => {
  const app = createApp({
    store: createD1Store(memoryD1()),
    ai: {
      sampleMode: false,
      async pathways() { throw new Error('not called'); },
      async plan() { throw new Error('not called'); },
      async revise() { throw new Error('not called'); },
      async chat() { throw new Error('not called'); },
    },
    identify: async () => null,
  });
  const state = await app(new Request('http://phone.test/api/state'));
  assert.equal(state.status, 401);
});

test('callers who drop the cookie still share an hourly limit for one address', async () => {
  let calls = 0;
  const app = createApp({
    store: createD1Store(memoryD1()),
    ai: {
      sampleMode: false,
      async pathways() {
        calls += 1;
        return [{ id: 'path-1', title: 'Basics', learning_goal: 'Start.' }];
      },
      async plan() { throw new Error('not called'); },
      async revise() { throw new Error('not called'); },
      async chat() { throw new Error('not called'); },
    },
    identify: async () => null,
    practiceGuests: true,
  });
  const body = JSON.stringify({
    profile: { topic: 'Pottery', level: 'beginner', timeCommitment: '30min', motivation: '' },
  });
  let limited = 0;
  for (let i = 0; i < 45; i += 1) {
    const response = await app(new Request('http://phone.test/api/pathways', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
      body,
    }));
    if (response.status === 429) limited += 1;
  }
  assert.equal(calls, 40);
  assert.equal(limited, 5);
});
