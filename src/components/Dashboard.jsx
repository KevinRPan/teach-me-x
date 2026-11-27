import { useCallback, useState } from 'react';
import { ArrowRight, MessageCircle, MoreHorizontal, Rows3 } from 'lucide-react';
import PhoneShell from './PhoneShell';
import PlanView from './PlanView';
import ChatInterface from './ChatInterface';
import StepRow from './StepRow';
import Activity from './Activity';
import { cn } from '../lib/utils';
import { currentDay, firstOpenStep, isWeekComplete, planProgress } from '../lib/plan';

export default function Dashboard({
  plan,
  messages,
  sampleMode,
  banner,
  onDismissBanner,
  onSaveStep,
  onSend,
  onReset,
  sending,
}) {
  const [tab, setTab] = useState('plan');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [session, setSession] = useState(null);
  const progress = Math.round(planProgress(plan) * 100);
  const today = currentDay(plan);
  const done = isWeekComplete(plan);
  const openStep = today ? firstOpenStep(today) : null;
  const remaining = today ? today.steps.filter((step) => !step.completed).length : 0;
  const startLabel = remaining === 0
    ? 'Review today'
    : remaining === today?.steps.length
      ? `Start · ${today.steps.length} steps`
      : `Continue · ${remaining} left`;

  const closeSession = useCallback(() => setSession(null), []);
  const openSession = (dayId, stepId) => {
    setTab('plan');
    setMenuOpen(false);
    setSession({ dayId, stepId });
  };

  return (
    <PhoneShell locked sampleMode={sampleMode} banner={banner} onDismissBanner={onDismissBanner}>
      {session ? (
        <Activity
          plan={plan}
          dayId={session.dayId}
          stepId={session.stepId}
          onClose={closeSession}
          onGoto={(stepId) => setSession({ dayId: session.dayId, stepId })}
          onSave={onSaveStep}
        />
      ) : (
      <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">This week</p>
          <h1 className="truncate text-lg font-semibold">{plan.topic}</h1>
        </div>
        <button
          type="button"
          aria-label="Plan options"
          onClick={() => {
            setConfirmReset(false);
            setMenuOpen(true);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'plan' ? (
          <div className="h-full overflow-y-auto">
            <div className="px-4 pb-2 pt-4">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-sm text-neutral-400">{done ? 'Week complete' : 'One step at a time'}</p>
                <p className="text-3xl font-semibold tabular-nums">{progress}%</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {today && (
              <section className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">Today</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{today.title}</h2>
                {openStep && (
                  <button
                    type="button"
                    onClick={() => openSession(today.id, openStep.id)}
                    className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-semibold"
                  >
                    {startLabel}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                )}
                <div className="mt-4 space-y-2">
                  {today.steps.map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      onOpen={() => openSession(today.id, step.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="px-4 pb-2 pt-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Full week</h2>
            </div>
            <PlanView plan={plan} onOpenStep={openSession} hideHeader startCollapsed />
          </div>
        ) : (
          <ChatInterface messages={messages} onSend={onSend} sending={sending} />
        )}
      </div>

      <nav className="grid shrink-0 grid-cols-2 border-t border-neutral-800 bg-neutral-950 pb-[max(0.4rem,env(safe-area-inset-bottom))]" aria-label="Sections">
        <button
          type="button"
          onClick={() => setTab('plan')}
          className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-xs', tab === 'plan' ? 'text-white' : 'text-neutral-500')}
        >
          <Rows3 className="h-5 w-5" />
          Plan
        </button>
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-xs', tab === 'chat' ? 'text-white' : 'text-neutral-500')}
        >
          <MessageCircle className="h-5 w-5" />
          Companion
        </button>
      </nav>
      </>
      )}

      {menuOpen && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={() => setMenuOpen(false)}>
          <div className="w-full space-y-2 rounded-3xl bg-neutral-900 p-3" onClick={(event) => event.stopPropagation()}>
            {confirmReset ? (
              <>
                <p className="px-3 py-2 text-sm leading-6 text-neutral-300">
                  This clears the week saved on this phone. You can start a new topic after.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onReset();
                  }}
                  className="min-h-12 w-full rounded-2xl bg-red-500/15 font-semibold text-red-100"
                >
                  Erase this week
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-12 w-full rounded-2xl text-left px-3 font-medium text-neutral-100"
              >
                Start over
              </button>
            )}
            <button type="button" onClick={() => setMenuOpen(false)} className="min-h-12 w-full rounded-2xl bg-neutral-800 font-semibold">
              Close
            </button>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}
