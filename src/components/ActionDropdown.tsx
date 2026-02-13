import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ActionDropdownItem =
  | {
      type?: 'item'
      label: string
      onClick: () => void | Promise<void>
      disabled?: boolean
      danger?: boolean
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
    const width = Math.max(180, r.width)
    const left = Math.min(window.innerWidth - 12 - width, Math.max(12, r.left))
    const top = Math.min(window.innerHeight - 12, r.bottom + 8)
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
        className={`inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 ${buttonClassName}`}
        aria-expanded={open}
        aria-controls={portalId}
      >
        {buttonLabel}
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && pos
        ? createPortal(
            <div
              id={portalId}
              ref={menuRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
              className={`rounded-md border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${menuClassName}`}
              role="menu"
            >
              {menuItems.map((it, idx) => {
                if (it.type === 'separator') {
                  return <div key={`sep-${idx}`} className="my-1 border-t border-slate-100 dark:border-slate-800" />
                }

                const disabled = !!it.disabled
                const danger = !!it.danger

                return (
                  <button
                    key={`item-${idx}`}
                    type="button"
                    onClick={() => void runItem(it)}
                    disabled={disabled}
                    className={
                      disabled
                        ? 'flex w-full cursor-not-allowed items-center px-4 py-2 text-left text-sm text-slate-300 dark:text-slate-600'
                        : danger
                          ? 'flex w-full items-center px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30'
                          : 'flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }
                    role="menuitem"
                  >
                    {it.label}
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
