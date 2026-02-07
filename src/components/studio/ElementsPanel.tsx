'use client'

import { useState, useRef } from 'react'
import {
  Users, Clapperboard, Clock, MapPin, Heart,
  Plus, Trash2, ChevronDown, ChevronUp, Upload,
  Sparkles, X, Image as ImageIcon,
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import type { ElementCategory, WorldElement } from '@/types'

const CATEGORY_CONFIG: Record<ElementCategory, { label: string; icon: typeof Users; color: string; placeholder: string }> = {
  who: { label: 'Who', icon: Users, color: 'text-blue-400', placeholder: 'e.g. Lead singer, mysterious stranger...' },
  what: { label: 'What', icon: Clapperboard, color: 'text-orange-400', placeholder: 'e.g. Walking through rain, dancing...' },
  when: { label: 'When', icon: Clock, color: 'text-yellow-400', placeholder: 'e.g. Sunset, 1980s, dream sequence...' },
  where: { label: 'Where', icon: MapPin, color: 'text-green-400', placeholder: 'e.g. Neon-lit city, abandoned warehouse...' },
  why: { label: 'Why', icon: Heart, color: 'text-pink-400', placeholder: 'e.g. Longing, rebellion, euphoria...' },
}

const CATEGORIES: ElementCategory[] = ['who', 'what', 'when', 'where', 'why']

interface ElementsPanelProps {
  onSelectElement?: (id: string) => void
  selectedElementId?: string | null
  globalStyle?: string
  onStyleChange?: (style: string) => void
  showStyle?: boolean
}

export function ElementsPanel({ onSelectElement, selectedElementId, globalStyle, onStyleChange, showStyle }: ElementsPanelProps = {}) {
  const {
    elements, scenes, elementImages,
    addElement, updateElement, deleteElement,
    setElementImage, deleteElementImage,
  } = useProjectStore()

  const [filter, setFilter] = useState<ElementCategory | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creatingCategory, setCreatingCategory] = useState<ElementCategory | null>(null)
  const [newName, setNewName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingForElement, setUploadingForElement] = useState<string | null>(null)

  const filtered = filter === 'all' ? elements : elements.filter((e) => e.category === filter)

  const getUsageCount = (elementId: string) => {
    return scenes.filter((s) =>
      s.elementRefs?.some((r) => r.elementId === elementId)
    ).length
  }

  const handleCreate = () => {
    if (!creatingCategory || !newName.trim()) return
    const now = new Date().toISOString()
    addElement({
      id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      category: creatingCategory,
      name: newName.trim(),
      description: '',
      referenceImageIds: [],
      createdAt: now,
      updatedAt: now,
    })
    setNewName('')
    setCreatingCategory(null)
  }

  const handleImageUpload = (elementId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      if (!url) return
      setElementImage({
        id: `elemimg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        elementId,
        url,
        source: 'upload',
        createdAt: new Date().toISOString(),
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      {/* Visual Style */}
      {showStyle && (
        <div className="pb-3 border-b border-white/10">
          <label className="text-xs text-white/40 uppercase">Visual Style</label>
          <textarea
            value={globalStyle ?? ''}
            onChange={(e) => onStyleChange?.(e.target.value)}
            placeholder="Describe the visual style... (e.g., 'Neon-lit cyberpunk city at night')"
            className="w-full mt-1 h-20 p-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
          />
          <p className="text-[10px] text-white/30 mt-1">Global style applied to all generations</p>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-2 py-1 text-xs rounded-full transition-colors ${
            filter === 'all'
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/50 hover:text-white/70'
          }`}
        >
          All ({elements.length})
        </button>
        {CATEGORIES.map((cat) => {
          const config = CATEGORY_CONFIG[cat]
          const Icon = config.icon
          const count = elements.filter((e) => e.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                filter === cat
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              <Icon className={`w-3 h-3 ${config.color}`} />
              {count}
            </button>
          )
        })}
      </div>

      {/* Element list */}
      {filtered.length === 0 && !creatingCategory ? (
        <div className="text-center py-8">
          <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">No elements yet</p>
          <p className="text-xs text-white/30 mt-1">
            Plan scenes to auto-generate elements, or add them manually
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((element) => {
            const config = CATEGORY_CONFIG[element.category]
            const Icon = config.icon
            const isExpanded = expandedId === element.id
            const usage = getUsageCount(element.id)
            const images = element.referenceImageIds
              .map((id) => elementImages[id])
              .filter(Boolean)

            return (
              <div
                key={element.id}
                className={`rounded-lg bg-white/5 border overflow-hidden ${
                  selectedElementId === element.id ? 'border-brand-500/50' : 'border-white/10'
                }`}
              >
                {/* Header */}
                <div
                  className="p-2.5 cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2 group"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : element.id)
                    if (!isExpanded) onSelectElement?.(element.id)
                  }}
                >
                  <Icon className={`w-3.5 h-3.5 ${config.color} flex-shrink-0`} />
                  {images.length > 0 && (
                    <img
                      src={images[0].url}
                      alt=""
                      className="w-7 h-7 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{element.name}</p>
                    {element.description && (
                      <p className="text-xs text-white/40 truncate">{element.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {usage > 0 && (
                      <span className="text-xs text-white/30">{usage} scene{usage !== 1 ? 's' : ''}</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteElement(element.id)
                      }}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete element"
                    >
                      <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-white/40" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                    )}
                  </div>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-1 border-t border-white/10 space-y-2">
                    <div>
                      <label className="text-xs text-white/40 uppercase">Name</label>
                      <input
                        type="text"
                        value={element.name}
                        onChange={(e) => updateElement(element.id, { name: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase">Description</label>
                      <textarea
                        value={element.description}
                        onChange={(e) => updateElement(element.id, { description: e.target.value })}
                        placeholder={config.placeholder}
                        rows={3}
                        className="w-full mt-0.5 px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500 resize-none"
                      />
                    </div>

                    {/* Reference images */}
                    <div>
                      <label className="text-xs text-white/40 uppercase">Reference Images</label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {images.map((img) => (
                          <div key={img.id} className="relative group/img w-14 h-14">
                            <img
                              src={img.url}
                              alt=""
                              className="w-full h-full rounded object-cover border border-white/10"
                            />
                            <button
                              onClick={() => deleteElementImage(img.id, element.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setUploadingForElement(element.id)
                            fileInputRef.current?.click()
                          }}
                          className="w-14 h-14 rounded border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center transition-colors"
                          title="Upload reference image"
                        >
                          <Upload className="w-4 h-4 text-white/40" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create new element inline form */}
      {creatingCategory ? (
        <div className="p-2.5 rounded-lg bg-white/5 border border-brand-500/30 space-y-2">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = CATEGORY_CONFIG[creatingCategory].icon
              return <Icon className={`w-3.5 h-3.5 ${CATEGORY_CONFIG[creatingCategory].color}`} />
            })()}
            <span className="text-xs text-white/50 uppercase">{CATEGORY_CONFIG[creatingCategory].label}</span>
            <button
              onClick={() => { setCreatingCategory(null); setNewName('') }}
              className="ml-auto p-0.5 hover:bg-white/10 rounded"
            >
              <X className="w-3 h-3 text-white/40" />
            </button>
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder={CATEGORY_CONFIG[creatingCategory].placeholder}
            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="w-full px-2 py-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
          >
            Add
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-white/30 text-center">Add element</p>
          <div className="flex justify-center gap-1">
            {CATEGORIES.map((cat) => {
              const config = CATEGORY_CONFIG[cat]
              const Icon = config.icon
              return (
                <button
                  key={cat}
                  onClick={() => setCreatingCategory(cat)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors group/add"
                  title={`Add ${config.label}`}
                >
                  <Icon className={`w-4 h-4 text-white/30 group-hover/add:${config.color}`} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && uploadingForElement) {
            handleImageUpload(uploadingForElement, file)
          }
          e.target.value = ''
          setUploadingForElement(null)
        }}
      />
    </div>
  )
}
