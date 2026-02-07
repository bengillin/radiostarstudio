'use client'

import { X, Check, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Frame } from '@/types'

interface VariationPickerProps {
  variations: Frame[]
  isLoading: boolean
  expectedCount: number
  onSelect: (frame: Frame) => void
  onClose: () => void
}

export function VariationPicker({ variations, isLoading, expectedCount, onSelect, onClose }: VariationPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleConfirm = () => {
    if (selectedIndex !== null && variations[selectedIndex]) {
      onSelect(variations[selectedIndex])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Pick a Variation</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {isLoading
                ? `Generating ${expectedCount} variations...`
                : `${variations.length} variation${variations.length !== 1 ? 's' : ''} generated — click to select`
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* 2x2 Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: expectedCount }).map((_, i) => {
              const frame = variations[i]
              const isSelected = selectedIndex === i

              if (!frame) {
                // Skeleton placeholder
                return (
                  <div
                    key={i}
                    className="aspect-video rounded-lg bg-white/5 border border-white/10 flex items-center justify-center animate-pulse"
                  >
                    <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                  </div>
                )
              }

              return (
                <button
                  key={frame.id}
                  onClick={() => setSelectedIndex(i)}
                  className={`aspect-video rounded-lg overflow-hidden border-2 transition-all relative group ${
                    isSelected
                      ? 'border-brand-500 ring-2 ring-brand-500/30'
                      : 'border-transparent hover:border-white/30'
                  }`}
                >
                  <img
                    src={frame.url}
                    alt={`Variation ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-brand-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {/* Variation number */}
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white/70">
                    #{i + 1}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIndex === null}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Use Selected
          </button>
        </div>
      </div>
    </div>
  )
}
