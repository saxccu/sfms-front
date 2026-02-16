import { usePageTitle } from "../hooks/usePageTitle";

export default function SettingsPage() {
  usePageTitle("Settings");
  return (
    <div className="space-y-2">
      <div className="text-lg font-semibold text-slate-900">Settings</div>
      <div className="text-sm text-slate-500">Coming soon.</div>
    </div>
  );
}
