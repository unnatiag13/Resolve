import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * CommandButton / Button Component
 * Modern tactile button with clean states and loading feedback.
 */
export default function CommandButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled = false,
  isLoading = false,
  loadingText = 'Submitting request...',
  icon: Icon,
  className = ''
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-600/20';
      case 'secondary':
        return 'bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 border border-slate-700';
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20';
      case 'ghost':
        return 'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200';
      default:
        return 'bg-indigo-600 text-white';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getVariantStyles()} ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0 text-current" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
