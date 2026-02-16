import { usePageTitle } from "../hooks/usePageTitle";

export default function BranchesPage() {
  usePageTitle("Branches");
  return (
    <div className="space-y-2">
      <div className="text-lg font-semibold text-slate-900">Branches</div>
      <div className="text-sm text-slate-500">Coming soon.</div>
    </div>
  );
}
