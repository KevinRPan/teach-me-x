import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { STEP_LABEL } from '../lib/plan';

export default function Learn({
  courses,
  activeCourseId,
  feed,
  onOpenCourse,
  onAddCourse,
  onTake,
  onSkip,
  onRefreshFeed,
}) {
  const [pane, setPane] = useState('courses');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const featured = feed[0];
  const rest = feed.slice(1);

  const run = async (action) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message || 'Try that again.');
    } finally {
      setBusy(false);
    }
  };

  const showFeed = () => {
    setPane('feed');
    if (!feed.length) run(() => onRefreshFeed(false));
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-6 pt-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-900 p-1">
        <button
          type="button"
          onClick={() => setPane('courses')}
          className={cn('min-h-10 rounded-xl text-sm font-medium', pane === 'courses' ? 'bg-neutral-700 text-white' : 'text-neutral-400')}
        >
          Courses
        </button>
        <button
          type="button"
          onClick={showFeed}
          className={cn('min-h-10 rounded-xl text-sm font-medium', pane === 'feed' ? 'bg-neutral-700 text-white' : 'text-neutral-400')}
        >
          Feed
        </button>
      </div>

      {error && <p className="mt-3 text-sm leading-6 text-red-100">{error}</p>}

      {pane === 'courses' ? (
        <div className="mt-4 space-y-3">
          {courses.map((course) => {
            const current = course.id === activeCourseId;
            return (
              <button
                key={course.id}
                type="button"
                disabled={busy || current}
                onClick={() => run(() => onOpenCourse(course.id))}
                className={cn(
                  'w-full rounded-3xl border px-4 py-4 text-left disabled:opacity-100',
                  current ? 'border-blue-500/40 bg-blue-500/10' : 'border-neutral-800 bg-neutral-900/70',
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300">
                  {current ? 'Now' : 'Course'}
                </span>
                <span className="mt-1 block text-lg font-semibold">{course.topic}</span>
                {course.place && <span className="mt-1 block text-sm text-neutral-400">{course.place}</span>}
                <span className="mt-3 block h-1 overflow-hidden rounded-full bg-neutral-800">
                  <span className="block h-full bg-blue-500" style={{ width: `${course.progress || 0}%` }} />
                </span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onAddCourse)}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-700 font-semibold disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Add a course
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {!feed.length && (
            <div className="rounded-3xl border border-neutral-800 px-4 py-8 text-center">
              <p className="text-sm leading-6 text-neutral-400">
                {busy ? 'Looking for things near your courses.' : 'Nothing new right now.'}
              </p>
              {!busy && (
                <button type="button" onClick={() => run(() => onRefreshFeed(true))} className="mt-4 min-h-11 text-sm font-semibold text-blue-300">
                  Look again
                </button>
              )}
            </div>
          )}

          {featured && (
            <article className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300">{featured.topic}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{featured.title}</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-300">{featured.detail}</p>
              {featured.why && <p className="mt-2 text-sm text-neutral-500">{featured.why}</p>}
              <p className="mt-3 text-[11px] uppercase tracking-wide text-neutral-500">
                {STEP_LABEL[featured.type] || 'Step'} · {featured.duration}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => onTake(featured.id))}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-semibold disabled:opacity-50"
              >
                Do this
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => onSkip(featured.id))}
                className="mt-2 min-h-11 w-full text-sm text-neutral-500 disabled:opacity-50"
              >
                Skip
              </button>
            </article>
          )}

          {rest.length > 0 && (
            <ul className="mt-4">
              {rest.map((item) => (
                <li key={item.id} className="border-b border-neutral-800">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => onTake(item.id))}
                    className="flex min-h-14 w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-neutral-500">{item.topic}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-neutral-500">{item.duration}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {feed.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => onRefreshFeed(true))}
              className="mt-4 min-h-11 text-sm font-semibold text-neutral-400 disabled:opacity-50"
            >
              More like this
            </button>
          )}
        </div>
      )}
    </div>
  );
}
