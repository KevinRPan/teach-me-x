import { httpError } from './http.js';
import { emptyState } from './state.js';
import {
  acceptLesson,
  backupLesson,
  cleanWork,
  findStep,
  lessonErrorBlocks,
  mockLesson,
  validStepAddress,
  writeStep,
} from './lesson.js';
import {
  activateCourse,
  appendActivity,
  courseSummary,
  ensureCourses,
  leaveActive,
  mockFeed,
  normalizeFeed,
  rememberActive,
  shelveActive,
  topicSeeds,
} from './library.js';

const COOKIE = 'lc_session';
const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const TIMES = new Set(['15min', '30min', '1hr', '2hr+']);
const HOUR = 60 * 60 * 1000;
const AI_LIMIT = 40;

const buckets = new Map();
const lessonFlights = new Map();

function singleFlight(key, fn) {
  const existing = lessonFlights.get(key);
  if (existing) return existing;
  const promise = Promise.resolve().then(fn).finally(() => {
    if (lessonFlights.get(key) === promise) lessonFlights.delete(key);
  });
  lessonFlights.set(key, promise);
  return promise;
}

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
  const ready = ensureCourses(state);
  return {
    sampleMode,
    profile: ready.profile,
    pathways: ready.pathways,
    selectedPathways: ready.selectedPathways,
    plan: ready.plan,
    planStatus: ready.planStatus,
    hasRevised: ready.hasRevised,
    messages: ready.messages,
    activeCourseId: ready.activeCourseId,
    pausedCourseId: ready.pausedCourseId || null,
    courses: (ready.courses || []).map(courseSummary),
    feed: ready.feed || [],
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
      const loaded = await store.read(sessionId);
      let state = ensureCourses(loaded);
      const cookies = cookie ? [cookie] : [];
      const gainedCourse = state.activeCourseId !== loaded.activeCourseId
        || (state.courses || []).length !== (loaded.courses || []).length;
      if (gainedCourse) await store.write(sessionId, state);

      const persist = async (next) => {
        const ready = rememberActive(ensureCourses(next));
        await store.write(sessionId, ready);
        return ready;
      };

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
          courses: state.courses,
          feed: state.feed,
          pausedCourseId: state.pausedCourseId,
          profile,
          pathways,
        };
        const saved = await persist(next);
        return json(200, viewState(saved, ai.sampleMode), cookies);
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
        const saved = await persist(next);
        return json(200, viewState(saved, ai.sampleMode), cookies);
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
        const saved = await persist(next);
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/plan/confirm') {
        if (!state.plan || state.planStatus !== 'draft') {
          throw httpError(400, 'There is no plan to start.');
        }
        const next = {
          ...state,
          planStatus: 'active',
          pausedCourseId: null,
          messages: state.messages.length > 0 ? state.messages : [{ role: 'assistant', content: GREETING }],
        };
        const saved = await persist(next);
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/progress') {
        if (!state.plan || state.planStatus !== 'active') {
          throw httpError(400, 'Start the plan before checking steps off.');
        }
        const plan = toggleStep(state.plan, body.dayId, body.stepId);
        const saved = await persist({ ...state, plan });
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/lesson') {
        if (!state.plan || state.planStatus !== 'active') {
          throw httpError(400, 'Start the plan before opening a step.');
        }
        if (!validStepAddress(body.dayId, body.stepId)) {
          throw httpError(400, 'That step is not in this plan.');
        }
        if (body.notes !== undefined && (!body.notes || typeof body.notes !== 'object' || Array.isArray(body.notes))) {
          throw httpError(400, 'Notes should be an object.');
        }
        if (body.picks !== undefined && (!body.picks || typeof body.picks !== 'object' || Array.isArray(body.picks))) {
          throw httpError(400, 'Answers should be an object.');
        }
        const located = findStep(state.plan, body.dayId, body.stepId);
        if (!located.step) throw httpError(404, 'That step is not in this plan.');

        const produce = async () => {
          if (!ai.sampleMode) charge(sessionId, now(), clientAddress(request));
          try {
            if (typeof ai.lesson === 'function') {
              const created = acceptLesson(await ai.lesson(state.profile, state.plan, located.day, located.step));
              if (created) return created;
            }
          } catch (error) {
            if (lessonErrorBlocks(error)) throw error;
            console.error(error instanceof Error ? error.message : 'lesson failed');
          }
          return ai.sampleMode
            ? mockLesson(state.profile, state.plan, located.day, located.step)
            : backupLesson(state.profile, state.plan, located.day, located.step);
        };

        const lesson = located.step.lesson && body.refresh !== true
          ? located.step.lesson
          : await (body.refresh === true
            ? produce()
            : singleFlight(`${sessionId}:${body.dayId}:${body.stepId}`, produce));

        const fresh = await store.read(sessionId);
        if (!fresh.plan || fresh.planStatus !== 'active') {
          throw httpError(400, 'Start the plan before opening a step.');
        }
        const current = findStep(fresh.plan, body.dayId, body.stepId);
        if (!current.step) throw httpError(404, 'That step is not in this plan.');

        const patch = {};
        if (!current.step.lesson || body.refresh === true) patch.lesson = lesson;
        const lessonForWork = patch.lesson || current.step.lesson;
        if (body.notes !== undefined || body.picks !== undefined) {
          const work = cleanWork(
            lessonForWork,
            body.notes !== undefined ? body.notes : current.step.notes,
            body.picks !== undefined ? body.picks : current.step.picks,
          );
          if (body.notes !== undefined) patch.notes = work.notes;
          if (body.picks !== undefined) patch.picks = work.picks;
        }
        if (body.complete === true) patch.completed = true;

        const plan = Object.keys(patch).length
          ? writeStep(fresh.plan, body.dayId, body.stepId, patch)
          : fresh.plan;
        const next = {
          ...fresh,
          plan,
          courses: fresh.courses?.length ? fresh.courses : state.courses,
          feed: fresh.feed?.length ? fresh.feed : state.feed,
          activeCourseId: fresh.activeCourseId || state.activeCourseId,
        };
        const saved = Object.keys(patch).length ? await persist(next) : next;
        return json(200, viewState(saved, ai.sampleMode), cookies);
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
        const saved = await persist(next);
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/courses/new') {
        if (state.planStatus === 'draft') {
          throw httpError(409, 'Finish this draft before adding another course.');
        }
        if ((state.courses || []).length >= 6) {
          throw httpError(409, 'Six courses is the limit.');
        }
        const saved = state.planStatus === 'active' ? await persist(shelveActive(state)) : state;
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/courses/open') {
        if (typeof body.courseId !== 'string' || !/^course-\d+$/.test(body.courseId)) {
          throw httpError(400, 'That course is not on this phone.');
        }
        const next = activateCourse(state, body.courseId);
        if (!next) throw httpError(404, 'That course is not on this phone.');
        const saved = await persist(next);
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/courses/leave') {
        if (state.planStatus !== 'active') {
          throw httpError(400, 'There is no course to leave.');
        }
        const saved = await persist(leaveActive(state));
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/feed') {
        const seeds = topicSeeds(state);
        if (!seeds.length) throw httpError(400, 'Start a course before asking for ideas.');
        if (state.feed?.length && body.refresh !== true) {
          return json(200, viewState(state, ai.sampleMode), cookies);
        }
        let feed = [];
        if (!ai.sampleMode && typeof ai.feed === 'function') {
          charge(sessionId, now(), clientAddress(request));
          try {
            feed = normalizeFeed(await ai.feed(seeds));
          } catch (error) {
            if (lessonErrorBlocks(error)) throw error;
            feed = [];
          }
        }
        if (!feed.length) feed = mockFeed(seeds);
        const saved = await persist({ ...state, feed });
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/feed/skip') {
        if (typeof body.feedId !== 'string') throw httpError(400, 'That activity is not in the feed.');
        const feed = (state.feed || []).filter((item) => item.id !== body.feedId);
        if (feed.length === (state.feed || []).length) throw httpError(404, 'That activity is not in the feed.');
        const saved = await persist({ ...state, feed });
        return json(200, viewState(saved, ai.sampleMode), cookies);
      }

      if (pathname === '/api/feed/take') {
        if (!state.plan || state.planStatus !== 'active') {
          throw httpError(400, 'Start a course before taking an activity.');
        }
        const activity = (state.feed || []).find((item) => item.id === body.feedId);
        if (!activity) throw httpError(404, 'That activity is not in the feed.');
        const added = appendActivity(state.plan, activity);
        if (!added) throw httpError(409, 'This week is full.');
        const saved = await persist({
          ...state,
          plan: added.plan,
          feed: state.feed.filter((item) => item.id !== activity.id),
        });
        return json(200, { ...viewState(saved, ai.sampleMode), focus: { dayId: added.dayId, stepId: added.stepId } }, cookies);
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
