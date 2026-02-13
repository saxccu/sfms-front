import { createContext, useContext, useMemo, useRef, useState } from 'react'

type WaitState = {
  open: boolean
  message: string
}

type WaitApi = {
  state: WaitState
  start: (message: string) => void
  stop: () => void
}

const WaitContext = createContext<WaitApi | null>(null)

export function WaitProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WaitState>({ open: false, message: 'Please wait…' })
  const depthRef = useRef(0)

  function start(message: string) {
    depthRef.current += 1
    setState({ open: true, message: message || 'Please wait…' })
  }

  function stop() {
    depthRef.current = Math.max(0, depthRef.current - 1)
    if (depthRef.current === 0) {
      setState((prev) => ({ ...prev, open: false }))
    }
  }

  const value = useMemo<WaitApi>(() => ({ state, start, stop }), [state])

  return <WaitContext.Provider value={value}>{children}</WaitContext.Provider>
}

export function useWait(): WaitApi {
  const ctx = useContext(WaitContext)
  if (!ctx) {
    throw new Error('useWait must be used within WaitProvider')
  }
  return ctx
}
