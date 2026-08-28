import React from 'react';

/**
 * Panel / Card Component
 * Clean modern container for grouping forms, details, and guides.
 */
export default function Panel({ 
  title, 
  subtitle,
  badge, 
  headerRight, 
  children, 
  className = '', 
  bodyClassName = 'p-6' 
}) {
  return (
    <div className={`surface-card overflow-hidden shadow-lg ${className}`}>
      {/* Optional Card Header */}
      {(title || badge || headerRight || subtitle) && (
        <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
          <div>
            {title && <h3 className="font-semibold text-base text-slate-100">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2.5">
            {badge && <div>{badge}</div>}
            {headerRight && <div>{headerRight}</div>}
          </div>
        </div>
      )}

      {/* Card Body */}
      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
}
