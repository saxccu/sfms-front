import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export type ActionDropdownItem =
  | {
      type?: 'item'
      label: string
      onClick: () => void | Promise<void>
      disabled?: boolean
      danger?: boolean
      icon?: any
    }
  | {
      type: 'separator'
    }

type Props = {
  items: ActionDropdownItem[]
  buttonLabel?: ReactNode
  buttonClassName?: string
  menuClassName?: string
}

export default function ActionDropdown({ items, buttonLabel = 'Action', buttonClassName = '', menuClassName = '' }: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const portalId = useId()

  const menuItems = useMemo(() => items.filter(Boolean), [items])

  function computePosition() {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(220, r.width)
    const left = Math.min(window.innerWidth - 12 - width, Math.max(12, r.left))
    const top = Math.min(window.innerHeight - 12, r.bottom + 12)
    setPos({ top, left, width })
  }

  useEffect(() => {
    if (!open) return
    computePosition()

    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node | null
      if (!t) return
      if (btnRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    function onAnyScroll() {
      computePosition()
    }

    function onResize() {
      computePosition()
    }

    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onAnyScroll, true)
    window.addEventListener('resize', onResize)

    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onAnyScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  async function runItem(item: Extract<ActionDropdownItem, { type?: 'item' }>) {
    if (item.disabled) return
    setOpen(false)
    await item.onClick()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-2xl bg-emerald-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all dark:shadow-none ${buttonClassName}`}
        aria-expanded={open}
        aria-controls={portalId}
      >
        {buttonLabel}
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos
        ? createPortal(
            <div
              id={portalId}
              ref={menuRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
              className={`rounded-2xl border border-slate-100 bg-white/90 backdrop-blur-xl py-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90 ${menuClassName}`}
              role="menu"
            >
              {menuItems.map((it, idx) => {
                if (it.type === 'separator') {
                  return <div key={`sep-${idx}`} className="my-1 border-t border-slate-100 dark:border-slate-800/50" />
                }

                const disabled = !!it.disabled
                const danger = !!it.danger
                const Icon = it.icon

                return (
                  <button
                    key={`item-${idx}`}
                    type="button"
                    onClick={() => void runItem(it)}
                    disabled={disabled}
                    className={
                      disabled
                        ? 'flex w-full cursor-not-allowed items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 dark:text-slate-600'
                        : danger
                          ? 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
                          : 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300'
                    }
                    role="menuitem"
                  >
                    {Icon && <Icon size={16} />}
                    <span className="font-medium">{it.label}</span>
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
