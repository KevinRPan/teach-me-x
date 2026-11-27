import { useState } from 'react';
import { ArrowRight, CircleDot, Library, MessageCircle, MoreHorizontal } from 'lucide-react';
import PhoneShell from './PhoneShell';
import ChatInterface from './ChatInterface';
import Activity from './Activity';
import Journey from './Journey';
import Learn from './Learn';
import { cn } from '../lib/utils';
import { STEP_LABEL, currentDay, firstOpenStep, isWeekComplete } from '../lib/plan';

export default function Dashboard({
  plan,
  messages,
  courses,
  feed,
  activeCourseId,
  sampleMode,
  banner,
  onDismissBanner,
  onSaveStep,
  onSend,
  onReset,
  onLeaveCourse,
  onAddCourse,
  onOpenCourse,
  onLoadFeed,
  onTakeFeed,
  onSkipFeed,
  sending,
}) {
  const [tab, setTab] = useState('now');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [session, setSession] = useState(null);
  const [journey, setJourney] = useState(false);
  const today = currentDay(plan);
  const done = isWeekComplete(plan);
  const step = today ? (done ? today.steps[today.steps.length - 1] : firstOpenStep(today)) : null;
  const dayIndex = today ? plan.days.findIndex((day) => day.id === today.id) : 0;

  const closeSession = () => setSession(null);
  const openSession = (dayId, stepId) => {
    setJourney(false);
    setTab('now');
    setMenuOpen(false);
    setSession({ dayId, stepId });
  };

  const continueLabel = done ? 'Review' : step && today.steps.some((item) => item.completed) ? 'Continue' : 'Start';

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
      ) : journey ? (
        <Journey plan={plan} onClose={() => setJourney(false)} onOpenStep={openSession} />
      ) : (
      <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            {tab === 'learn' ? 'Learn' : 'Now'}
          </p>
          <h1 className="truncate text-lg font-semibold">{plan.topic}</h1>
        </div>
        <button
          type="button"
          aria-label="Plan options"
          onClick={() => {
            setConfirmReset(false);
            setConfirmLeave(false);
            setMenuOpen(true);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'now' ? (
          <div className="h-full overflow-y-auto px-5 pb-8 pt-6">
            <button type="button" onClick={() => setJourney(true)} className="block w-full text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300">
                Day {dayIndex + 1} of {plan.days.length}
              </p>
              <p className="mt-1 text-sm text-neutral-400">{today?.title}</p>
              <span className="mt-3 flex gap-1" aria-hidden="true">
                {plan.days.map((day, index) => {
                  const complete = day.steps.every((item) => item.completed);
                  return (
                    <span
                      key={day.id}
                      className={cn(
                        'h-1.5 flex-1 rounded-full',
                        index === dayIndex ? 'bg-blue-400' : complete ? 'bg-blue-500/60' : 'bg-neutral-800',
                      )}
                    />
                  );
                })}
              </span>
              <span className="mt-3 block text-sm font-medium text-neutral-300">See the journey</span>
            </button>

            {step && (
              <button
                type="button"
                onClick={() => openSession(today.id, step.id)}
                className="mt-6 block w-full rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5 text-left"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  {STEP_LABEL[step.type] || 'Step'} · {step.duration}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">{done ? 'This week is finished' : step.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-400">
                  {done ? 'Every step this week is checked off.' : step.detail}
                </p>
              </button>
            )}

            {step && (
              <button
                type="button"
                onClick={() => openSession(today.id, step.id)}
                className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-semibold"
              >
                {continueLabel}
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        ) : tab === 'learn' ? (
          <Learn
            courses={courses}
            activeCourseId={activeCourseId}
            feed={feed}
            onOpenCourse={onOpenCourse}
            onAddCourse={onAddCourse}
            onTake={async (feedId) => {
              const focus = await onTakeFeed(feedId);
              if (focus?.dayId && focus?.stepId) openSession(focus.dayId, focus.stepId);
            }}
            onSkip={onSkipFeed}
            onRefreshFeed={onLoadFeed}
          />
        ) : (
          <ChatInterface messages={messages} onSend={onSend} sending={sending} />
        )}
      </div>

      <nav className="grid shrink-0 grid-cols-3 border-t border-neutral-800 bg-neutral-950 pb-[max(0.4rem,env(safe-area-inset-bottom))]" aria-label="Sections">
        <button
          type="button"
          onClick={() => setTab('now')}
          className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-xs', tab === 'now' ? 'text-white' : 'text-neutral-500')}
        >
          <CircleDot className="h-5 w-5" />
          Now
        </button>
        <button
          type="button"
          onClick={() => setTab('learn')}
          className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-xs', tab === 'learn' ? 'text-white' : 'text-neutral-500')}
        >
          <Library className="h-5 w-5" />
          Learn
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
            {confirmLeave ? (
              <p className="px-3 py-2 text-sm leading-6 text-neutral-300">
                This takes the current course off this phone. Other courses stay.
              </p>
            ) : confirmReset ? (
              <p className="px-3 py-2 text-sm leading-6 text-neutral-300">
                This clears every course saved on this phone.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="min-h-12 w-full rounded-2xl px-3 text-left font-medium"
                >
                  Leave this course
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-12 w-full rounded-2xl px-3 text-left font-medium text-neutral-300"
                >
                  Erase everything
                </button>
              </>
            )}
            {confirmLeave && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLeaveCourse();
                }}
                className="min-h-12 w-full rounded-2xl bg-red-500/15 font-semibold text-red-100"
              >
                Leave this course
              </button>
            )}
            {confirmReset && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReset();
                }}
                className="min-h-12 w-full rounded-2xl bg-red-500/15 font-semibold text-red-100"
              >
                Erase everything
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
