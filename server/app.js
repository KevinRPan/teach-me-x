import { httpError } from './http.js';
import { emptyState } from './state.js';

const COOKIE = 'lc_session';
const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const TIMES = new Set(['15min', '30min', '1hr', '2hr+']);
const HOUR = 60 * 60 * 1000;
const AI_LIMIT = 40;

const buckets = new Map();

function clip(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function readCookie(request) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function sessionCookie(id, secure) {
  const parts = [
    `${COOKIE}=${id}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=31536000',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function json(status, body, cookies = []) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 32_000) throw httpError(413, 'That request is too large.');
  const text = await request.text();
  if (text.length > 32_000) throw httpError(413, 'That request is too large.');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw httpError(400, 'Send a JSON object.');
    }
    return parsed;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(400, 'Send JSON.');
  }
}

function cleanProfile(input) {
  const topic = clip(input?.topic, 80);
  if (topic.length < 2) throw httpError(400, 'Tell me what you want to learn.');
  const level = clip(input?.level, 20).toLowerCase();
  const timeCommitment = clip(input?.timeCommitment, 8);
  if (!LEVELS.has(level)) throw httpError(400, 'Pick a level.');
  if (!TIMES.has(timeCommitment)) throw httpError(400, 'Pick how much time you have.');
  return {
    topic,
    level,
    timeCommitment,
    motivation: clip(input?.motivation, 400),
  };
}

function clientAddress(request) {
  return clip(request.headers.get('cf-connecting-ip') || '', 64);
}

function charge(sessionId, now, address = '') {
  const keys = address ? [sessionId, `ip:${address}`] : [sessionId];
  for (const key of keys) {
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start > HOUR) {
      buckets.set(key, { start: now, count: 1 });
      continue;
    }
    bucket.count += 1;
    if (bucket.count > AI_LIMIT) {
      throw httpError(429, 'Too many requests this hour. Take a break and try again.');
    }
  }
  while (buckets.size > 5000) {
    const oldest = buckets.keys().next().value;
    buckets.delete(oldest);
  }
}

function toggleStep(plan, dayId, stepId) {
  if (!/^day-\d+$/.test(dayId) || !/^d\d+-s\d+$/.test(stepId)) {
    throw httpError(400, 'That step is not in this plan.');
  }
  let found = false;
  const days = plan.days.map((day) => {
    if (day.id !== dayId) return day;
    return {
      ...day,
      steps: day.steps.map((step) => {
        if (step.id !== stepId) return step;
        found = true;
        return { ...step, completed: !step.completed };
      }),
    };
  });
  if (!found) throw httpError(404, 'That step is not in this plan.');
  return { ...plan, days };
}

function viewState(state, sampleMode) {
  return {
    sampleMode,
    profile: state.profile,
    pathways: state.pathways,
    selectedPathways: state.selectedPathways,
    plan: state.plan,
    planStatus: state.planStatus,
    hasRevised: state.hasRevised,
    messages: state.messages,
  };
}

const GREETING = "Hi! I'm your learning companion. Ask about today's step, or tell me where you're stuck.";

export function createApp({ store, ai, now = () => Date.now(), identify, practiceGuests = false }) {
  return async function app(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    let sessionId = '';
    let cookie = '';

    try {
      if (!pathname.startsWith('/api/')) {
        return json(404, { error: 'Not found.' });
      }

      if (identify) {
        sessionId = await identify(request);
        if (sessionId) {
          await store.ensure(sessionId);
        } else if (!practiceGuests) {
          return json(401, { error: 'Sign in to open your week.' });
        } else {
          const existing = readCookie(request);
          if (await store.hasSession(existing)) {
            sessionId = existing;
          } else {
            sessionId = await store.createSession();
            const secure = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
            cookie = sessionCookie(sessionId, secure);
          }
        }
      } else {
        const existing = readCookie(request);
        if (await store.hasSession(existing)) {
          sessionId = existing;
        } else {
          sessionId = await store.createSession();
          const secure = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
          cookie = sessionCookie(sessionId, secure);
        }
      }

      const method = request.method.toUpperCase();
      const state = await store.read(sessionId);
      const cookies = cookie ? [cookie] : [];

      if (method === 'GET' && pathname === '/api/state') {
        return json(200, viewState(state, ai.sampleMode), cookies);
      }

      if (method !== 'POST') throw httpError(405, 'Method not allowed.');

      if (pathname === '/api/reset') {
        await store.write(sessionId, emptyState());
        return json(200, viewState(emptyState(), ai.sampleMode), cookies);
      }

      const body = pathname === '/api/plan/confirm' ? {} : await readJson(request);

      if (pathname === '/api/pathways') {
        if (state.planStatus === 'active') {
          throw httpError(409, 'Reset your plan before starting another.');
        }
        const profile = cleanProfile(body.profile);
        charge(sessionId, now(), clientAddress(request));
        const pathways = await ai.pathways(profile);
        const next = {
          ...emptyState(),
          profile,
          pathways,
        };
        await store.write(sessionId, next);
        return json(200, viewState(next, ai.sampleMode), cookies);
      }

      if (pathname === '/api/plan') {
        if (!state.profile || state.pathways.length === 0) {
          throw httpError(400, 'Choose a topic before building a plan.');
        }
        if (state.planStatus === 'active') {
          throw httpError(409, 'Reset your plan before starting another.');
        }
        const ids = Array.isArray(body.pathwayIds) ? body.pathwayIds.filter((id) => typeof id === 'string') : [];
        const selected = state.pathways.filter((path) => ids.includes(path.id));
        if (selected.length === 0 || selected.length > 4) {
          throw httpError(400, 'Pick at least one direction.');
        }
        charge(sessionId, now(), clientAddress(request));
        const plan = await ai.plan(state.profile, selected);
        const next = {
          ...state,
          selectedPathways: selected,
          plan,
          planStatus: 'draft',
          hasRevised: false,
          messages: [],
        };
        await store.write(sessionId, next);
        return json(200, viewState(next, ai.sampleMode), cookies);
      }

      if (pathname === '/api/plan/revise') {
        if (!state.plan || state.planStatus !== 'draft') {
          throw httpError(400, 'There is no draft plan to revise.');
        }
        if (state.hasRevised) throw httpError(409, 'This plan was already revised once.');
        const feedback = clip(body.feedback, 600);
        if (feedback.length < 4) throw httpError(400, 'Say a little more about what to change.');
        charge(sessionId, now(), clientAddress(request));
        const plan = await ai.revise(state.plan, state.profile, feedback);
        const next = { ...state, plan, hasRevised: true };
        await store.write(sessionId, next);
        return json(200, viewState(next, ai.sampleMode), cookies);
      }

      if (pathname === '/api/plan/confirm') {
        if (!state.plan || state.planStatus !== 'draft') {
          throw httpError(400, 'There is no plan to start.');
        }
        const next = {
          ...state,
          planStatus: 'active',
          messages: state.messages.length > 0 ? state.messages : [{ role: 'assistant', content: GREETING }],
        };
        await store.write(sessionId, next);
        return json(200, viewState(next, ai.sampleMode), cookies);
      }

      if (pathname === '/api/progress') {
        if (!state.plan || state.planStatus !== 'active') {
          throw httpError(400, 'Start the plan before checking steps off.');
        }
        const plan = toggleStep(state.plan, body.dayId, body.stepId);
        const next = { ...state, plan };
        await store.write(sessionId, next);
        return json(200, viewState(next, ai.sampleMode), cookies);
      }

      if (pathname === '/api/chat') {
        if (!state.plan || state.planStatus !== 'active') {
          throw httpError(400, 'Start the plan before chatting.');
        }
        const message = clip(body.message, 2000);
        if (!message) throw httpError(400, 'Write a message first.');
        charge(sessionId, now(), clientAddress(request));
        const reply = String(await ai.chat(state.messages, message, state.plan)).trim().slice(0, 8000);
        if (!reply) throw httpError(502, 'The model returned an empty reply. Try again.');
        const messages = [
          ...state.messages,
          { role: 'user', content: message },
          { role: 'assistant', content: reply },
        ].slice(-80);
        const next = { ...state, messages };
        await store.write(sessionId, next);
        return json(200, viewState(next, ai.sampleMode), cookies);
      }

      throw httpError(404, 'Not found.');
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error(error instanceof Error ? error.message : 'request failed');
      const message = status === 500 ? 'Something went wrong. Try again.' : error.message;
      return json(status, { error: message }, cookie ? [cookie] : []);
    }
  };
}
