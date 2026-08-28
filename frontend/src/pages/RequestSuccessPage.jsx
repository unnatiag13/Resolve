import React, { useState } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  Bot, 
  CheckCircle2, 
  Copy, 
  Check, 
  Clock, 
  Building2, 
  Tag, 
  AlertTriangle, 
  GitBranch, 
  ArrowLeft,
  RotateCcw,
  Home
} from 'lucide-react';
import Panel from '../components/ui/Panel';
import StatusBadge from '../components/ui/StatusBadge';
import CommandButton from '../components/ui/CommandButton';

export default function RequestSuccessPage() {
  const { requestId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Read data passed via navigation state, with fallback to URL param
  const data = location.state?.data || { id: requestId, status: 'TRIAGED' };

  const handleCopyId = () => {
    if (!requestId && !data?.id) return;
    navigator.clipboard.writeText(data?.id || requestId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formattedDueAt = formatTimestamp(data.dueAt);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/80 border-b border-slate-800/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </Link>

          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-white">Resolve<span className="text-indigo-400">AI</span></span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
        
        {/* Success Confirmation Card */}
        <div className="surface-card p-6 sm:p-8 space-y-6">
          
          {/* Header Banner */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Request Submitted Successfully
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                Your issue has been logged, analyzed by AI, and routed to the responsible department with an active SLA timer.
              </p>
            </div>
          </div>

          {/* Ticket Information Panel */}
          <div className="surface-elevated p-5 space-y-4">
            
            {/* Request ID & Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/50">
              <div>
                <span className="text-xs text-slate-400 font-medium block">
                  Request ID
                </span>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold text-indigo-400 font-mono">
                    {data.id || requestId}
                  </span>
                  <button
                    onClick={handleCopyId}
                    title="Copy Request ID"
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-400 font-medium block">
                  Status
                </span>
                <div className="mt-1">
                  <StatusBadge status={data.status || 'TRIAGED'} label={data.status || 'Triaged'} />
                </div>
              </div>
            </div>

            {/* 2x2 Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              
              {/* Category */}
              {data.category && (
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block font-medium">Category</span>
                    <span className="text-slate-100 font-semibold text-sm mt-0.5 block">{data.category}</span>
                  </div>
                  <Tag className="w-4 h-4 text-slate-500" />
                </div>
              )}

              {/* Priority */}
              {data.priority && (
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block font-medium">Priority</span>
                    <div className="mt-1">
                      <StatusBadge status={data.priority} label={data.priority} />
                    </div>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-slate-500" />
                </div>
              )}

              {/* Department */}
              {data.department && (
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block font-medium">Department</span>
                    <span className="text-slate-100 font-semibold text-sm mt-0.5 block">{data.department}</span>
                  </div>
                  <Building2 className="w-4 h-4 text-slate-500" />
                </div>
              )}

              {/* SLA Hours */}
              {data.slaHours && (
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block font-medium">Target SLA</span>
                    <span className="text-emerald-400 font-semibold text-sm mt-0.5 block">
                      {data.slaHours} Hours
                    </span>
                  </div>
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
              )}

            </div>

            {/* Due Date (If available) */}
            {formattedDueAt && (
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Resolution Due Date</span>
                <span className="text-slate-200 font-semibold">{formattedDueAt}</span>
              </div>
            )}

            {/* Duplicate Linked Incident (If available) */}
            {data.incidentId && (
              <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Linked to Parent Incident:</span>
                </div>
                <strong className="text-indigo-200 font-mono text-xs">{data.incidentId}</strong>
              </div>
            )}

          </div>

          {/* Action Buttons: "Report another issue" & "Back to home" */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              to="/report"
              className="w-full sm:w-1/2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Report another issue</span>
            </Link>

            <Link
              to="/"
              className="w-full sm:w-1/2 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-[#0f172a] border-t border-slate-800/80 px-6 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>ResolveAI &mdash; AI-Powered Request Resolution</span>
          </div>
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            Return to Homepage
          </Link>
        </div>
      </footer>

    </div>
  );
}
