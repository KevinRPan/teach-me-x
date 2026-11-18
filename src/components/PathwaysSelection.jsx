import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import PhoneShell from './PhoneShell';
import { cn } from '../lib/utils';

export default function PathwaysSelection({
  pathways,
  topic,
  onConfirm,
  onBack,
  sampleMode = false,
  banner = '',
  onDismissBanner,
}) {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PhoneShell sampleMode={sampleMode} banner={banner} onDismissBanner={onDismissBanner}>
      <div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onBack} className="mt-3 inline-flex min-h-11 items-center gap-2 self-start text-sm text-neutral-300">
          <ArrowLeft className="h-4 w-4" />
          Edit answers
        </button>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">Directions</p>
          <h1 className="text-3xl font-semibold tracking-tight">What should this week emphasize?</h1>
          <p className="text-sm leading-6 text-neutral-400">
            Pick one or more ways into {topic}. The plan will lean that way.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {pathways.map((pathway) => {
            const active = selected.has(pathway.id);
            return (
              <button
                key={pathway.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(pathway.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                  active ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-800 bg-neutral-900/80',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    active ? 'border-blue-400 bg-blue-500 text-white' : 'border-neutral-600',
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
                <span>
                  <span className="block font-semibold text-white">{pathway.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-neutral-400">{pathway.learning_goal}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onConfirm([...selected])}
          className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-base font-semibold text-black disabled:opacity-40"
        >
          Build this week
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </PhoneShell>
  );
}
