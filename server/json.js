import { httpError } from './http.js';

const STEP_TYPES = new Set(['video', 'article', 'quiz', 'exercise', 'project']);

function clip(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function safeHttpsUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return '';
    return url.toString().slice(0, 300);
  } catch {
    return '';
  }
}

export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw httpError(502, 'The model sent an empty response. Try again.');
  }

  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Models sometimes wrap JSON in a sentence. Pull the first value out.
  }

  const start = cleaned.search(/[[{]/);
  if (start === -1) {
    throw httpError(502, 'The model did not return JSON. Try again.');
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, index + 1));
        } catch {
          throw httpError(502, 'The model returned JSON I could not read. Try again.');
        }
      }
    }
  }

  throw httpError(502, 'The model returned JSON I could not read. Try again.');
}

export function normalizePathways(raw) {
  const list = Array.isArray(raw) ? raw : raw?.pathways;
  if (!Array.isArray(list)) {
    throw httpError(502, 'The model did not return pathways. Try again.');
  }

  const pathways = list.slice(0, 4).map((item, index) => ({
    id: `path-${index + 1}`,
    title: clip(item?.title, 80) || `Path ${index + 1}`,
    learning_goal: clip(item?.learning_goal || item?.learningGoal, 240) || 'A focused week on this direction.',
  }));

  if (pathways.length < 2) {
    throw httpError(502, 'The model did not return enough pathways. Try again.');
  }

  return pathways;
}

export function normalizePlan(raw, fallbackTopic) {
  const daysIn = Array.isArray(raw?.days) ? raw.days : null;
  if (!daysIn) {
    throw httpError(502, 'The model did not return a plan. Try again.');
  }

  const days = daysIn.slice(0, 7).map((day, dayIndex) => {
    const stepsIn = Array.isArray(day?.steps) ? day.steps : [];
    const steps = stepsIn.slice(0, 6).map((step, stepIndex) => ({
      id: `d${dayIndex + 1}-s${stepIndex + 1}`,
      title: clip(step?.title, 140) || `Step ${stepIndex + 1}`,
      type: STEP_TYPES.has(step?.type) ? step.type : 'exercise',
      duration: clip(step?.duration, 16) || '15m',
      detail: clip(step?.detail, 280),
      url: safeHttpsUrl(step?.url),
      completed: false,
    }));

    return {
      id: `day-${dayIndex + 1}`,
      title: clip(day?.title, 120) || `Day ${dayIndex + 1}`,
      steps,
    };
  }).filter((day) => day.steps.length > 0);

  if (days.length < 5) {
    throw httpError(502, 'The model returned an incomplete week. Try again.');
  }

  return {
    topic: clip(raw?.topic, 80) || clip(fallbackTopic, 80) || 'Learning plan',
    days,
  };
}
