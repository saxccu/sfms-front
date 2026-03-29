import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { usePageTitle } from "../hooks/usePageTitle";

export default function SettingsPage() {
  usePageTitle("Settings");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-sky-950 dark:text-sky-50">Settings</h1>
        <p className="text-sm text-sky-500 dark:text-sky-400">
          Manage your account and application preferences.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-sky-100 bg-white py-32 text-center dark:border-sky-800 dark:bg-sky-950">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-400 dark:bg-sky-900/30">
          <Cog6ToothIcon className="h-8 w-8 animate-[spin_4s_linear_infinite]" />
        </div>
        <h3 className="mt-6 text-lg font-bold text-sky-950 dark:text-sky-50">Preferences Coming Soon</h3>
        <p className="mt-2 max-w-sm text-sm text-sky-500 dark:text-sky-400">
          We're working on giving you more control over your file management experience. Stay tuned!
        </p>

        <div className="mt-8 flex gap-3">
          <div className="h-2 w-2 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-primary-600 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
