import React, { useEffect, useState } from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Building2, 
  ShieldCheck 
} from 'lucide-react';

/**
 * ProcessingState Component
 * Clean loading state shown while the backend request is being processed.
 */
export default function ProcessingState({ className = '' }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStep(1), 800);
    const timer2 = setTimeout(() => setActiveStep(2), 1600);
    const timer3 = setTimeout(() => setActiveStep(3), 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const steps = [
    {
      title: 'Analyzing request context',
      desc: 'Understanding the reported issue and checking urgency indicators.',
      icon: Cpu
    },
    {
      title: 'Classifying category & priority',
      desc: 'Determining issue type and assessing safety and operational priority.',
      icon: ShieldCheck
    },
    {
      title: 'Routing to department',
      desc: 'Checking for existing duplicate issues and assigning to the team.',
      icon: Building2
    },
    {
      title: 'Initializing SLA monitoring',
      desc: 'Setting resolution deadline and scheduling SLA tracking alerts.',
      icon: Clock
    }
  ];

  return (
    <div className={`py-6 space-y-6 ${className}`}>
      
      {/* Header */}
      <div className="text-center space-y-2 pb-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-white">
          Submitting your request...
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          ResolveAI is analyzing your issue, determining priority, and routing to the right department.
        </p>
      </div>

      {/* Progress steps */}
      <div className="space-y-2.5 max-w-md mx-auto">
        {steps.map((step, idx) => {
          const isCurrent = activeStep === idx;
          const isPassed = activeStep > idx;
          const StepIcon = step.icon;

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition-all duration-300 flex items-start gap-3 ${
                isCurrent
                  ? 'bg-indigo-600/10 border-indigo-500/40 text-slate-200'
                  : isPassed
                  ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                  : 'bg-slate-900/30 border-slate-800/40 text-slate-500 opacity-50'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : (
                  <StepIcon className="w-4 h-4 text-slate-500" />
                )}
              </div>

              <div>
                <h4 className={`text-xs font-semibold ${isCurrent ? 'text-indigo-300' : (isPassed ? 'text-slate-200' : 'text-slate-400')}`}>
                  {step.title}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
