import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { STEP_LABEL } from '../lib/plan';

function done(day) {
  return day.steps.length > 0 && day.steps.every((step) => step.completed);
}

export default function Journey({ plan, onOpenStep, onClose }) {
  const current = plan.days.findIndex((day) => day.steps.some((step) => !step.completed));
  const focus = current === -1 ? plan.days.length - 1 : current;
  const [open, setOpen] = useState(focus);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-neutral-800 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-neutral-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Now
        </button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Journey</h1>
        <p className="mt-1 text-sm text-neutral-400">{plan.topic}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ol className="space-y-2">
          {plan.days.map((day, index) => {
            const expanded = open === index;
            const complete = done(day);
            return (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? -1 : index)}
                  className="flex min-h-14 w-full items-center gap-3 text-left"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm',
                      index === focus && 'border-blue-400 text-blue-200',
                      complete && index !== focus && 'border-green-500/40 text-green-300',
                      index !== focus && !complete && 'border-neutral-700 text-neutral-400',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{day.title}</span>
                    <span className="text-xs text-neutral-500">
                      {day.steps.filter((step) => step.completed).length}/{day.steps.length}
                      {index === focus ? ' · you are here' : ''}
                    </span>
                  </span>
                </button>
                {expanded && (
                  <div className="mb-2 ml-11 border-l border-neutral-800 pl-3">
                    {day.steps.map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => onOpenStep(day.id, step.id)}
                        className="flex min-h-12 w-full items-center gap-3 text-left"
                      >
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            step.completed ? 'bg-green-400' : 'bg-neutral-600',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{step.title}</span>
                        <span className="shrink-0 text-[11px] uppercase tracking-wide text-neutral-500">
                          {STEP_LABEL[step.type] || 'Step'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
