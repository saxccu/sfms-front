import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

export type ActionDropdownItem =
  | {
      type?: 'item'
      label: string
      icon?: LucideIcon
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

export default function ActionDropdown({
  items,
  buttonLabel = '...',
  buttonClassName = '',
  menuClassName = '',
}: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [coords, setCoords] = useState({ top: 0, left: 0 })

  function updateCoords() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.right + window.scrollX,
      })
    }
  }

  useEffect(() => {
    if (open) {
      updateCoords()
      window.addEventListener('resize', updateCoords)
      window.addEventListener('scroll', updateCoords, true)
    }
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [open])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onMouseDown)
    }
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const renderedItems = useMemo(() => {
    return items.map((item, idx) => {
      if (item.type === 'separator') {
        return <div key={idx} className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      }

      const Icon = item.icon

      return (
        <button
          key={idx}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            setOpen(false)
            void item.onClick()
          }}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            item.danger
              ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {Icon && <Icon size={16} className={item.danger ? 'text-rose-500' : 'text-slate-400'} />}
          {item.label}
        </button>
      )
    })
  }, [items])

  return (
    <>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${buttonClassName}`}
      >
        {buttonLabel}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              top: `${coords.top + 8}px`,
              left: `${coords.left}px`,
              transform: 'translateX(-100%)',
            }}
            className={`z-[100] min-w-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 ${menuClassName}`}
          >
            {renderedItems}
          </div>,
          document.body
        )}
    </>
  )
}
