import assert from 'node:assert/strict';
import test from 'node:test';
import { mockLesson, normalizeLesson, planContext } from './lesson.js';

test('normalizeLesson keeps a teachable activity and drops junk', () => {
  const lesson = normalizeLesson({
    lead: '  Confidence is a skill you can practice.  ',
    blocks: [
      { heading: 'Idea', body: 'It shows up when you do a hard thing on purpose.' },
      { heading: '', body: '   ' },
    ],
    prompts: [{ id: 'ignore', label: ' Name a time you followed through. ', hint: 'A small one.' }],
    checks: [{
      question: 'Which one is practice?',
      options: ['Do it once', 'Wait', '', 'Collect quotes'],
      answer: 4,
      why: 'Doing it is the practice.',
    }],
    source: 'nope',
  });

  assert.equal(lesson.source, 'model');
  assert.equal(lesson.blocks.length, 1);
  assert.equal(lesson.prompts[0].id, 'p1');
  assert.equal(lesson.checks[0].id, 'q1');
  assert.equal(lesson.checks[0].options.length, 3);
  assert.equal(lesson.checks[0].answer, 0);
  assert.equal(normalizeLesson({ lead: '', blocks: [] }), null);
});

test('sample lessons are activities, and chat context leaves the lesson body out', () => {
  const profile = { topic: 'Confidence', motivation: 'speak up in meetings' };
  const plan = { topic: 'Confidence', days: [] };
  const video = mockLesson(profile, plan, { title: 'Day 1' }, {
    title: 'What is true confidence?',
    type: 'video',
    detail: 'Separate confidence from arrogance.',
  });
  assert.equal(video.source, 'sample');
  assert.equal(video.blocks.length, 2);
  assert.equal(video.prompts.length, 1);
  assert.equal(video.checks.length, 0);
  assert.match(video.lead, /Separate confidence from arrogance/);

  const away = mockLesson(profile, plan, { title: 'Day 1' }, {
    title: 'Watch one short overview',
    type: 'video',
    detail: 'Watch a beginner overview. Stop after ten minutes.',
  });
  assert.match(away.lead, /one real situation/);
  assert.doesNotMatch(`${away.lead} ${away.blocks.map((block) => block.body).join(' ')}`, /Stop after ten minutes/);

  const practice = mockLesson(profile, plan, { title: 'Day 1' }, {
    title: 'Discover your strengths',
    type: 'exercise',
    detail: 'Name a strength you have used.',
  });
  assert.equal(practice.prompts.length, 3);

  const quiz = mockLesson(profile, plan, { title: 'Day 1' }, {
    title: 'Check it',
    type: 'quiz',
    detail: 'Answer from memory.',
  });
  assert.equal(quiz.checks.length, 3);
  assert.equal(quiz.prompts.length, 0);

  const context = planContext({
    topic: 'Confidence',
    days: [{
      id: 'day-1',
      title: 'Day 1',
      steps: [{
        id: 'd1-s1',
        title: 'What is true confidence?',
        type: 'video',
        detail: 'A preview',
        completed: false,
        lesson: video,
        notes: { p1: 'It is a skill.' },
      }],
    }],
  });
  assert.match(context, /It is a skill/);
  assert.doesNotMatch(context, /Separate confidence from arrogance/);
});
