'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Users, Clapperboard, Clock, MapPin, Heart,
  Plus, X, ChevronDown, RotateCcw,
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import type { ElementCategory } from '@/types'

const CATEGORY_CONFIG: Record<ElementCategory, { label: string; icon: typeof Users; color: string; bgColor: string; placeholder: string }> = {
  who: { label: 'Who', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/20', placeholder: 'Characters/subjects...' },
  what: { label: 'What', icon: Clapperboard, color: 'text-orange-400', bgColor: 'bg-orange-500/20', placeholder: 'Action/event...' },
  when: { label: 'When', icon: Clock, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', placeholder: 'Time period...' },
  where: { label: 'Where', icon: MapPin, color: 'text-green-400', bgColor: 'bg-green-500/20', placeholder: 'Location...' },
  why: { label: 'Why', icon: Heart, color: 'text-pink-400', bgColor: 'bg-pink-500/20', placeholder: 'Mood/motivation...' },
}

interface Props {
  sceneId: string
  category: ElementCategory
}

export function SceneElementSelector({ sceneId, category }: Props) {
  const {
    elements, scenes, elementImages,
    addElement, addElementToScene, removeElementFromScene,
    setSceneElementOverride,
  } = useProjectStore()

  const [showDropdown, setShowDropdown] = useState(false)
  const [search, setSearch] = useState('')
  const [overrideElement, setOverrideElement] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon

  const scene = scenes.find((s) => s.id === sceneId)
  if (!scene) return null

  const assignedRefs = (scene.elementRefs || []).filter((ref) => {
    const el = elements.find((e) => e.id === ref.elementId)
    return el?.category === category
  })

  const availableElements = elements.filter((e) =>
    e.category === category &&
    !assignedRefs.some((r) => r.elementId === e.id) &&
    (search === '' || e.name.toLowerCase().includes(search.toLowerCase()))
  )

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  // Focus search when dropdown opens
  useEffect(() => {
    if (showDropdown) searchRef.current?.focus()
  }, [showDropdown])

  const handleQuickCreate = () => {
    if (!search.trim()) return
    const now = new Date().toISOString()
    const newId = `elem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    addElement({
      id: newId,
      category,
      name: search.trim(),
      description: '',
      referenceImageIds: [],
      createdAt: now,
      updatedAt: now,
    })
    addElementToScene(sceneId, newId)
    setSearch('')
    setShowDropdown(false)
  }

  return (
    <div className="flex items-start gap-2">
      <Icon className={`w-3.5 h-3.5 ${config.color} mt-1.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40 uppercase mb-1">{config.label}</p>

        {/* Assigned elements as pills */}
        <div className="flex flex-wrap gap-1 items-center">
          {assignedRefs.map((ref) => {
            const element = elements.find((e) => e.id === ref.elementId)
            if (!element) return null
            const firstImage = element.referenceImageIds.length > 0 ? elementImages[element.referenceImageIds[0]] : null
            const isOverriding = overrideElement === ref.elementId

            return (
              <div key={ref.elementId} className="relative">
                <button
                  onClick={() => setOverrideElement(isOverriding ? null : ref.elementId)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                    ref.overrideDescription
                      ? `${config.bgColor} ${config.color} ring-1 ring-current/30`
                      : `${config.bgColor} ${config.color}`
                  }`}
                  title={ref.overrideDescription ? 'Has scene override' : 'Click to add override'}
                >
                  {firstImage && (
                    <img src={firstImage.url} alt="" className="w-3.5 h-3.5 rounded-full object-cover -ml-0.5" />
                  )}
                  {element.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeElementFromScene(sceneId, ref.elementId)
                    }}
                    className="ml-0.5 hover:text-white/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </button>

                {/* Override popover */}
                {isOverriding && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-56 p-2 rounded-lg bg-zinc-800 border border-white/10 shadow-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white/50">Scene override</p>
                      {ref.overrideDescription && (
                        <button
                          onClick={() => {
                            setSceneElementOverride(sceneId, ref.elementId, undefined)
                            setOverrideElement(null)
                          }}
                          className="text-xs text-white/40 hover:text-white/60 flex items-center gap-0.5"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      )}
                    </div>
                    {element.description && (
                      <p className="text-xs text-white/30 italic line-clamp-2">
                        Default: {element.description}
                      </p>
                    )}
                    <textarea
                      value={ref.overrideDescription || ''}
                      onChange={(e) => setSceneElementOverride(sceneId, ref.elementId, e.target.value || undefined)}
                      placeholder="Override for this scene..."
                      rows={2}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-500 resize-none"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Add button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-lg bg-zinc-800 border border-white/10 shadow-xl overflow-hidden">
                <div className="p-1.5">
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && availableElements.length > 0) {
                        addElementToScene(sceneId, availableElements[0].id)
                        setSearch('')
                        setShowDropdown(false)
                      } else if (e.key === 'Enter' && search.trim()) {
                        handleQuickCreate()
                      }
                    }}
                    placeholder={`Search ${config.label.toLowerCase()}...`}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {availableElements.map((el) => {
                    const firstImage = el.referenceImageIds.length > 0 ? elementImages[el.referenceImageIds[0]] : null
                    return (
                      <button
                        key={el.id}
                        onClick={() => {
                          addElementToScene(sceneId, el.id)
                          setSearch('')
                          setShowDropdown(false)
                        }}
                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                      >
                        {firstImage ? (
                          <img src={firstImage.url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                        ) : (
                          <Icon className={`w-3.5 h-3.5 ${config.color} flex-shrink-0`} />
                        )}
                        <div className="min-w-0">
                          <p className="text-white truncate">{el.name}</p>
                          {el.description && (
                            <p className="text-white/40 truncate">{el.description}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {availableElements.length === 0 && !search.trim() && (
                    <p className="px-2.5 py-2 text-xs text-white/30 text-center">No elements available</p>
                  )}
                </div>
                {search.trim() && (
                  <button
                    onClick={handleQuickCreate}
                    className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2 border-t border-white/10"
                  >
                    <Plus className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className="text-white/60">Create &quot;{search.trim()}&quot;</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
