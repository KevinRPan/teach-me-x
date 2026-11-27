import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { planProgress } from '../lib/plan';
import StepRow from './StepRow';

export default function PlanView({
  plan,
  onOpenStep,
  readOnly = false,
  hideHeader = false,
  startCollapsed = false,
}) {
  const [expandedDays, setExpandedDays] = useState(() => {
    if (startCollapsed || !plan?.days?.length) return new Set();
    return new Set([plan.days[0].id]);
  });

  if (!plan) return null;

  const progress = planProgress(plan);

  const toggleDay = (dayId) => {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      {!hideHeader && (
        <div className="px-4 pb-2 pt-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300">Your week</p>
              <h2 className="truncate text-2xl font-semibold">{plan.topic}</h2>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{Math.round(progress * 100)}%</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-blue-500" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-2 px-4 pb-6">
        {plan.days.map((day, dayIndex) => {
          const expanded = expandedDays.has(day.id);
          const completedSteps = day.steps.filter((step) => step.completed).length;
          const complete = completedSteps === day.steps.length;
          return (
            <section key={day.id} className="rounded-2xl">
              <button
                type="button"
                onClick={() => toggleDay(day.id)}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                    complete ? 'border-green-500/40 text-green-400' : 'border-neutral-700 text-neutral-200',
                  )}
                >
                  {complete ? <Check className="h-4 w-4" /> : dayIndex + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{day.title}</span>
                  <span className="text-xs text-neutral-500">{completedSteps}/{day.steps.length} done</span>
                </span>
                {expanded ? <ChevronDown className="h-5 w-5 text-neutral-500" /> : <ChevronRight className="h-5 w-5 text-neutral-500" />}
              </button>
              {expanded && (
                <div className="space-y-2 pb-3 pl-1">
                  {day.steps.map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      readOnly={readOnly}
                      onOpen={!readOnly && onOpenStep ? () => onOpenStep(day.id, step.id) : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
