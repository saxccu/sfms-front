import { BriefcaseIcon } from "@heroicons/react/24/outline";
import { usePageTitle } from "../hooks/usePageTitle";

export default function OperationsPage() {
  usePageTitle("Operations");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-sky-950 dark:text-sky-50">Operations</h1>
        <p className="text-sm text-sky-500 dark:text-sky-400">
          Daily branch operations and workflow management.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-sky-100 bg-white py-32 text-center dark:border-sky-800 dark:bg-sky-950">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-400 dark:bg-sky-900/30">
          <BriefcaseIcon className="h-8 w-8" />
        </div>
        <h3 className="mt-6 text-lg font-bold text-sky-950 dark:text-sky-50">Operational Modules</h3>
        <p className="mt-2 max-w-sm text-sm text-sky-500 dark:text-sky-400">
          Advanced workflows for Cashiers, Loan Officers, and Customer Relations are currently under development.
        </p>

        <div className="mt-8 flex items-center gap-2">
          <div className="h-1.5 w-12 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
            <div className="h-full w-2/3 bg-primary-600 animate-pulse" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary-600">60% Complete</span>
        </div>
      </div>
    </div>
  );
}
