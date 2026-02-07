'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, Music, Clock } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { getSegmentColor, SEGMENT_TYPES } from '@/lib/segment-colors'
import { formatTime } from '@/lib/utils'
import type { TranscriptSegment, SegmentType } from '@/types'

interface LyricsPanelProps {
  onSeek: (time: number) => void
  currentTime: number
}

export function LyricsPanel({ onSeek, currentTime }: LyricsPanelProps) {
  const transcript = useProjectStore((s) => s.transcript)
  const audioFile = useProjectStore((s) => s.audioFile)
  const updateSegment = useProjectStore((s) => s.updateSegment)
  const addSegment = useProjectStore((s) => s.addSegment)
  const deleteSegment = useProjectStore((s) => s.deleteSegment)

  const handleAddSection = useCallback((insertAfterIndex?: number) => {
    const lastSegment = insertAfterIndex !== undefined
      ? transcript[insertAfterIndex]
      : transcript[transcript.length - 1]
    const start = lastSegment ? lastSegment.end : 0
    const end = audioFile ? Math.min(start + 30, audioFile.duration) : start + 30

    addSegment({
      id: `segment-${Date.now()}`,
      text: '',
      words: [],
      start,
      end,
      type: 'verse',
    })
  }, [transcript, audioFile, addSegment])

  // Empty state
  if (transcript.length === 0) {
    return (
      <div className="text-center py-8">
        <Music className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/40 mb-1">No lyrics yet</p>
        <p className="text-xs text-white/30 mb-4">
          {audioFile ? 'Transcribe audio or write your own' : 'Add a song to get started'}
        </p>
        {audioFile && (
          <button
            onClick={() => handleAddSection()}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-sm text-white/70 transition-colors"
          >
            Write Lyrics
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {transcript.map((segment, index) => (
        <div key={segment.id}>
          {/* Insert divider between sections */}
          {index > 0 && (
            <InsertDivider onInsert={() => handleAddSection(index - 1)} />
          )}
          <SegmentBlock
            segment={segment}
            isActive={currentTime >= segment.start && currentTime < segment.end}
            onSeek={onSeek}
            onUpdate={(updates) => updateSegment(segment.id, updates)}
            onDelete={() => deleteSegment(segment.id)}
          />
        </div>
      ))}

      {/* Add section button */}
      <button
        onClick={() => handleAddSection()}
        className="w-full mt-2 p-2 border border-dashed border-white/15 hover:border-white/30 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Section
      </button>
    </div>
  )
}

// -------------------------------------------------------------------
// SegmentBlock
// -------------------------------------------------------------------

interface SegmentBlockProps {
  segment: TranscriptSegment
  isActive: boolean
  onSeek: (time: number) => void
  onUpdate: (updates: Partial<TranscriptSegment>) => void
  onDelete: () => void
}

function SegmentBlock({ segment, isActive, onSeek, onUpdate, onDelete }: SegmentBlockProps) {
  const [localText, setLocalText] = useState(segment.text)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showTimeEdit, setShowTimeEdit] = useState(false)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const timeEditRef = useRef<HTMLDivElement>(null)

  // Sync external changes
  useEffect(() => {
    setLocalText(segment.text)
  }, [segment.text])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [localText])

  // Close type picker on outside click
  useEffect(() => {
    if (!showTypePicker) return
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTypePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTypePicker])

  // Close time editor on outside click
  useEffect(() => {
    if (!showTimeEdit) return
    const handleClick = (e: MouseEvent) => {
      if (timeEditRef.current && !timeEditRef.current.contains(e.target as Node)) {
        setShowTimeEdit(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTimeEdit])

  const handleTextChange = useCallback((value: string) => {
    setLocalText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate({ text: value })
    }, 300)
  }, [onUpdate])

  const colors = getSegmentColor(segment.type)

  return (
    <div
      className={`group rounded-lg transition-colors ${
        isActive
          ? `border-l-2 ${colors.border} bg-white/[0.03] pl-2.5 pr-3 py-2`
          : 'border-l-2 border-transparent pl-2.5 pr-3 py-2 hover:bg-white/[0.02]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* Type pill */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowTypePicker(!showTypePicker)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide transition-colors ${colors.pill}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {segment.type}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>

          {showTypePicker && (
            <div className="absolute top-full left-0 mt-1 bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-20 py-1 min-w-[120px]">
              {SEGMENT_TYPES.map((type) => {
                const typeColors = getSegmentColor(type)
                return (
                  <button
                    key={type}
                    onClick={() => {
                      onUpdate({ type: type as SegmentType })
                      setShowTypePicker(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5 ${
                      segment.type === type ? 'bg-white/5' : ''
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${typeColors.dot}`} />
                    <span className="capitalize">{type}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Time badge / editor */}
        <div className="relative" ref={timeEditRef}>
          {showTimeEdit ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const s = parseFloat(editStart)
                    const en = parseFloat(editEnd)
                    if (!isNaN(s) && !isNaN(en) && s < en && s >= 0) {
                      onUpdate({ start: s, end: en })
                    }
                    setShowTimeEdit(false)
                  } else if (e.key === 'Escape') {
                    setShowTimeEdit(false)
                  }
                }}
                className="w-14 px-1 py-0.5 text-[11px] font-mono bg-white/10 border border-white/20 rounded text-white text-center focus:outline-none focus:border-brand-500"
                step="0.1"
                min="0"
                autoFocus
              />
              <span className="text-[11px] text-white/30">–</span>
              <input
                type="number"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const s = parseFloat(editStart)
                    const en = parseFloat(editEnd)
                    if (!isNaN(s) && !isNaN(en) && s < en && s >= 0) {
                      onUpdate({ start: s, end: en })
                    }
                    setShowTimeEdit(false)
                  } else if (e.key === 'Escape') {
                    setShowTimeEdit(false)
                  }
                }}
                className="w-14 px-1 py-0.5 text-[11px] font-mono bg-white/10 border border-white/20 rounded text-white text-center focus:outline-none focus:border-brand-500"
                step="0.1"
                min="0"
              />
              <button
                onClick={() => setShowTimeEdit(false)}
                className="text-[10px] text-white/30 hover:text-white/50 ml-0.5"
              >
                esc
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                if (e.shiftKey) {
                  // Shift+click opens time editor
                  setEditStart(segment.start.toFixed(1))
                  setEditEnd(segment.end.toFixed(1))
                  setShowTimeEdit(true)
                } else {
                  onSeek(segment.start)
                }
              }}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/50 transition-colors font-mono"
              title="Click to seek · Shift+click to edit times"
            >
              <Clock className="w-3 h-3 opacity-50" />
              {formatTime(segment.start)} – {formatTime(segment.end)}
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
          title="Delete section"
        >
          <Trash2 className="w-3 h-3 text-white/30 hover:text-red-400" />
        </button>
      </div>

      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Write lyrics..."
        className="w-full bg-transparent text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none leading-relaxed min-h-[2.5rem]"
        rows={1}
      />
    </div>
  )
}

// -------------------------------------------------------------------
// InsertDivider
// -------------------------------------------------------------------

function InsertDivider({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group/divider relative h-2 flex items-center justify-center">
      <button
        onClick={onInsert}
        className="absolute inset-x-4 h-px bg-transparent group-hover/divider:bg-white/10 transition-colors flex items-center justify-center"
      >
        <span className="opacity-0 group-hover/divider:opacity-100 bg-neutral-800 border border-white/10 rounded-full w-5 h-5 flex items-center justify-center transition-opacity">
          <Plus className="w-3 h-3 text-white/40" />
        </span>
      </button>
    </div>
  )
}
