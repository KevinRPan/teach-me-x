const TYPE_LABEL = {
  video: 'Video',
  article: 'Read',
  quiz: 'Quiz',
  exercise: 'Practice',
  project: 'Make',
};

function SafeLink({ href }) {
  if (!href || !/^https:\/\//i.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-blue-300"
    >
      Open
    </a>
  );
}

export default function StepRow({ step, readOnly = false, onToggle }) {
  return (
    <div
      className={`flex items-stretch gap-1 rounded-2xl border px-2 py-1 ${
        step.completed ? 'border-green-500/15 bg-green-900/10' : 'border-transparent bg-neutral-800/30'
      }`}
    >
      <button
        type="button"
        disabled={readOnly}
        onClick={onToggle}
        className="flex min-h-11 min-w-0 flex-1 items-start gap-3 px-2 py-2 text-left disabled:opacity-100"
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            step.completed ? 'border-green-500 bg-green-500 text-black' : 'border-neutral-500'
          }`}
          aria-hidden="true"
        >
          {step.completed && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M2 6.2 4.6 9 10 3" />
            </svg>
          )}
        </span>
        <span className="min-w-0">
          <span className={`block text-sm font-medium ${step.completed ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
            {step.title}
          </span>
          {step.detail && (
            <span className="mt-1 block text-xs leading-5 text-neutral-400">{step.detail}</span>
          )}
          <span className="mt-1 block text-[11px] uppercase tracking-wide text-neutral-500">
            {TYPE_LABEL[step.type] || 'Step'} · {step.duration}
          </span>
        </span>
      </button>
      <SafeLink href={step.url} />
    </div>
  );
}
