import { GoogleGenerativeAI } from '@google/generative-ai';
import { httpError } from './http.js';
import { extractJson, normalizePathways, normalizePlan } from './json.js';

const MODEL = 'gemini-2.5-flash';

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function withTimeout(promise, ms = 45000) {
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
  const beats = [
    {
      title: 'See the shape of it',
      steps: [
        ['Watch one short overview', 'video', `Watch a beginner overview of ${topic}. Stop after about ten minutes.`],
        ['Collect five words', 'exercise', `Write five ${topic} words you want to be able to explain.`],
        ['Say it back', 'exercise', `Explain ${focus} in two sentences, without looking.`],
        ['Mark the fuzzy part', 'exercise', 'Circle the one idea that still feels unclear.'],
      ],
    },
    {
      title: 'Learn the core move',
      steps: [
        ['Read one explanation', 'article', `Read a single clear explanation of the basic move in ${topic}.`],
        ['Copy one example', 'exercise', 'Copy one example by hand. Leave it unchanged.'],
        ['Change one thing', 'exercise', 'Change one part of that example and notice what happens.'],
        ['Name the rule', 'quiz', 'Write the rule you think you just used.'],
      ],
    },
    {
      title: 'Try a small version',
      steps: [
        ['Set a ten-minute task', 'exercise', `Pick a tiny ${topic} task you can finish today.`],
        ['Do it once', 'exercise', 'Finish the task once. Stop when it works.'],
        ['Note what broke', 'exercise', 'Write the one moment you had to look something up.'],
        ['Do it cleaner', 'exercise', 'Repeat it once, using what you just wrote down.'],
      ],
    },
    {
      title: 'Check what stuck',
      steps: [
        ['Close the source', 'quiz', `Answer three ${topic} questions from memory.`],
        ['Check only the misses', 'article', 'Look up the ones you missed. Leave the ones you knew.'],
        ['Teach one miss', 'exercise', 'Explain the missed idea in a sentence you could text a friend.'],
        ['One more question', 'quiz', 'Ask yourself one harder question and answer it.'],
      ],
    },
    {
      title: 'Use it for your goal',
      steps: [
        ['Name the real thing', 'project', profile.motivation ? `Aim today at this: ${profile.motivation}` : `Make something small with ${topic}.`],
        ['Build the smallest version', 'project', `Make a rough version that uses ${focus}.`],
        ['Show it to yourself', 'exercise', 'Look at it tomorrow-you would understand. Add one label if not.'],
        ['Keep a scrap', 'exercise', 'Save the version and one sentence about what you would change.'],
      ],
    },
    {
      title: 'Redo the hard part',
      steps: [
        ['Pick the shaky step', 'exercise', 'Choose the day that felt hardest and reread only that step.'],
        ['Slow it down', 'exercise', 'Repeat it at half speed. No new material.'],
        ['Fix one mistake', 'exercise', 'Correct one specific mistake from earlier in the week.'],
        ['Leave a reminder', 'exercise', 'Write a three-word reminder you can use next time.'],
      ],
    },
    {
      title: 'Teach it back',
      steps: [
        ['Explain the week', 'project', `Explain this week of ${topic} out loud in under a minute.`],
        ['Write the next step', 'exercise', 'Note the single thing you would practice next week.'],
        ['List what you can do now', 'quiz', `List three ${topic} things you can do that you could not do on day 1.`],
        ['Stop while it is finished', 'exercise', 'Close the week. Do not add a new topic today.'],
      ],
    },
  ];
  const count = stepCount(profile.timeCommitment);
  const minutes = profile.timeCommitment === '15min' ? '10m' : '15m';

  return normalizePlan({
    topic,
    days: beats.map((beat, index) => ({
      title: `Day ${index + 1}: ${beat.title}`,
      steps: beat.steps.slice(0, count).map(([title, type, detail]) => ({
        title,
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

async function complete(model, prompt) {
  const result = await withTimeout(model.generateContent(prompt));
  return extractJson(result.response.text());
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

async function liveChat(model, history, message, plan) {
  const prior = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-12)
    .map((item) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.content.slice(0, 4000) }],
    }));
  const firstUser = prior.findIndex((item) => item.role === 'user');
  const validHistory = firstUser === -1 ? [] : prior.slice(firstUser);
  const historyWithPlan = [
    {
      role: 'user',
      parts: [{ text: `The learner is following this plan. Answer briefly and practically, and stay on the plan.\n\n${JSON.stringify(plan).slice(0, 12000)}` }],
    },
    { role: 'model', parts: [{ text: 'I will use that plan as context.' }] },
    ...validHistory,
  ];

  const chat = model.startChat({ history: historyWithPlan });
  const result = await withTimeout(chat.sendMessage(message));
  const text = result.response.text().trim();
  if (!text) throw httpError(502, 'The model returned an empty reply. Try again.');
  return text.slice(0, 8000);
}

export function createAi() {
  if (!geminiConfigured()) {
    return {
      sampleMode: true,
      pathways: async (profile) => mockPathways(profile),
      plan: async (profile, selected) => mockPlan(profile, selected),
      revise: async (plan, profile, feedback) => mockRevise(plan, profile, feedback),
      chat: async (history, message, plan) => mockChat(history, message, plan),
    };
  }

  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
    .getGenerativeModel({ model: MODEL });

  return {
    sampleMode: false,
    async pathways(profile) {
      return normalizePathways(await complete(model, pathwayPrompt(profile)));
    },
    async plan(profile, selected) {
      return normalizePlan(await complete(model, planPrompt(profile, selected)), profile.topic);
    },
    async revise(plan, profile, feedback) {
      return normalizePlan(await complete(model, revisePrompt(plan, profile, feedback)), profile.topic);
    },
    chat(history, message, plan) {
      return liveChat(model, history, message, plan);
    },
  };
}
