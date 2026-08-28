import React from 'react';
import { 
  FileEdit, 
  Cpu, 
  Building2, 
  Clock, 
  CheckCircle2, 
  ArrowRight 
} from 'lucide-react';
import Panel from './ui/Panel';

export default function ResolutionPipeline({ className = '' }) {
  const steps = [
    {
      step: '1',
      title: 'Submit your issue',
      desc: 'Provide your name, location, and a brief description of what happened.',
      icon: FileEdit
    },
    {
      step: '2',
      title: 'AI analyzes request',
      desc: 'AI categorizes the issue, determines urgency, and executes safety checks.',
      icon: Cpu
    },
    {
      step: '3',
      title: 'Routed to department',
      desc: 'Linked to existing duplicate issues and assigned to the right team.',
      icon: Building2
    },
    {
      step: '4',
      title: 'SLA monitored',
      desc: 'Resolution deadline tracked automatically with timely staff alerts.',
      icon: Clock
    }
  ];

  return (
    <Panel
      title="How ResolveAI Works"
      subtitle="Autonomous request analysis, department routing, and SLA tracking."
      className={className}
      bodyClassName="p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between space-y-3 relative group hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                    Step {item.step}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-slate-100">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
