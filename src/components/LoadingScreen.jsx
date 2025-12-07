import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ topic, isRevising = false }) {
  const [loadingStep, setLoadingStep] = useState(0);

  const generationSteps = [
    `Analyzing ${topic} ecosystem...`,
    "Identifying key concepts...",
    "Curating high-quality resources...",
    "Structuring your 7-day timeline...",
    "Finalizing daily milestones..."
  ];

  const revisionSteps = [
    "Reviewing your feedback...",
    "Adjusting difficulty levels...",
    "Refining module details...",
    "Updating timeline...",
    "Polishing your personalized plan..."
  ];

  const steps = isRevising ? revisionSteps : generationSteps;

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % steps.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-neutral-950 -z-10" />
      
      {/* Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-2xl">
        <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
            <Loader2 className="h-20 w-20 animate-spin text-blue-500 relative z-10" />
        </div>

        <h2 className="text-3xl font-bold tracking-tight mb-6">
            {isRevising ? "Refining your experience" : "Crafting your journey"}
        </h2>

        <div className="h-12 flex items-center justify-center">
            {steps.map((step, index) => (
                <p
                    key={index}
                    className={`text-xl text-neutral-400 font-medium absolute transition-all duration-500 transform ${
                        index === loadingStep 
                            ? "opacity-100 translate-y-0 scale-100" 
                            : "opacity-0 translate-y-4 scale-95"
                    }`}
                >
                    {step}
                </p>
            ))}
        </div>
      </div>
    </div>
  );
}
