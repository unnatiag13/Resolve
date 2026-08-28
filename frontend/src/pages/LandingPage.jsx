import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Cpu, 
  ShieldAlert, 
  GitBranch,
  BellRing,
  Sparkles,
  ChevronRight,
  FileEdit,
  Activity
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

export default function LandingPage() {
  const workflowSteps = [
    {
      num: '01',
      title: 'Submit',
      subtitle: 'Describe what happened',
      desc: 'Students or staff submit an issue with location and contact details in under a minute.',
      icon: FileEdit
    },
    {
      num: '02',
      title: 'Analyze',
      subtitle: 'AI evaluates the request',
      desc: 'ResolveAI identifies the category, assigns urgency level, and checks for safety risks.',
      icon: Cpu
    },
    {
      num: '03',
      title: 'Track',
      subtitle: 'Monitored against SLA',
      desc: 'The ticket is automatically routed to Maintenance, IT, or Operations with an active countdown clock.',
      icon: Clock
    },
    {
      num: '04',
      title: 'Resolve',
      subtitle: 'Verified closure',
      desc: 'The responsible team fixes the issue, updates the requester, and logs the verified resolution.',
      icon: CheckCircle2
    }
  ];

  const features = [
    {
      title: 'Automatic Classification & Triage',
      desc: 'Understands natural language descriptions of campus issues and categorizes them accurately without manual tagging.',
      icon: Cpu,
      tag: 'Multi-Model AI'
    },
    {
      title: 'Intelligent Department Routing',
      desc: 'Dispatches tickets directly to Maintenance, IT Helpdesk, or Academic Operations teams based on issue type and location.',
      icon: Building2,
      tag: 'Automated Dispatch'
    },
    {
      title: 'Duplicate Request Correlation',
      desc: 'Detects overlapping issues from the same building or hostel block to prevent redundant team dispatch.',
      icon: GitBranch,
      tag: 'Deduplication'
    },
    {
      title: 'Guaranteed SLA Monitoring',
      desc: 'Enforces clear resolution timelines from 4 hours for emergencies to 24 hours for standard requests.',
      icon: Clock,
      tag: 'SLA Engine'
    },
    {
      title: 'Automated Pre-Breach Reminders',
      desc: 'Alerts assigned staff in advance when a request approaches its deadline so nothing slips through the cracks.',
      icon: BellRing,
      tag: 'Proactive Alerts'
    },
    {
      title: 'Management Escalation Protocol',
      desc: 'Automatically escalates overdue or high-safety issues to department heads and facilities leadership.',
      icon: ShieldAlert,
      tag: 'Escalations'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#0b0f17]/90 border-b border-slate-800/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:border-indigo-400 transition-colors">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base text-white">Resolve<span className="text-indigo-400">AI</span></span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">AI-Powered Request Resolution</p>
            </div>
          </Link>

          {/* Navigation Links & CTA */}
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400 font-medium">
              <a href="#how-it-works" className="hover:text-slate-200 transition-colors">How it works</a>
              <a href="#capabilities" className="hover:text-slate-200 transition-colors">Capabilities</a>
              <a href="#slas" className="hover:text-slate-200 transition-colors">SLA Targets</a>
            </nav>

            <Link
              to="/report"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <span>Report an issue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-24">
        
        {/* ================= HERO SECTION ================= */}
        <section className="text-center max-w-3xl mx-auto space-y-6 pt-4">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Campus Support & SLA Management</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.15]">
            Every issue deserves a <span className="text-indigo-400">faster response.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto font-normal">
            ResolveAI analyzes incoming requests, identifies the right team, sets response priorities, and helps ensure nothing is missed.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/report"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <span>Report an issue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-sm font-medium transition-all"
            >
              <span>See how it works</span>
            </a>
          </div>

        </section>

        {/* ================= HOW IT WORKS SECTION ================= */}
        <section id="how-it-works" className="space-y-8 scroll-mt-24">
          
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              How ResolveAI Works
            </h2>
            <p className="text-sm text-slate-400">
              A transparent, automated lifecycle from submission to verified resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {workflowSteps.map((step) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.num}
                  className="surface-card p-6 flex flex-col justify-between space-y-4 relative group hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        {step.num}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {step.title}
                      </h3>
                      <p className="text-xs text-indigo-400/90 font-medium mt-0.5">
                        {step.subtitle}
                      </p>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed font-normal">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </section>

        {/* ================= CAPABILITIES & DIFFERENTIATION ================= */}
        <section id="capabilities" className="space-y-8 scroll-mt-24">
          
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Built for Fast Campus Operations
            </h2>
            <p className="text-sm text-slate-400">
              Deterministic routing and real-time SLA enforcement for facilities, IT, and campus administration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="surface-card p-6 space-y-3.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                      {feat.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100">
                    {feat.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </section>

        {/* ================= SLA TARGETS SECTION ================= */}
        <section id="slas" className="surface-card p-8 sm:p-10 space-y-6 scroll-mt-24">
          
          <div className="max-w-2xl space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Guaranteed SLA Resolution Targets
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Every request is assigned a strict response deadline based on urgency and risk assessment.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="surface-elevated p-4 space-y-1">
              <span className="text-xs font-semibold text-rose-400 block">Critical Risk</span>
              <span className="text-xl font-bold text-white block">4 Hours SLA</span>
              <p className="text-[11px] text-slate-400">Water floods, power outages, safety hazards</p>
            </div>

            <div className="surface-elevated p-4 space-y-1">
              <span className="text-xs font-semibold text-amber-400 block">High Priority</span>
              <span className="text-xl font-bold text-white block">12 Hours SLA</span>
              <p className="text-[11px] text-slate-400">Classroom projector failures, major AC faults</p>
            </div>

            <div className="surface-elevated p-4 space-y-1">
              <span className="text-xs font-semibold text-indigo-400 block">Medium Priority</span>
              <span className="text-xl font-bold text-white block">24 Hours SLA</span>
              <p className="text-[11px] text-slate-400">Hostel room fixtures, Wi-Fi connectivity</p>
            </div>

            <div className="surface-elevated p-4 space-y-1">
              <span className="text-xs font-semibold text-emerald-400 block">General Support</span>
              <span className="text-xl font-bold text-white block">48 Hours SLA</span>
              <p className="text-[11px] text-slate-400">Routine maintenance & non-blocking inquiries</p>
            </div>
          </div>

        </section>

        {/* ================= FINAL CALL TO ACTION ================= */}
        <section className="text-center surface-card p-10 sm:p-14 space-y-5 bg-gradient-to-b from-[#111827] to-[#0b0f17]">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Have a problem on campus?
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Submit your issue in less than a minute. ResolveAI will triage and route it to the right department immediately.
          </p>
          <div className="pt-2">
            <Link
              to="/report"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <span>Report an issue now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* Clean Modern Footer */}
      <footer className="bg-[#0f172a] border-t border-slate-800/80 px-6 py-10 text-xs text-slate-500 mt-16">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200">Resolve<span className="text-indigo-400">AI</span></span>
              <span className="text-slate-500 ml-2">&mdash; AI-Powered Request Resolution</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <Link to="/report" className="hover:text-white transition-colors">Report an Issue</Link>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
