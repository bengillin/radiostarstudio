'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, Trash2, X, Image as ImageIcon,
  Sparkles, Loader2, Wand2,
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { CATEGORY_CONFIG } from '@/lib/category-config'

interface WorldElementDetailViewProps {
  elementId: string
  onClose: () => void
}

export function WorldElementDetailView({ elementId, onClose }: WorldElementDetailViewProps) {
  const {
    elements, scenes, elementImages, globalStyle, modelSettings,
    updateElement, deleteElement,
    setElementImage, deleteElementImage,
  } = useProjectStore()

  const element = elements.find((e) => e.id === elementId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isSuggestingDesc, setIsSuggestingDesc] = useState(false)

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !element) return

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const imageId = `elem-img-${Date.now()}`
      setElementImage({
        id: imageId,
        elementId: element.id,
        url: reader.result as string,
        source: 'upload',
        createdAt: new Date().toISOString(),
      })
      setIsUploading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [element, setElementImage])

  const handleGenerateImage = useCallback(async () => {
    if (!element) return
    setIsGeneratingImage(true)
    try {
      const res = await fetch('/api/generate-element-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: element.name,
          description: element.description,
          category: element.category,
          globalStyle,
          model: modelSettings.image,
        }),
      })
      const data = await res.json()
      if (data.image) {
        const imageId = `elem-img-${Date.now()}`
        setElementImage({
          id: imageId,
          elementId: element.id,
          url: data.image.url,
          source: 'generated',
          createdAt: new Date().toISOString(),
        })
      }
    } catch {
      // silently fail — user sees no new image
    } finally {
      setIsGeneratingImage(false)
    }
  }, [element, globalStyle, modelSettings.image, setElementImage])

  const handleSuggestDescription = useCallback(async () => {
    if (!element) return
    setIsSuggestingDesc(true)
    try {
      const res = await fetch('/api/suggest-element-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: element.name,
          category: element.category,
          globalStyle,
        }),
      })
      const data = await res.json()
      if (data.description) {
        updateElement(element.id, { description: data.description })
      }
    } catch {
      // silently fail
    } finally {
      setIsSuggestingDesc(false)
    }
  }, [element, globalStyle, updateElement])

  if (!element) {
    return (
      <div className="text-center py-12">
        <p className="text-white/40">Element not found</p>
      </div>
    )
  }

  const config = CATEGORY_CONFIG[element.category]
  const Icon = config.icon
  const images = element.referenceImageIds
    .map((id) => elementImages[id])
    .filter(Boolean)

  const usageCount = scenes.filter((s) =>
    s.elementRefs?.some((r) => r.elementId === element.id)
  ).length

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-white/5 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={element.name}
            onChange={(e) => updateElement(element.id, { name: e.target.value })}
            className="w-full bg-transparent text-lg font-semibold text-white focus:outline-none border-b border-transparent focus:border-white/20 pb-1"
            placeholder="Element name..."
          />
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium uppercase tracking-wide ${config.color}`}>
              {config.label}
            </span>
            {usageCount > 0 && (
              <span className="text-xs text-white/30">
                Used in {usageCount} scene{usageCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-white/40" />
        </button>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/40 uppercase tracking-wide">
            Description
          </label>
          <button
            onClick={handleSuggestDescription}
            disabled={isSuggestingDesc || !element.name.trim()}
            className="flex items-center gap-1 px-2 py-1 text-xs text-brand-400/70 hover:text-brand-400 hover:bg-brand-500/10 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
            title="AI suggest a visual description from the name"
          >
            {isSuggestingDesc ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            {isSuggestingDesc ? 'Writing...' : 'Suggest'}
          </button>
        </div>
        <textarea
          value={element.description}
          onChange={(e) => updateElement(element.id, { description: e.target.value })}
          placeholder="Describe this element in detail for AI generation..."
          className="w-full h-32 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500 leading-relaxed"
        />
        <p className="text-[11px] text-white/25 mt-1">
          This description is used as context when generating frames and videos
        </p>
      </div>

      {/* Reference Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/40 uppercase tracking-wide">
            Reference Images
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !element.name.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs text-brand-400/70 hover:text-brand-400 hover:bg-brand-500/10 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
              title="Generate a reference image with AI"
            >
              {isGeneratingImage ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {isGeneratingImage ? 'Generating...' : 'Generate'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-xs text-white/50 hover:text-white/70 hover:bg-white/5 rounded transition-colors"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {images.length > 0 || isGeneratingImage ? (
          <div className="grid grid-cols-3 gap-2">
            {/* Generating placeholder */}
            {isGeneratingImage && (
              <div className="aspect-square rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/30 flex items-center justify-center animate-pulse">
                <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
              </div>
            )}
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden bg-white/5">
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => deleteElementImage(img.id, element.id)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
                {img.source === 'generated' && (
                  <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 px-1 py-0.5 rounded text-white/60">
                    AI
                  </span>
                )}
              </div>
            ))}
            {/* Upload placeholder */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-white/15 hover:border-white/30 flex items-center justify-center transition-colors"
            >
              <Upload className="w-5 h-5 text-white/20" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 border border-dashed border-white/15 hover:border-white/30 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-white/15" />
            <span className="text-xs text-white/30">Add reference images for visual consistency</span>
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="pt-4 border-t border-white/10">
        <button
          onClick={() => {
            deleteElement(element.id)
            onClose()
          }}
          className="flex items-center gap-2 px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete element
        </button>
      </div>
    </div>
  )
}
