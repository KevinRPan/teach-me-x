import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PhoneShell from './PhoneShell';

export default function LoadingScreen({ topic = 'this topic', isRevising = false, sampleMode = false, label }) {
  const [loadingStep, setLoadingStep] = useState(0);
  const steps = label
    ? [label]
    : isRevising
      ? [
          'Reading what you want changed...',
          'Shifting the week...',
          'Checking it still fits your time...',
        ]
      : sampleMode
        ? [
            `Sketching a practice week for ${topic}...`,
            'Picking a few directions...',
            'Keeping each day small...',
          ]
        : [
            `Looking at ${topic}...`,
            'Choosing a path you can finish...',
            'Fitting the days to your time...',
          ];

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStep((previous) => (previous + 1) % steps.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <PhoneShell locked sampleMode={sampleMode}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <h1 className="mt-6 text-2xl font-semibold">
          {label || (isRevising ? 'Reworking the week' : 'Building your week')}
        </h1>
        <p className="mt-3 min-h-12 text-base text-neutral-400">{steps[loadingStep]}</p>
      </div>
    </PhoneShell>
  );
}
