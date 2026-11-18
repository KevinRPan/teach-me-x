import { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import PhoneShell from './PhoneShell';

export default function PlanRevision({
  plan,
  onRevise,
  onCancel,
  sampleMode = false,
  banner = '',
  onDismissBanner,
}) {
  const [feedback, setFeedback] = useState('');

  return (
    <PhoneShell sampleMode={sampleMode} banner={banner} onDismissBanner={onDismissBanner}>
      <div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onCancel} className="mt-3 inline-flex min-h-11 items-center gap-2 self-start text-sm text-neutral-300">
          <ArrowLeft className="h-4 w-4" />
          Back to the plan
        </button>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">What should change?</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          {plan.topic} is a {plan.days.length}-day week. One revision, then you can start.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-neutral-500">
          {plan.days.slice(0, 3).map((day) => (
            <li key={day.id}>{day.title}</li>
          ))}
          <li>…</li>
        </ul>
        <textarea
          value={feedback}
          autoFocus
          maxLength={600}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="More practice, fewer videos, slower pace..."
          className="mt-5 min-h-40 w-full flex-1 resize-none rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base outline-none placeholder:text-neutral-600"
        />
        <button
          type="button"
          disabled={feedback.trim().length < 4}
          onClick={() => onRevise(feedback.trim())}
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-semibold disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
          Revise the week
        </button>
      </div>
    </PhoneShell>
  );
}
