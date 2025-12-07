import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { ArrowRight, BookOpen, Clock, Target } from 'lucide-react';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    topic: '',
    timeCommitment: '30min',
    motivation: '',
    level: 'beginner'
  });

  const handleNext = () => {
    // Basic validation
    if (step === 1 && !formData.topic) return;
    if (step === 4) {
      onComplete(formData);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-neutral-950 -z-10" />

      <div className="w-full max-w-lg space-y-8 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">Let's build your plan</h1>
          <p className="text-neutral-400">Step {step} of 4</p>
        </div>

        {/* Form Steps */}
        <div className="bg-neutral-900/80 backdrop-blur-md p-8 rounded-3xl border border-neutral-800 shadow-2xl">
          
          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-300">
                What do you want to learn?
              </label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({...formData, topic: e.target.value})}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  placeholder="e.g. Python, Pottery, History of Rome..."
                  className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-neutral-600"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
               <label className="block text-sm font-medium text-neutral-300">
                How much time do you have daily?
              </label>
              <div className="grid grid-cols-1 gap-3">
                {['15min', '30min', '1hr', '2hr+'].map((time) => (
                  <button
                    key={time}
                    onClick={() => setFormData({...formData, timeCommitment: time})}
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    className={cn(
                      "flex items-center p-4 rounded-xl border transition-all text-left",
                      formData.timeCommitment === time 
                        ? "border-blue-500 bg-blue-500/10 text-blue-200" 
                        : "border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300"
                    )}
                  >
                    <Clock className="h-5 w-5 mr-3 opacity-70" />
                    <span>{time}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
               <label className="block text-sm font-medium text-neutral-300">
                What is your current level?
              </label>
              <div className="grid grid-cols-1 gap-3">
                {['Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setFormData({...formData, level: lvl.toLowerCase()})}
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    className={cn(
                      "flex items-center p-4 rounded-xl border transition-all text-left",
                      formData.level === lvl.toLowerCase()
                        ? "border-blue-500 bg-blue-500/10 text-blue-200" 
                        : "border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300"
                    )}
                  >
                    <Target className="h-5 w-5 mr-3 opacity-70" />
                    <span>{lvl}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
           {step === 4 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-300">
                Why are you learning this? (Optional)
              </label>
              <textarea
                value={formData.motivation}
                onChange={(e) => setFormData({...formData, motivation: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleNext();
                  }
                }}
                placeholder="To get a job, just for fun, etc..."
                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none placeholder:text-neutral-600"
                autoFocus
              />
            </div>
          )}

          <div className="pt-6 mt-6 border-t border-neutral-700 flex justify-end">
            <button
              onClick={handleNext}
              disabled={step === 1 && !formData.topic}
              className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {step === 4 ? 'Generate Plan' : 'Next'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
