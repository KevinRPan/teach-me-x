import { httpError } from './http.js';
import { extractJson, normalizePathways, normalizePlan } from './json.js';

const MODEL = 'gemini-2.5-flash';

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function withTimeout(promise, ms = 25000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(httpError(504, 'The model took too long. Try again.')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function mockPathways(profile) {
  const topic = profile.topic;
  const motivation = profile.motivation
    ? `Point the week at this: ${profile.motivation}`
    : `Spend the week on the part of ${topic} you would actually use.`;
  return normalizePathways([
    {
      title: `${topic} fundamentals`,
      learning_goal: `Build a working picture of ${topic} you can explain in a few sentences.`,
    },
    {
      title: `Hands-on ${topic}`,
      learning_goal: `Make small things every day instead of only reading about ${topic}.`,
    },
    {
      title: `${topic}, applied`,
      learning_goal: motivation,
    },
  ]);
}

function stepCount(timeCommitment) {
  if (timeCommitment === '15min') return 2;
  if (timeCommitment === '2hr+') return 4;
  return 3;
}

function mockPlan(profile, selectedPathways) {
  const topic = profile.topic;
  const focus = selectedPathways[0]?.title || topic;
  const count = stepCount(profile.timeCommitment);
  const minutes = profile.timeCommitment === '15min' ? '10m' : '15m';
  const beats = [
    ['See the shape of it', 'Watch one short overview', 'video', `Watch a beginner overview of ${topic}.`],
    ['Learn the core move', 'Read one explanation', 'article', `Read one clear explanation of ${focus}.`],
    ['Try a small version', 'Do a ten-minute task', 'exercise', `Finish one tiny ${topic} task.`],
    ['Check what stuck', 'Answer from memory', 'quiz', `Answer three ${topic} questions without looking.`],
    ['Use it for your goal', 'Build the smallest version', 'project', profile.motivation || `Make something small with ${topic}.`],
    ['Redo the hard part', 'Slow the shaky step down', 'exercise', 'Repeat the hardest step. No new material.'],
    ['Teach it back', 'Explain the week', 'project', `Explain this week of ${topic} in under a minute.`],
  ];
  return normalizePlan({
    topic,
    days: beats.map(([title, step, type, detail], index) => ({
      title: `Day ${index + 1}: ${title}`,
      steps: Array.from({ length: count }, (_, stepIndex) => ({
        title: stepIndex === 0 ? step : `${step} ${stepIndex + 1}`,
        type,
        duration: minutes,
        detail,
        url: '',
      })),
    })),
  }, topic);
}

function mockRevise(plan, _profile, feedback) {
  const next = structuredClone(plan);
  const note = clip(feedback, 80);
  next.days[0].steps.unshift({
    title: `Adjustment: ${note}`,
    type: 'exercise',
    duration: '10m',
    detail: 'Added from your revision note.',
    url: '',
  });
  return normalizePlan(next, plan.topic);
}

function mockChat(history, message, plan) {
  const day = plan.days.find((item) => item.steps.some((step) => !step.completed)) || plan.days[0];
  const step = day.steps.find((item) => !item.completed) || day.steps[0];
  const asked = clip(message, 140);
  return [
    `You're on **${day.title}**.`,
    `Next up: ${step.title}${step.detail ? ` — ${step.detail}` : ''}`,
    `About “${asked}”: do that step once, then tell me what felt unclear.`,
    history.length > 4 ? 'Keep the questions tied to today so the week stays small enough to finish.' : '',
  ].filter(Boolean).join('\n\n');
}

function pathwayPrompt(profile) {
  return `You are an expert educational counselor. The learner wants to study "${profile.topic}".
Level: ${profile.level}
Time: ${profile.timeCommitment} a day
Motivation: ${profile.motivation || 'not specified'}

Identify 3 distinct, practical pathways inside this topic.
Return ONLY raw JSON:
[
  { "id": "path-1", "title": "Short headline", "learning_goal": "One sentence outcome" }
]`;
}

function planPrompt(profile, selectedPathways) {
  const focus = selectedPathways.map((path) => `${path.title}: ${path.learning_goal}`).join('\n');
  return `You are an expert curriculum designer. Create a 7-day learning plan.
Topic: ${profile.topic}
Level: ${profile.level}
Time per day: ${profile.timeCommitment}
Motivation: ${profile.motivation || 'not specified'}
Chosen pathways:
${focus}

Each day needs 2 to 4 steps that fit inside ${profile.timeCommitment}.
For url, include a real https link only when you are confident it exists. Otherwise use an empty string. Never invent a URL.
Return ONLY raw JSON:
{
  "topic": "Topic Name",
  "days": [
    {
      "id": "day-1",
      "title": "Day 1: Focus",
      "steps": [
        { "id": "d1-s1", "title": "Step", "type": "video", "duration": "15m", "detail": "What to do", "url": "", "completed": false }
      ]
    }
  ]
}
type must be one of video, article, quiz, exercise, project.`;
}

function revisePrompt(plan, profile, feedback) {
  return `You are an expert curriculum designer. Revise this 7-day plan using the learner's feedback.
Profile: ${profile.topic}, ${profile.level}, ${profile.timeCommitment} a day.
Feedback: ${feedback}
Current plan:
${JSON.stringify(plan)}

Keep 7 days and the same JSON shape. Reset every completed flag to false.
For url, keep an existing https link or use an empty string. Never invent a URL.
Return ONLY raw JSON.`;
}

async function generate(apiKey, contents) {
  const response = await withTimeout(fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents }),
    },
  ));
  if (!response.ok) throw httpError(502, 'The model could not answer. Try again.');
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
}

function sampleAi() {
  return {
    sampleMode: true,
    pathways: async (profile) => mockPathways(profile),
    plan: async (profile, selected) => mockPlan(profile, selected),
    revise: async (plan, profile, feedback) => mockRevise(plan, profile, feedback),
    chat: async (history, message, plan) => mockChat(history, message, plan),
  };
}

export function createRestAi(apiKey) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return sampleAi();

  return {
    sampleMode: false,
    async pathways(profile) {
      const text = await generate(key, [{ role: 'user', parts: [{ text: pathwayPrompt(profile) }] }]);
      return normalizePathways(extractJson(text));
    },
    async plan(profile, selected) {
      const text = await generate(key, [{ role: 'user', parts: [{ text: planPrompt(profile, selected) }] }]);
      return normalizePlan(extractJson(text), profile.topic);
    },
    async revise(plan, profile, feedback) {
      const text = await generate(key, [{ role: 'user', parts: [{ text: revisePrompt(plan, profile, feedback) }] }]);
      return normalizePlan(extractJson(text), profile.topic);
    },
    async chat(history, message, plan) {
      const prior = (history || [])
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
        .slice(-12)
        .map((item) => ({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content.slice(0, 4000) }],
        }));
      const firstUser = prior.findIndex((item) => item.role === 'user');
      const contents = [
        {
          role: 'user',
          parts: [{ text: `The learner is following this plan. Answer briefly and practically, and stay on the plan.\n\n${JSON.stringify(plan).slice(0, 12000)}` }],
        },
        { role: 'model', parts: [{ text: 'I will use that plan as context.' }] },
        ...(firstUser === -1 ? [] : prior.slice(firstUser)),
        { role: 'user', parts: [{ text: message }] },
      ];
      const text = (await generate(key, contents)).trim();
      if (!text) throw httpError(502, 'The model returned an empty reply. Try again.');
      return text.slice(0, 8000);
    },
  };
}
