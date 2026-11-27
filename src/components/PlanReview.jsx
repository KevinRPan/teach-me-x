import { CheckCircle2 } from 'lucide-react';
import PhoneShell from './PhoneShell';
import PlanView from './PlanView';

export default function PlanReview({
  plan,
  userProfile,
  selectedPathways = [],
  onConfirm,
  onRevise,
  onReset,
  onReturn,
  hasRevised = false,
  sampleMode = false,
  banner = '',
  onDismissBanner,
}) {
  const focus = selectedPathways.map((pathway) => pathway.title).join(' · ');

  return (
    <PhoneShell locked sampleMode={sampleMode} banner={banner} onDismissBanner={onDismissBanner}>
      <div className="border-b border-neutral-800 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">Review</p>
        <h1 className="mt-1 text-2xl font-semibold">Your week is ready</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {userProfile?.level || 'Beginner'} · {userProfile?.timeCommitment || '30min'} a day
          {focus ? ` · ${focus}` : ''}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlanView plan={plan} readOnly />
      </div>
      <div className="shrink-0 space-y-3 border-t border-neutral-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onConfirm}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-semibold"
        >
          <CheckCircle2 className="h-5 w-5" />
          Start this week
        </button>
        {!hasRevised && (
          <button
            type="button"
            onClick={onRevise}
            className="min-h-12 w-full rounded-2xl border border-neutral-700 font-semibold text-neutral-200"
          >
            Change something
          </button>
        )}
        {onReturn ? (
          <button type="button" onClick={onReturn} className="min-h-11 w-full text-sm text-neutral-400">
            Back to your courses
          </button>
        ) : (
          <button type="button" onClick={onReset} className="min-h-11 w-full text-sm text-neutral-500">
            Start over
          </button>
        )}
      </div>
    </PhoneShell>
  );
}
