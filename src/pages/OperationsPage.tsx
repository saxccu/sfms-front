import { Briefcase } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";

export default function OperationsPage() {
  usePageTitle("Operations");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Operations</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
          Daily branch operations and workflow management.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-4xl glass-effect py-32 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300 dark:bg-slate-900 shadow-inner">
          <Briefcase className="h-10 w-10" />
        </div>
        <h3 className="mt-8 text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">Operational Modules</h3>
        <p className="mt-3 max-w-sm text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
          Advanced workflows for Cashiers, Loan Officers, and Customer Relations are currently under development.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <div className="h-2 w-48 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
            <div className="h-full w-2/3 bg-emerald-primary animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-primary">60% Complete</span>
        </div>
      </div>
    </div>
  );
}
