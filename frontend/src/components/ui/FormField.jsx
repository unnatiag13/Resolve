import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * FormField Component
 * Clean modern input and textarea wrapper with validation error alerts.
 */
export default function FormField({
  id,
  name,
  label,
  required = false,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled = false,
  icon: Icon,
  isTextarea = false,
  rows = 4,
  counter = null,
  helperText = null,
  className = ''
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label and optional counter */}
      <div className="flex items-center justify-between">
        <label htmlFor={id || name} className="block text-xs font-semibold text-slate-300">
          {label} {required && <span className="text-indigo-400">*</span>}
        </label>

        {counter && (
          <span className="text-[11px] text-slate-500 font-medium">
            {counter}
          </span>
        )}
      </div>

      {/* Input container */}
      <div className="relative">
        {Icon && (
          <div className={`absolute top-3 left-3.5 flex items-center pointer-events-none transition-colors ${
            error ? 'text-rose-400' : 'text-slate-400'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
        )}

        {isTextarea ? (
          <textarea
            id={id || name}
            name={name}
            rows={rows}
            disabled={disabled}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`input-base w-full p-3 text-slate-100 placeholder-slate-500 text-sm resize-y min-h-[100px] ${
              Icon ? 'pl-10' : 'pl-3.5'
            } ${error ? 'input-error' : ''}`}
          />
        ) : (
          <input
            id={id || name}
            name={name}
            type={type}
            disabled={disabled}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`input-base w-full py-2.5 pr-3 text-slate-100 placeholder-slate-500 text-sm ${
              Icon ? 'pl-10' : 'pl-3.5'
            } ${error ? 'input-error' : ''}`}
          />
        )}
      </div>

      {/* Helper text or inline validation error */}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-rose-400 font-medium pt-0.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
