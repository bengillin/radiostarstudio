'use client'

import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

const shortcuts = [
  { category: 'Playback', items: [
    { keys: ['Space'], description: 'Play / Pause' },
    { keys: ['←'], description: 'Seek back 5 seconds' },
    { keys: ['→'], description: 'Seek forward 5 seconds' },
  ]},
  { category: 'Editing', items: [
    { keys: ['N'], description: 'New scene' },
    { keys: ['⇧', 'N'], description: 'New clip at playhead' },
    { keys: ['S'], description: 'Split clip at playhead' },
    { keys: ['Delete'], description: 'Delete selected clip(s)' },
    { keys: ['⌘', 'Z'], description: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
  ]},
  { category: 'Timeline', items: [
    { keys: ['Right-click'], description: 'Context menu (add/delete)' },
    { keys: ['⌘', 'Click'], description: 'Toggle clip selection' },
    { keys: ['⇧', 'Click'], description: 'Add to selection' },
    { keys: ['Drag'], description: 'Move clip on timeline' },
    { keys: ['Edge drag'], description: 'Trim clip start/end' },
  ]},
  { category: 'Tools', items: [
    { keys: ['G'], description: 'Open generation queue' },
    { keys: ['M'], description: 'Open media library' },
    { keys: ['⌘', 'E'], description: 'Export video' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
  ]},
]

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Keyboard className="w-5 h-5 text-brand-500" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-white/70">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <span key={j}>
                            <kbd className="px-2 py-1 text-xs font-mono bg-white/10 border border-white/20 rounded">
                              {key}
                            </kbd>
                            {j < shortcut.keys.length - 1 && (
                              <span className="mx-0.5 text-white/30">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/5">
          <p className="text-xs text-white/40 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-white/10 border border-white/20 rounded">?</kbd> anytime to show this menu
          </p>
        </div>
      </div>
    </div>
  )
}
