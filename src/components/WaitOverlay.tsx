import { useWait } from '../context/WaitContext'

export default function WaitOverlay() {
  const { state } = useWait()
  if (!state.open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{state.message || 'Please wait…'}</div>
        <div className="mt-5 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
        </div>
      </div>
    </div>
  )
}
