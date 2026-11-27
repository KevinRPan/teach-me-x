import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { STEP_LABEL } from '../lib/plan';

function lessonUrl(step) {
  return step?.url && /^https:\/\//i.test(step.url) ? step.url : '';
}

export default function Activity({
  plan,
  dayId,
  stepId,
  onClose,
  onGoto,
  onSave,
}) {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const scrollerRef = useRef(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState({});

  const day = plan?.days?.find((item) => item.id === dayId) || null;
  const step = day?.steps?.find((item) => item.id === stepId) || null;
  const index = day ? day.steps.findIndex((item) => item.id === stepId) : -1;
  const notes = drafts[stepId]?.notes ?? step?.notes ?? {};
  const picks = drafts[stepId]?.picks ?? step?.picks ?? {};
  const lessonReady = Boolean(step?.lesson);

  useEffect(() => {
    scrollerRef.current?.scrollTo(0, 0);
    setError('');
  }, [stepId]);

  useEffect(() => {
    if (!dayId || !stepId || lessonReady) return undefined;
    let cancelled = false;
    saveRef.current(dayId, stepId, {})
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Could not open this step.');
      });
    return () => {
      cancelled = true;
    };
  }, [dayId, stepId, lessonReady]);

  useEffect(() => {
    if (day && step) return;
    onClose();
  }, [day, step, onClose]);

  if (!day || !step) return null;

  const lesson = step.lesson;
  const last = index === day.steps.length - 1;
  const url = lessonUrl(step);

  const remember = (next) => {
    setDrafts((current) => ({
      ...current,
      [stepId]: {
        notes: next.notes ?? notes,
        picks: next.picks ?? picks,
      },
    }));
  };

  const go = async (toStepId, complete) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const extra = { notes, picks };
      if (complete) extra.complete = true;
      await onSave(day.id, step.id, extra);
      if (toStepId) onGoto(toStepId);
      else onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not save this step.');
    } finally {
      setSaving(false);
    }
  };

  const retry = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(day.id, step.id, { refresh: true, notes, picks });
    } catch (saveError) {
      setError(saveError.message || 'Could not rewrite this step.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (lesson ? go(null, false) : onClose())}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-neutral-300 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Plan
          </button>
          <p className="text-sm tabular-nums text-neutral-400">
            {index + 1} of {day.steps.length}
          </p>
        </div>
        <p className="mt-1 truncate text-sm text-neutral-500">{day.title}</p>
        <div
          className="mt-3 flex gap-1"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={day.steps.length}
          aria-label="Steps in this day"
        >
          {day.steps.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                itemIndex === index ? 'bg-blue-400' : item.completed ? 'bg-blue-500/70' : 'bg-neutral-800',
              )}
            />
          ))}
        </div>
      </header>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {STEP_LABEL[step.type] || 'Step'} · {step.duration}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{step.title}</h1>

        {!lesson && !error && (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <p className="mt-4 text-sm text-neutral-400">Writing this step so you can do it here.</p>
          </div>
        )}

        {!lesson && error && (
          <div className="mt-8 rounded-2xl border border-neutral-800 px-4 py-5">
            <p className="text-sm leading-6 text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError('');
                saveRef.current(day.id, step.id, {}).catch((loadError) => {
                  setError(loadError.message || 'Could not open this step.');
                });
              }}
              className="mt-4 min-h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-black"
            >
              Try again
            </button>
          </div>
        )}

        {lesson && (
          <div className="mt-4">
            {lesson.source === 'backup' && (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-amber-400/10 px-3 py-3 text-sm leading-6 text-amber-100">
                <p>A stand-in, because a lesson written for this step didn’t come back.</p>
                <button type="button" onClick={retry} disabled={saving} className="shrink-0 font-semibold disabled:opacity-50">
                  Retry
                </button>
              </div>
            )}

            {lesson.lead && <p className="text-base leading-7 text-neutral-200">{lesson.lead}</p>}

            <div className="mt-5 space-y-5">
              {lesson.blocks.map((block, blockIndex) => (
                <section key={`${blockIndex}-${block.heading}`}>
                  {block.heading && <h2 className="text-base font-semibold">{block.heading}</h2>}
                  <p className={cn('text-sm leading-6 text-neutral-300', block.heading && 'mt-1')}>{block.body}</p>
                </section>
              ))}
            </div>

            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-blue-300"
              >
                {step.type === 'video' ? 'Open video' : step.type === 'article' ? 'Open reading' : 'Open source'}
              </a>
            )}

            {lesson.prompts.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">Your turn</h2>
                <div className="mt-3 space-y-5">
                  {lesson.prompts.map((prompt, promptIndex) => (
                    <label key={prompt.id} className="block">
                      <span className="text-sm font-medium leading-6 text-neutral-100">
                        {promptIndex + 1}. {prompt.label}
                      </span>
                      <textarea
                        value={notes[prompt.id] || ''}
                        maxLength={2000}
                        onChange={(event) => remember({ notes: { ...notes, [prompt.id]: event.target.value } })}
                        placeholder={prompt.hint || 'Write a few words'}
                        className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base leading-6 outline-none placeholder:text-neutral-600"
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}

            {lesson.checks.length > 0 && (
              <section className="mt-8 space-y-6">
                <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">Check yourself</h2>
                {lesson.checks.map((check, checkIndex) => {
                  const selected = picks[check.id];
                  const answered = Number.isInteger(selected);
                  return (
                    <fieldset key={check.id}>
                      <legend className="text-sm font-medium leading-6 text-neutral-100">
                        {checkIndex + 1}. {check.question}
                      </legend>
                      <div className="mt-2 space-y-2">
                        {check.options.map((option, optionIndex) => {
                          const chosen = selected === optionIndex;
                          const correct = optionIndex === check.answer;
                          return (
                            <button
                              key={`${check.id}-${optionIndex}`}
                              type="button"
                              aria-pressed={chosen}
                              onClick={() => remember({ picks: { ...picks, [check.id]: optionIndex } })}
                              className={cn(
                                'flex min-h-12 w-full items-center rounded-2xl border px-3 text-left text-sm leading-5',
                                answered && correct && 'border-green-500/50 bg-green-500/10',
                                answered && chosen && !correct && 'border-red-400/40 bg-red-500/10',
                                !answered && chosen && 'border-blue-500 bg-blue-500/10',
                                !chosen && !(answered && correct) && 'border-neutral-800 bg-neutral-900',
                              )}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {answered && check.why && (
                        <p className="mt-2 text-sm leading-6 text-neutral-400">{check.why}</p>
                      )}
                    </fieldset>
                  );
                })}
              </section>
            )}
          </div>
        )}
      </div>

      {lesson && (
        <div className="shrink-0 border-t border-neutral-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-2 text-sm leading-6 text-red-100">{error}</p>}
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => go(day.steps[index - 1].id, false)}
                className="min-h-14 rounded-2xl bg-neutral-900 px-4 font-semibold disabled:opacity-50"
              >
                Previous
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => go(last ? null : day.steps[index + 1].id, true)}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : last ? 'Finish' : 'Next'}
              {!saving && !last && <ArrowRight className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
