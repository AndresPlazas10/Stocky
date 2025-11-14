import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function ModernTable({ columns, data, onRowClick, loading, emptyMessage = "No hay datos para mostrar" }) {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-accent/20">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-primary-900 to-secondary-800">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-3 py-3 sm:px-6 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white uppercase tracking-wider">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-accent/10">
            {[...Array(5)].map((_, idx) => (
              <tr key={idx}>
                {columns.map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-3 sm:px-6 sm:py-4">
                    <div className="h-4 bg-accent/20 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16 px-4 bg-white rounded-2xl border border-accent/20">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm sm:text-base text-primary-600 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-accent/20 shadow-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gradient-to-r from-primary-900 to-secondary-800">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-3 py-3 sm:px-6 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-accent/10">
          {data.map((row, rowIdx) => (
            <motion.tr
              key={rowIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: rowIdx * 0.05 }}
              onClick={() => onRowClick && onRowClick(row)}
              className={cn(
                "transition-all duration-200",
                onRowClick && "cursor-pointer hover:bg-accent/5 hover:shadow-md"
              )}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-primary-900 whitespace-nowrap"
                >
                  {col.cell ? col.cell(row) : row[col.accessorKey]}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ModernBadge({ children, variant = "default", className }) {
  const variants = {
    default: "bg-accent/10 text-accent-700 border-accent/20",
    success: "bg-green-100 text-green-700 border-green-200",
    warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
    error: "bg-red-100 text-red-700 border-red-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
    primary: "bg-primary-100 text-primary-800 border-primary-200",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

export function ModernTableActions({ children, className }) {
  return (
    <div className={cn("flex items-center gap-1 sm:gap-2", className)}>
      {children}
    </div>
  );
}

export function ModernTableButton({ onClick, icon: Icon, variant = "default", children, className }) {
  const variants = {
    default: "bg-accent/10 hover:bg-accent/20 text-accent-700",
    edit: "bg-blue-50 hover:bg-blue-100 text-blue-700",
    delete: "bg-red-50 hover:bg-red-100 text-red-700",
    view: "bg-green-50 hover:bg-green-100 text-green-700",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95",
        variants[variant],
        className
      )}
      title={children}
    >
      {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4" />}
    </button>
  );
}
