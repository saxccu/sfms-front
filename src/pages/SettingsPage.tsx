import { Settings } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";

export default function SettingsPage() {
  usePageTitle("Settings");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
          Manage your account and application preferences.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-4xl glass-effect py-32 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300 dark:bg-slate-900 shadow-inner">
          <Settings className="h-10 w-10 animate-[spin_8s_linear_infinite]" />
        </div>
        <h3 className="mt-8 text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">Preferences Coming Soon</h3>
        <p className="mt-3 max-w-sm text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
          We're working on giving you more control over your file management experience. Stay tuned!
        </p>

        <div className="mt-10 flex gap-4">
          <div className="h-3 w-3 rounded-full bg-emerald-primary/40 animate-bounce [animation-delay:-0.3s]" />
          <div className="h-3 w-3 rounded-full bg-emerald-primary/70 animate-bounce [animation-delay:-0.15s]" />
          <div className="h-3 w-3 rounded-full bg-emerald-primary animate-bounce shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
        </div>
      </div>
    </div>
  );
}
