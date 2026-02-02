'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface ContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ isOpen, position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    let { x, y } = position

    // Adjust horizontal position
    if (x + rect.width > viewport.width - 8) {
      x = viewport.width - rect.width - 8
    }

    // Adjust vertical position
    if (y + rect.height > viewport.height - 8) {
      y = viewport.height - rect.height - 8
    }

    setAdjustedPosition({ x: Math.max(8, x), y: Math.max(8, y) })
  }, [isOpen, position])

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleScroll = () => {
      onClose()
    }

    // Use capture phase to close before other click handlers
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, onClose])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => {
          const enabledItems = items.filter((item) => !item.disabled)
          const next = prev + 1
          return next >= enabledItems.length ? 0 : next
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => {
          const enabledItems = items.filter((item) => !item.disabled)
          const next = prev - 1
          return next < 0 ? enabledItems.length - 1 : next
        })
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0) {
          const enabledItems = items.filter((item) => !item.disabled)
          enabledItems[focusedIndex]?.onClick()
          onClose()
        }
        break
    }
  }, [isOpen, items, focusedIndex, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset focus when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1)
    }
  }, [isOpen])

  if (!isOpen) return null

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {items.map((item, index) => {
        const Icon = item.icon
        const enabledIndex = items.filter((i) => !i.disabled).indexOf(item)
        const isFocused = enabledIndex === focusedIndex

        return (
          <button
            key={item.id}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
              ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              ${item.danger && !item.disabled ? 'text-red-400 hover:bg-red-500/20' : ''}
              ${!item.disabled && !item.danger ? 'hover:bg-white/10' : ''}
              ${isFocused && !item.disabled ? 'bg-white/10' : ''}
            `}
            onClick={() => {
              if (item.disabled) return
              item.onClick()
              onClose()
            }}
            disabled={item.disabled}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )

  // Portal to document body
  if (typeof document !== 'undefined') {
    return createPortal(menu, document.body)
  }

  return menu
}
