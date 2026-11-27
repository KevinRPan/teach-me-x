const BLOCKS = 4;
const PROMPTS = 4;
const CHECKS = 3;

function clip(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function clipNote(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim().slice(0, max);
}

export function validStepAddress(dayId, stepId) {
  return typeof dayId === 'string'
    && typeof stepId === 'string'
    && /^day-\d+$/.test(dayId)
    && /^d\d+-s\d+$/.test(stepId);
}

export function findStep(plan, dayId, stepId) {
  const day = plan?.days?.find((item) => item.id === dayId) || null;
  const step = day?.steps?.find((item) => item.id === stepId) || null;
  return { day, step };
}

export function writeStep(plan, dayId, stepId, patch) {
  let found = false;
  const days = plan.days.map((day) => {
    if (day.id !== dayId) return day;
    return {
      ...day,
      steps: day.steps.map((step) => {
        if (step.id !== stepId) return step;
        found = true;
        return { ...step, ...patch };
      }),
    };
  });
  if (!found) return null;
  return { ...plan, days };
}

export function normalizeLesson(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .slice(0, BLOCKS)
    .map((block) => ({
      heading: clip(block?.heading, 80),
      body: clip(block?.body, 700),
    }))
    .filter((block) => block.body);

  const prompts = (Array.isArray(raw.prompts) ? raw.prompts : [])
    .slice(0, PROMPTS)
    .map((prompt, index) => ({
      id: `p${index + 1}`,
      label: clip(prompt?.label, 220),
      hint: clip(prompt?.hint, 160),
    }))
    .filter((prompt) => prompt.label);

  const checks = (Array.isArray(raw.checks) ? raw.checks : [])
    .slice(0, CHECKS)
    .map((check, index) => {
      const options = (Array.isArray(check?.options) ? check.options : [])
        .slice(0, 4)
        .map((option) => clip(option, 140))
        .filter(Boolean);
      if (options.length < 2) return null;
      const answer = Number(check?.answer);
      const question = clip(check?.question, 220);
      if (!question) return null;
      return {
        id: `q${index + 1}`,
        question,
        options,
        answer: Number.isInteger(answer) && answer >= 0 && answer < options.length ? answer : 0,
        why: clip(check?.why, 280),
      };
    })
    .filter(Boolean);

  const lead = clip(raw.lead, 500);
  if (!lead && blocks.length === 0 && prompts.length === 0 && checks.length === 0) return null;

  return {
    source: 'model',
    lead,
    blocks,
    prompts,
    checks,
  };
}

export function acceptLesson(raw) {
  const normalized = normalizeLesson(raw);
  if (!normalized) return null;
  if (raw?.source === 'backup' || raw?.source === 'sample') {
    return { ...normalized, source: raw.source };
  }
  return normalized;
}

export function cleanWork(lesson, notes, picks) {
  const promptIds = new Set((lesson?.prompts || []).map((prompt) => prompt.id));
  const cleanNotes = {};
  if (notes && typeof notes === 'object' && !Array.isArray(notes)) {
    for (const [key, value] of Object.entries(notes)) {
      if (!promptIds.has(key)) continue;
      const text = clipNote(value, 2000);
      if (text) cleanNotes[key] = text;
    }
  }

  const checks = new Map((lesson?.checks || []).map((check) => [check.id, check]));
  const cleanPicks = {};
  if (picks && typeof picks === 'object' && !Array.isArray(picks)) {
    for (const [key, value] of Object.entries(picks)) {
      const check = checks.get(key);
      const index = Number(value);
      if (!check || !Number.isInteger(index) || index < 0 || index >= check.options.length) continue;
      cleanPicks[key] = index;
    }
  }

  return { notes: cleanNotes, picks: cleanPicks };
}

function contextOf(profile, plan, step) {
  const topic = clip(plan?.topic || profile?.topic, 80) || 'this subject';
  const aim = clip(profile?.motivation, 180);
  const title = clip(step?.title, 140) || 'This step';
  const brief = clip(step?.detail, 280);
  return { topic, aim, title, brief, type: step?.type || 'exercise' };
}

function aimSentence(aim) {
  return aim ? ` Keep your reason for this week in view: ${aim}` : '';
}

function teachingBrief(brief, title, topic) {
  const text = clip(brief, 280);
  if (text && !/^(watch|read|listen|open|find|look up)\b/i.test(text)) return text;
  return `${title} is one real situation in ${topic}: what you did, what you would do on purpose next time, and what you would repeat. A mood is not required.`;
}

export function mockLesson(profile, plan, day, step) {
  const { topic, aim, title, brief, type } = contextOf(profile, plan, step);
  const dayTitle = clip(day?.title, 120) || 'Today';
  const setup = brief || `${title} is the part of ${topic} to work on in ${dayTitle}.`;

  let raw;
  if (type === 'quiz') {
    raw = {
      lead: `Answer these from what you can say about ${topic} right now. Then read the note under the question.`,
      blocks: [
        {
          heading: 'What you are checking',
          body: setup,
        },
      ],
      prompts: [],
      checks: [
        {
          question: `What makes “${title}” useful?`,
          options: [
            `It asks you to use one idea from ${topic}, not collect more of it`,
            'It asks you to switch topics',
            'It asks you to wait until the subject feels easy',
            'It asks you to copy a definition and stop',
          ],
          answer: 0,
          why: `Use beats coverage. ${setup}`,
        },
        {
          question: `You get stuck on “${title}”. What now?`,
          options: [
            'Name the exact spot that stuck and try only that part again',
            'Start the whole day over',
            'Skip to tomorrow',
            'Add a second topic',
          ],
          answer: 0,
          why: `A smaller retry teaches more than restarting ${dayTitle}.`,
        },
        {
          question: aim ? 'How should your reason for this week show up in an answer?' : `How do you know “${title}” stuck?`,
          options: aim
            ? [
              'The answer names that reason in concrete terms',
              'The answer mentions it and then ignores it',
              'The answer avoids it',
              'The answer changes the reason to something easier',
            ]
            : [
              'You can say the idea without looking back at the question',
              'You copied a sentence from above',
              'You opened another tab',
              'You moved on without answering',
            ],
          answer: 0,
          why: aim ? `Tie the check to why you started: ${aim}` : 'If you can say it in your own words, it stuck.',
        },
      ],
    };
  } else if (type === 'exercise' || type === 'project') {
    raw = {
      lead: setup,
      blocks: [
        {
          heading: 'How to do this one',
          body: `Stay on ${topic}. Write short answers you could reread tomorrow. Start from a real moment, say what it shows, then name one thing you will do because of it.${aimSentence(aim)}`,
        },
        {
          heading: 'Keep it small enough to finish',
          body: `“${title}” is done when the three answers below are specific. A name, a place, or a sentence you could actually say is enough. Skip pep talks and general advice.`,
        },
      ],
      prompts: [
        {
          label: `What is one real moment that fits “${title}”?`,
          hint: 'A person, a place, or a sentence you actually said.',
        },
        {
          label: `What does that moment show you about ${topic}?`,
          hint: 'One observation. Leave out the pep talk.',
        },
        {
          label: aim ? `What will you do this week toward “${aim}”?` : 'What will you do once, soon, because of this?',
          hint: 'Name the action and when.',
        },
      ],
      checks: [],
    };
  } else {
    const idea = teachingBrief(setup, title, topic);
    raw = {
      lead: idea,
      blocks: [
        {
          heading: 'A distinction to keep',
          body: `Separate the skill from the mood around it. In ${topic}, the skill is the part you can do on purpose. The mood comes and goes. “${title}” only needs the skill, practiced on something small enough to finish in this sitting.${aimSentence(aim)}`,
        },
        {
          heading: 'Try it on one case',
          body: `Pick one situation from the last week where ${topic} mattered. Say what you did, what “${title}” would have looked like there, and what you would repeat. One case teaches more than a general definition.`,
        },
      ],
      prompts: [
        {
          label: `In a sentence or two, what will you remember from “${title}”?`,
          hint: 'Your own words. One case is enough.',
        },
      ],
      checks: [],
    };
  }

  const lesson = acceptLesson({ ...raw, source: 'sample' });
  if (!lesson) {
    return {
      source: 'sample',
      lead: setup,
      blocks: [],
      prompts: [],
      checks: [],
    };
  }
  return lesson;
}

export function backupLesson(profile, plan, day, step) {
  return { ...mockLesson(profile, plan, day, step), source: 'backup' };
}

export function lessonFromModel(raw, profile, plan, day, step) {
  return acceptLesson(raw) || backupLesson(profile, plan, day, step);
}

export function lessonErrorBlocks(error) {
  const message = String(error?.message || '');
  return error?.status === 429 || /quota|rejected the key/i.test(message);
}

export function lessonPrompt(profile, plan, day, step) {
  const topic = clip(plan?.topic || profile?.topic, 80);
  return `You write the activity a learner completes on their phone, inside this app. They will not leave the app. Do not tell them to watch a video, open an article, or journal somewhere else. Write the lesson itself.

Topic: ${topic}
Level: ${profile?.level || 'beginner'}
Time for this step: ${step?.duration || '15m'}
Motivation: ${profile?.motivation || 'not specified'}
Day: ${day?.title || ''}
Step title: ${step?.title || ''}
Step type: ${step?.type || 'exercise'}
Preview the planner wrote (a blurb, not the lesson): ${step?.detail || ''}

Return ONLY raw JSON:
{
  "lead": "2 to 4 sentences that start teaching immediately",
  "blocks": [{ "heading": "Short heading", "body": "The actual material, 4 to 6 sentences" }],
  "prompts": [{ "label": "Question they answer in a text box", "hint": "Concrete nudge" }],
  "checks": [{ "question": "Question", "options": ["A", "B", "C", "D"], "answer": 0, "why": "Why that option is right" }]
}

Shape by type:
- video or article: 3 blocks that teach this step (the idea, a distinction, and one worked example tied to their motivation). One prompt that asks them to apply it. checks must be [].
- exercise or project: 2 short blocks that show how to do the work, then 3 prompts they can answer in the time given. checks must be [].
- quiz: 1 short block of the idea being tested, then 3 checks. Each check has exactly 4 options. answer is the index of the correct option, starting at 0. prompts must be [].

Rules:
- Stay on this single step. Teach ${topic}, not generic study advice.
- Use accurate, mainstream explanations. Do not invent studies, quotes, statistics, or URLs. If a fact is uncertain, use an example and a question instead.
- Plain sentences. No markdown.
- The preview is only a blurb. If it says to watch or read something else, write that lesson here.`;
}

export function planContext(plan) {
  const brief = {
    topic: plan?.topic || '',
    days: (plan?.days || []).map((day) => ({
      id: day.id,
      title: day.title,
      steps: (day.steps || []).map((step) => ({
        id: step.id,
        title: step.title,
        type: step.type,
        detail: step.detail,
        completed: Boolean(step.completed),
        ...(step.notes && Object.keys(step.notes).length ? { notes: step.notes } : {}),
      })),
    })),
  };
  return JSON.stringify(brief).slice(0, 12000);
}
