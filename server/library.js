import { emptyState } from './state.js';

const STEP_TYPES = new Set(['video', 'article', 'quiz', 'exercise', 'project']);

function clip(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function currentDay(plan) {
  if (!plan?.days?.length) return null;
  return plan.days.find((day) => day.steps?.some((step) => !step.completed)) || plan.days[plan.days.length - 1];
}

function progressOf(plan) {
  const steps = plan?.days?.flatMap((day) => day.steps || []) ?? [];
  if (!steps.length) return 0;
  return Math.round((steps.filter((step) => step.completed).length / steps.length) * 100);
}

export function courseSummary(course) {
  const day = currentDay(course?.plan);
  return {
    id: course.id,
    topic: course.topic || course.plan?.topic || 'Course',
    planStatus: course.planStatus || null,
    progress: progressOf(course?.plan),
    place: day?.title || '',
  };
}

function snapshot(state, id) {
  return {
    id,
    topic: state.plan?.topic || state.profile?.topic || 'Course',
    profile: state.profile,
    selectedPathways: state.selectedPathways || [],
    plan: state.plan,
    planStatus: state.planStatus,
    hasRevised: Boolean(state.hasRevised),
    messages: state.messages || [],
  };
}

export function nextCourseId(courses) {
  const used = new Set((courses || []).map((course) => course.id));
  let number = (courses || []).length + 1;
  while (used.has(`course-${number}`)) number += 1;
  return `course-${number}`;
}

export function ensureCourses(state) {
  const courses = Array.isArray(state.courses) ? state.courses : [];
  const feed = Array.isArray(state.feed) ? state.feed : [];
  const base = { ...state, courses, feed };
  if (state.planStatus !== 'active' || !state.plan) return base;
  if (state.activeCourseId && courses.some((course) => course.id === state.activeCourseId)) {
    return rememberActive(base);
  }
  const id = nextCourseId(courses);
  return {
    ...base,
    activeCourseId: id,
    courses: [...courses, snapshot(state, id)],
  };
}

export function rememberActive(state) {
  if (!state.activeCourseId) return state;
  const courses = (state.courses || []).map((course) => (
    course.id === state.activeCourseId ? snapshot({ ...state, courses: state.courses }, state.activeCourseId) : course
  ));
  return { ...state, courses };
}

export function shelveActive(state) {
  const ready = rememberActive(ensureCourses(state));
  return {
    ...ready,
    profile: null,
    pathways: [],
    selectedPathways: [],
    plan: null,
    planStatus: null,
    hasRevised: false,
    messages: [],
    activeCourseId: null,
    pausedCourseId: ready.activeCourseId,
  };
}

export function activateCourse(state, courseId) {
  const ready = rememberActive(ensureCourses(state));
  const course = ready.courses.find((item) => item.id === courseId);
  if (!course?.plan) return null;
  return {
    ...ready,
    activeCourseId: course.id,
    profile: course.profile,
    pathways: [],
    selectedPathways: course.selectedPathways || [],
    plan: course.plan,
    planStatus: course.planStatus || 'active',
    hasRevised: Boolean(course.hasRevised),
    messages: course.messages || [],
    pausedCourseId: null,
  };
}

export function leaveActive(state) {
  const ready = rememberActive(ensureCourses(state));
  const courses = ready.courses.filter((course) => course.id !== ready.activeCourseId);
  const next = courses[0];
  if (!next) return { ...emptyState(), feed: ready.feed || [] };
  return {
    ...ready,
    courses,
    activeCourseId: next.id,
    profile: next.profile,
    pathways: [],
    selectedPathways: next.selectedPathways || [],
    plan: next.plan,
    planStatus: next.planStatus || 'active',
    hasRevised: Boolean(next.hasRevised),
    messages: next.messages || [],
    pausedCourseId: null,
  };
}

export function topicSeeds(state) {
  const seeds = [];
  const push = (topic, motivation) => {
    const name = clip(topic, 80);
    if (!name || seeds.some((seed) => seed.topic.toLowerCase() === name.toLowerCase())) return;
    seeds.push({ topic: name, motivation: clip(motivation, 180) });
  };
  for (const course of state.courses || []) {
    push(course.topic || course.profile?.topic, course.profile?.motivation);
  }
  push(state.profile?.topic, state.profile?.motivation);
  push(state.plan?.topic, state.profile?.motivation);
  return seeds.slice(0, 4);
}

export function normalizeFeed(raw) {
  const list = Array.isArray(raw) ? raw : raw?.activities || raw?.feed;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 6).map((item, index) => ({
    id: `feed-${index + 1}`,
    topic: clip(item?.topic, 80) || 'Learning',
    title: clip(item?.title, 80) || `Activity ${index + 1}`,
    type: STEP_TYPES.has(item?.type) ? item.type : 'exercise',
    duration: clip(item?.duration, 16) || '10m',
    detail: clip(item?.detail, 280),
    why: clip(item?.why, 160),
  })).filter((item) => item.detail);
}

export function mockFeed(seeds) {
  const source = seeds?.length ? seeds : [{ topic: 'this subject', motivation: '' }];
  const rounds = [
    (seed) => ({
      topic: seed.topic,
      title: `Say ${seed.topic} in one minute`,
      type: 'exercise',
      duration: '10m',
      detail: `Explain ${seed.topic} out loud in a few sentences. Write the sentence that was hardest.`,
      why: seed.motivation ? `Tied to ${seed.motivation}.` : `A short check on ${seed.topic}.`,
    }),
    (seed) => ({
      topic: seed.topic,
      title: `Two ideas inside ${seed.topic}`,
      type: 'article',
      duration: '10m',
      detail: `Pick two ideas people mix up in ${seed.topic}. Describe each with one example from this week.`,
      why: `A distinction that makes ${seed.topic} easier to use.`,
    }),
    (seed) => ({
      topic: seed.topic,
      title: `Use ${seed.topic} once today`,
      type: 'project',
      duration: '15m',
      detail: `Do one real task that needs ${seed.topic}. Write what you did and what you would repeat.`,
      why: seed.motivation ? `Practice toward ${seed.motivation}.` : `Practice that leaves the page.`,
    }),
  ];
  const raw = [];
  for (let round = 0; round < rounds.length && raw.length < 6; round += 1) {
    for (const seed of source) {
      if (raw.length >= 6) break;
      raw.push(rounds[round](seed));
    }
  }
  return normalizeFeed(raw);
}

export function feedPrompt(seeds) {
  const lines = (seeds || []).map((seed) => `- ${seed.topic}${seed.motivation ? ` (${seed.motivation})` : ''}`).join('\n');
  return `Suggest short learning activities related to topics this person is already studying.
${lines || '- learning'}

Each activity is done inside the app in about 10 minutes. Do not tell them to go watch or read somewhere else. Write the task itself.

Return ONLY raw JSON:
[
  { "topic": "one of the topics", "title": "Short title", "type": "exercise", "duration": "10m", "detail": "What they will do", "why": "Why it fits" }
]

Return 6 items, spread across the topics. type is video, article, quiz, exercise, or project. No URLs.`;
}

export function appendActivity(plan, activity) {
  if (!plan?.days?.length) return null;
  const open = plan.days.find((day) => (day.steps || []).length < 6) || null;
  const day = (currentDay(plan)?.steps?.length < 6 ? currentDay(plan) : null) || open;
  if (!day) return null;
  const dayNumber = String(day.id || '').replace(/^day-/, '') || '1';
  const stepId = `d${dayNumber}-s${(day.steps || []).length + 1}`;
  const step = {
    id: stepId,
    title: clip(activity.title, 140) || 'Activity',
    type: STEP_TYPES.has(activity.type) ? activity.type : 'exercise',
    duration: clip(activity.duration, 16) || '10m',
    detail: clip(activity.detail, 280),
    url: '',
    completed: false,
  };
  return {
    dayId: day.id,
    stepId,
    plan: {
      ...plan,
      days: plan.days.map((item) => (
        item.id === day.id ? { ...item, steps: [...(item.steps || []), step] } : item
      )),
    },
  };
}
