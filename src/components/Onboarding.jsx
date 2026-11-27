import { useState } from 'react';
import { ArrowRight, BookOpen, Clock, Target } from 'lucide-react';
import PhoneShell from './PhoneShell';
import { cn } from '../lib/utils';

const TIMES = [
  ['15min', '15 minutes'],
  ['30min', '30 minutes'],
  ['1hr', '1 hour'],
  ['2hr+', '2 hours or more'],
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function Onboarding({
  initialProfile,
  onComplete,
  onCancel,
  sampleMode = false,
  banner = '',
  onDismissBanner,
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    topic: initialProfile?.topic || '',
    timeCommitment: initialProfile?.timeCommitment || '30min',
    motivation: initialProfile?.motivation || '',
    level: initialProfile?.level || 'beginner',
  });

  const handleNext = () => {
    if (step === 1 && formData.topic.trim().length < 2) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (step === 4) onComplete({ ...formData, topic: formData.topic.trim(), motivation: formData.motivation.trim() });
    else setStep(step + 1);
  };

  return (
    <PhoneShell sampleMode={sampleMode} banner={banner} onDismissBanner={onDismissBanner}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">Step {step} of 4</p>
          <h1 className="text-3xl font-semibold tracking-tight">Let’s build your week</h1>
        </div>

        <div className="mt-8">
          {step === 1 && (
            <label className="block space-y-3">
              <span className="text-sm text-neutral-300">What do you want to learn?</span>
              <span className="relative block">
                <BookOpen className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-neutral-500" />
                <input
                  type="text"
                  value={formData.topic}
                  autoFocus
                  enterKeyHint="next"
                  maxLength={80}
                  onChange={(event) => setFormData({ ...formData, topic: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleNext();
                  }}
                  placeholder="Python, pottery, Rome..."
                  className="min-h-12 w-full rounded-2xl border border-neutral-700 bg-neutral-900 py-3 pl-11 pr-4 text-base outline-none placeholder:text-neutral-600"
                />
              </span>
            </label>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">How much time do you have each day?</p>
              {TIMES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({ ...formData, timeCommitment: value })}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left',
                    formData.timeCommitment === value ? 'border-blue-500 bg-blue-500/10 text-blue-100' : 'border-neutral-800 bg-neutral-900',
                  )}
                >
                  <Clock className="h-5 w-5 opacity-70" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">Where are you starting?</p>
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, level: level.toLowerCase() })}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left',
                    formData.level === level.toLowerCase() ? 'border-blue-500 bg-blue-500/10 text-blue-100' : 'border-neutral-800 bg-neutral-900',
                  )}
                >
                  <Target className="h-5 w-5 opacity-70" />
                  {level}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <label className="block space-y-3">
              <span className="text-sm text-neutral-300">Why this, right now?</span>
              <textarea
                value={formData.motivation}
                autoFocus
                maxLength={400}
                onChange={(event) => setFormData({ ...formData, motivation: event.target.value })}
                placeholder="A trip, a job, curiosity..."
                className="min-h-36 w-full resize-none rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base outline-none placeholder:text-neutral-600"
              />
              <span className="block text-xs text-neutral-500">Optional. It gives the week a point.</span>
            </label>
          )}
        </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-800 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onCancel && step === 1 && (
            <button type="button" onClick={onCancel} className="min-h-11 text-sm font-medium text-neutral-300">
              Back to your courses
            </button>
          )}
          <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="min-h-14 rounded-2xl border border-neutral-700 px-5 font-semibold text-neutral-200"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={step === 1 && formData.topic.trim().length < 2}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-black disabled:opacity-40"
          >
            {step === 4 ? 'See directions' : 'Next'}
            <ArrowRight className="h-5 w-5" />
          </button>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}
