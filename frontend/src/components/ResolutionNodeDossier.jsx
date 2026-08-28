import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Clock, 
  Building2, 
  Tag, 
  AlertTriangle, 
  GitBranch, 
  Calendar, 
  RotateCcw
} from 'lucide-react';
import StatusBadge from './ui/StatusBadge';
import CommandButton from './ui/CommandButton';

/**
 * ResolutionNodeDossier Component
 * Displays the verified request creation confirmation using real backend data.
 */
export default function ResolutionNodeDossier({ data, onReset, className = '' }) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const handleCopyId = () => {
    if (!data.id) return;
    navigator.clipboard.writeText(data.id);
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
    <div className={`space-y-6 animate-fadeIn ${className}`}>
      
      {/* Success banner */}
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">
            Request Submitted Successfully
          </h3>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Your issue has been logged, analyzed by AI, and routed to the responsible department with an active SLA timer.
          </p>
        </div>
      </div>

      {/* Ticket Details Card */}
      <div className="surface-elevated p-5 space-y-4">
        
        {/* Header: Request ID and Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/50">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              Request ID
            </span>
            <div className="flex items-center gap-2.5 mt-1">
              <span className="text-2xl font-bold text-indigo-400 font-mono">
                {data.id}
              </span>
              <button
                onClick={handleCopyId}
                title="Copy Request ID"
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
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
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Category</span>
              <span className="text-slate-100 font-semibold text-sm mt-0.5 block">{data.category || 'General'}</span>
            </div>
            <Tag className="w-4 h-4 text-slate-500" />
          </div>

          {/* Priority */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Priority</span>
              <div className="mt-1">
                <StatusBadge status={data.priority} label={data.priority || 'Normal'} />
              </div>
            </div>
            <AlertTriangle className="w-4 h-4 text-slate-500" />
          </div>

          {/* Department */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Department</span>
              <span className="text-slate-100 font-semibold text-sm mt-0.5 block">{data.department || 'Maintenance'}</span>
            </div>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>

          {/* SLA Hours */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Target SLA</span>
              <span className="text-emerald-400 font-semibold text-sm mt-0.5 block">
                {data.slaHours ? `${data.slaHours} Hours` : '24 Hours'}
              </span>
            </div>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>

        </div>

        {/* Due Date (If returned) */}
        {formattedDueAt && (
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Resolution Due Date</span>
            <span className="text-slate-200 font-semibold">{formattedDueAt}</span>
          </div>
        )}

        {/* Duplicate Linked Incident (If returned) */}
        {data.incidentId && (
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Linked to Parent Incident:</span>
            </div>
            <strong className="text-indigo-200 font-mono text-xs">{data.incidentId}</strong>
          </div>
        )}

      </div>

      {/* Action Button: Submit Another Request */}
      <CommandButton
        onClick={onReset}
        icon={RotateCcw}
        variant="primary"
        className="w-full py-3 text-sm"
      >
        Submit Another Request
      </CommandButton>

    </div>
  );
}
