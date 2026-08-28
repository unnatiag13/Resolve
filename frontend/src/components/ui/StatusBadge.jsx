import React from 'react';

/**
 * StatusBadge Component
 * Clean, subtle pill badge for status, priority, and department tags.
 */
export default function StatusBadge({ status, label, variant, showDot = true, className = '' }) {
  const normalized = (variant || status || 'DEFAULT').toUpperCase();

  const getVariantStyles = () => {
    switch (normalized) {
      case 'ONLINE':
      case 'RESOLVED':
      case 'VERIFIED':
      case 'CLOSED':
      case 'LOW':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-400'
        };
      case 'WARNING':
      case 'HIGH':
      case 'IN_PROGRESS':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dot: 'bg-amber-400'
        };
      case 'CRITICAL':
      case 'SLA_BREACHED':
      case 'ESCALATED':
      case 'EMERGENCY':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          dot: 'bg-rose-400'
        };
      case 'TRIAGED':
      case 'ASSIGNED':
      case 'MEDIUM':
        return {
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          dot: 'bg-indigo-400'
        };
      default:
        return {
          bg: 'bg-slate-800/60 text-slate-300 border-slate-700/50',
          dot: 'bg-slate-400'
        };
    }
  };

  const style = getVariantStyles();
  const rawLabel = label || status || normalized;
  // Format to Title Case if it's all uppercase
  const displayLabel = rawLabel === rawLabel.toUpperCase() && rawLabel.length > 2
    ? rawLabel.charAt(0) + rawLabel.slice(1).toLowerCase()
    : rawLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${style.bg} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />}
      <span>{displayLabel}</span>
    </span>
  );
}
