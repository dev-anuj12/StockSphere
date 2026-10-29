import React from 'react';
import { PackageOpen } from 'lucide-react';

export function EmptyState({
  title = 'No records found',
  description = 'There are no entries available for your current filter or view.',
  action = null,
  icon: Icon = PackageOpen,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 bg-slate-100 rounded-2xl text-slate-400 mb-4">
        <Icon className="w-10 h-10 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
