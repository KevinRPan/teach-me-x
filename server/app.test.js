import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createAi } from './ai.js';
import { loadEnvFile } from './env.js';
import { createApp } from './app.js';
import { httpError } from './http.js';
import { extractJson, normalizePlan, safeHttpsUrl } from './json.js';
import { safeStaticPath } from './index.js';
import { createStore } from './store.js';

function practiceAi() {
  return {
    sampleMode: true,
    async pathways(profile) {
      return [
        { id: 'path-1', title: `${profile.topic} fundamentals`, learning_goal: 'Learn the shape of it.' },
        { id: 'path-2', title: `Hands-on ${profile.topic}`, learning_goal: 'Make something small.' },
      ];
    },
    async plan(profile) {
      return normalizePlan({
        topic: profile.topic,
        days: Array.from({ length: 7 }, (_, index) => ({
          title: `Day ${index + 1}`,
          steps: [
            { title: 'Read', type: 'article', duration: '10m', detail: 'Read one page.', url: 'http://example.com/nope' },
            { title: 'Try', type: 'exercise', duration: '10m', detail: 'Try it once.', url: 'https://example.com/learn' },
          ],
        })),
      }, profile.topic);
    },
    async revise(plan) {
      const next = structuredClone(plan);
      next.days[0].steps[0].title = 'Revised step';
      return normalizePlan(next, plan.topic);
    },
    async chat(_history, message) {
      return `Noted: ${message}`;
    },
  };
}

async function withApp(run, ai = practiceAi()) {
  const dir = await mkdtemp(path.join(tmpdir(), 'companion-'));
  const store = createStore(path.join(dir, 'test.sqlite'));
  const app = createApp({ store, ai });
  try {
    await run(app);
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
}

function cookieFrom(response) {
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  return cookies[0].split(';')[0];
}

async function post(app, pathname, body, cookie) {
  return app(new Request(`http://127.0.0.1${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body ?? {}),
  }));
}

test('extractJson reads fenced model output and drops unsafe urls', () => {
  const parsed = extractJson('Here you go:\n```json\n{"ok":true,"n":1}\n```');
  assert.deepEqual(parsed, { ok: true, n: 1 });
  assert.equal(safeHttpsUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpsUrl('https://example.com/a'), 'https://example.com/a');
});

test('a phone session can build, resume, check off, and chat', async () => {
  await withApp(async (app) => {
    const created = await post(app, '/api/pathways', {
      profile: {
        topic: "Pottery'); drop table sessions; --",
        level: 'beginner',
        timeCommitment: '30min',
        motivation: 'mugs',
      },
    });
    assert.equal(created.status, 200);
    const cookie = cookieFrom(created);
    const createdBody = await created.json();
    assert.equal(createdBody.profile.topic, "Pottery'); drop table sessions; --");
    assert.equal(createdBody.pathways.length, 2);
    assert.equal(createdBody.sampleMode, true);

    const planned = await post(app, '/api/plan', { pathwayIds: ['path-2'] }, cookie);
    assert.equal(planned.status, 200);
    const draft = await planned.json();
    assert.equal(draft.planStatus, 'draft');
    assert.equal(draft.plan.days.length, 7);
    assert.equal(draft.plan.days[0].steps[0].url, '');
    assert.equal(draft.plan.days[0].steps[1].url, 'https://example.com/learn');

    const resumed = await app(new Request('http://127.0.0.1/api/state', { headers: { cookie } }));
    assert.equal(resumed.headers.getSetCookie().length, 0);
    const resumedBody = await resumed.json();
    assert.equal(resumedBody.plan.topic, draft.plan.topic);
    assert.equal(resumedBody.profile.topic, createdBody.profile.topic);

    const confirmed = await post(app, '/api/plan/confirm', {}, cookie);
    const active = await confirmed.json();
    assert.equal(active.planStatus, 'active');
    assert.equal(active.messages[0].role, 'assistant');

    const toggled = await post(app, '/api/progress', { dayId: 'day-1', stepId: 'd1-s1' }, cookie);
    assert.equal((await toggled.json()).plan.days[0].steps[0].completed, true);

    const chatted = await post(app, '/api/chat', { message: 'What should I do first?' }, cookie);
    const chatBody = await chatted.json();
    assert.equal(chatBody.messages.at(-1).content, 'Noted: What should I do first?');

    const other = await app(new Request('http://127.0.0.1/api/state'));
    const otherCookie = cookieFrom(other);
    assert.notEqual(otherCookie, cookie);
    assert.equal((await other.json()).plan, null);

    const stillThere = await app(new Request('http://127.0.0.1/api/state', { headers: { cookie } }));
    assert.equal((await stillThere.json()).plan.days[0].steps[0].completed, true);
  });
});

test('revision is allowed once, and chat waits until the plan starts', async () => {
  await withApp(async (app) => {
    const created = await post(app, '/api/pathways', {
      profile: { topic: 'Knitting', level: 'intermediate', timeCommitment: '1hr', motivation: '' },
    });
    const cookie = cookieFrom(created);
    await post(app, '/api/plan', { pathwayIds: ['path-1'] }, cookie);

    const chattingEarly = await post(app, '/api/chat', { message: 'hello' }, cookie);
    assert.equal(chattingEarly.status, 400);

    const revised = await post(app, '/api/plan/revise', { feedback: 'More scarves, less history' }, cookie);
    assert.equal(revised.status, 200);
    assert.equal((await revised.json()).plan.days[0].steps[0].title, 'Revised step');

    const again = await post(app, '/api/plan/revise', { feedback: 'Actually more history' }, cookie);
    assert.equal(again.status, 409);
  });
});

test('practice mode builds a full week without a Gemini key', async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const ai = createAi();
    assert.equal(ai.sampleMode, true);
    const profile = { topic: 'Rome', level: 'beginner', timeCommitment: '15min', motivation: 'a trip' };
    const pathways = await ai.pathways(profile);
    const plan = await ai.plan(profile, [pathways[0]]);
    assert.equal(plan.days.length, 7);
    assert.equal(plan.days[0].steps.length, 2);
    const reply = await ai.chat([], 'where do I start?', plan);
    assert.match(reply, /Day 1/);
  } finally {
    if (previous) process.env.GEMINI_API_KEY = previous;
  }
});

test('the server env file fills missing keys and leaves existing ones alone', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'companion-env-'));
  const file = path.join(dir, '.env');
  writeFileSync(file, '# comment\nLC_ENV_PROBE="from-file"\nLC_ENV_KEEP=nope\n');
  const previousProbe = process.env.LC_ENV_PROBE;
  const previousKeep = process.env.LC_ENV_KEEP;
  delete process.env.LC_ENV_PROBE;
  process.env.LC_ENV_KEEP = 'keep';
  try {
    loadEnvFile(file);
    assert.equal(process.env.LC_ENV_PROBE, 'from-file');
    assert.equal(process.env.LC_ENV_KEEP, 'keep');
  } finally {
    if (previousProbe === undefined) delete process.env.LC_ENV_PROBE;
    else process.env.LC_ENV_PROBE = previousProbe;
    if (previousKeep === undefined) delete process.env.LC_ENV_KEEP;
    else process.env.LC_ENV_KEEP = previousKeep;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('signed-in people keep separate weeks and guests are turned away', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'companion-owner-'));
  const store = createStore(path.join(dir, 'test.sqlite'));
  const app = createApp({
    store,
    ai: practiceAi(),
    identify: async (request) => request.headers.get('x-test-owner'),
  });
  try {
    const saved = await app(new Request('http://127.0.0.1/api/pathways', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-owner': 'local:person-a',
      },
      body: JSON.stringify({
        profile: { topic: 'Pottery', level: 'beginner', timeCommitment: '30min', motivation: '' },
      }),
    }));
    assert.equal(saved.status, 200);

    const other = await app(new Request('http://127.0.0.1/api/state', {
      headers: { 'x-test-owner': 'local:person-b' },
    }));
    assert.equal((await other.json()).profile, null);

    const again = await app(new Request('http://127.0.0.1/api/state', {
      headers: { 'x-test-owner': 'local:person-a' },
    }));
    assert.equal((await again.json()).profile.topic, 'Pottery');

    const guest = await app(new Request('http://127.0.0.1/api/state'));
    assert.equal(guest.status, 401);
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('oversized bodies and path traversal are refused', async () => {
  await withApp(async (app) => {
    const response = await app(new Request('http://127.0.0.1/api/pathways', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { topic: 'x'.repeat(40_000) } }),
    }));
    assert.equal(response.status, 413);
  });

  const root = path.resolve('public');
  assert.equal(safeStaticPath(root, '/vite.svg'), path.join(root, 'vite.svg'));
  assert.equal(safeStaticPath(root, '/../server/app.js'), null);
  assert.equal(safeStaticPath(root, '/%2e%2e/package.json'), null);
});

async function activeWeek(app) {
  const created = await post(app, '/api/pathways', {
    profile: { topic: 'Pottery', level: 'beginner', timeCommitment: '30min', motivation: 'mugs for the trip' },
  });
  const cookie = cookieFrom(created);
  await post(app, '/api/plan', { pathwayIds: ['path-1'] }, cookie);
  await post(app, '/api/plan/confirm', {}, cookie);
  return cookie;
}

test('a step opens into a lesson you can answer and finish', async () => {
  await withApp(async (app) => {
    const created = await post(app, '/api/pathways', {
      profile: { topic: 'Pottery', level: 'beginner', timeCommitment: '30min', motivation: 'mugs' },
    });
    const cookie = cookieFrom(created);
    await post(app, '/api/plan', { pathwayIds: ['path-1'] }, cookie);
    const tooSoon = await post(app, '/api/lesson', { dayId: 'day-1', stepId: 'd1-s1' }, cookie);
    assert.equal(tooSoon.status, 400);

    await post(app, '/api/plan/confirm', {}, cookie);
    const opened = await post(app, '/api/lesson', { dayId: 'day-1', stepId: 'd1-s1' }, cookie);
    assert.equal(opened.status, 200);
    const step = (await opened.json()).plan.days[0].steps[0];
    assert.equal(step.lesson.source, 'sample');
    assert.ok(step.lesson.blocks.length >= 1);
    assert.equal(step.lesson.prompts[0].id, 'p1');
    assert.equal(step.completed, false);

    const saved = await post(app, '/api/lesson', {
      dayId: 'day-1',
      stepId: 'd1-s1',
      notes: { p1: 'Center the clay.', nope: 'drop me', p9: 'also drop' },
      picks: { q9: 1 },
      complete: true,
    }, cookie);
    const done = (await saved.json()).plan.days[0].steps[0];
    assert.equal(done.completed, true);
    assert.deepEqual(done.notes, { p1: 'Center the clay.' });
    assert.equal(done.lesson.lead, step.lesson.lead);

    const kept = await post(app, '/api/lesson', {
      dayId: 'day-1',
      stepId: 'd1-s1',
      notes: { p1: 'Center the clay.' },
    }, cookie);
    assert.equal((await kept.json()).plan.days[0].steps[0].completed, true);

    const missing = await post(app, '/api/lesson', { dayId: 'day-1', stepId: 'd1-s9' }, cookie);
    assert.equal(missing.status, 404);
    const bad = await post(app, '/api/lesson', { dayId: 'day-1', stepId: 'nope' }, cookie);
    assert.equal(bad.status, 400);
  });
});

test('a written lesson is kept, refreshed, and not replaced when the model is out of quota', async () => {
  let calls = 0;
  const ai = {
    ...practiceAi(),
    sampleMode: false,
    async lesson() {
      calls += 1;
      if (calls === 3) {
        throw httpError(502, 'Gemini is out of quota for this key. Check the key in Google AI Studio, then try again.');
      }
      return {
        lead: `Lesson ${calls}`,
        blocks: [{ heading: 'Point', body: 'Use one small piece of pottery and notice what your hands do.' }],
        prompts: [{ label: 'What did your hands do?' }],
        checks: [],
      };
    },
  };

  await withApp(async (app) => {
    const cookie = await activeWeek(app);
    const firstBody = await (await post(app, '/api/lesson', { dayId: 'day-1', stepId: 'd1-s2' }, cookie)).json();
    assert.equal(firstBody.plan.days[0].steps[1].lesson.lead, 'Lesson 1');
    assert.equal(firstBody.plan.days[0].steps[1].lesson.source, 'model');

    const again = await post(app, '/api/lesson', { dayId: 'day-1', stepId: 'd1-s2' }, cookie);
    assert.equal((await again.json()).plan.days[0].steps[1].lesson.lead, 'Lesson 1');
    assert.equal(calls, 1);

    const refreshed = await post(app, '/api/lesson', {
      dayId: 'day-1',
      stepId: 'd1-s2',
      refresh: true,
      notes: { p1: 'They slipped.' },
    }, cookie);
    const step = (await refreshed.json()).plan.days[0].steps[1];
    assert.equal(step.lesson.lead, 'Lesson 2');
    assert.deepEqual(step.notes, { p1: 'They slipped.' });

    const blocked = await post(app, '/api/lesson', {
      dayId: 'day-1',
      stepId: 'd1-s2',
      refresh: true,
    }, cookie);
    assert.equal(blocked.status, 502);
    const still = await app(new Request('http://127.0.0.1/api/state', { headers: { cookie } }));
    const kept = (await still.json()).plan.days[0].steps[1];
    assert.equal(kept.lesson.lead, 'Lesson 2');
    assert.deepEqual(kept.notes, { p1: 'They slipped.' });
  }, ai);
});
