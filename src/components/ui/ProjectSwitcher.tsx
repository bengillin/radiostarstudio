'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Plus, Check, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import {
  getProjectsList,
  getActiveProjectId,
  createAndSwitchProject,
  renameProject,
  deleteProject,
  switchProject,
  type ProjectMetadata,
} from '@/lib/project-manager'

export function ProjectSwitcher() {
  const generationQueue = useProjectStore((s) => s.generationQueue)
  const [isOpen, setIsOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectMetadata[]>([])
  const [activeId, setActiveId] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [switchWarningId, setSwitchWarningId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Load project list
  useEffect(() => {
    setProjects(getProjectsList())
    setActiveId(getActiveProjectId())
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setRenamingId(null)
        setConfirmDeleteId(null)
        setSwitchWarningId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const activeProject = projects.find(p => p.id === activeId)

  const handleSwitch = useCallback((id: string) => {
    if (id === activeId) return
    // Warn if queue is processing
    if (generationQueue.isProcessing && !generationQueue.isPaused) {
      setSwitchWarningId(id)
      return
    }
    switchProject(id)
  }, [activeId, generationQueue])

  const handleConfirmSwitch = useCallback((id: string) => {
    setSwitchWarningId(null)
    switchProject(id)
  }, [])

  const handleRenameSubmit = useCallback((id: string) => {
    const trimmed = renameValue.trim()
    if (trimmed) {
      renameProject(id, trimmed)
      setProjects(getProjectsList())
    }
    setRenamingId(null)
  }, [renameValue])

  const handleDelete = useCallback(async (id: string) => {
    await deleteProject(id)
    setConfirmDeleteId(null)
    // If we deleted the active project, deleteProject already switched — reload
    if (id === activeId) {
      window.location.reload()
    } else {
      setProjects(getProjectsList())
    }
  }, [activeId])

  const handleNewProject = useCallback(() => {
    createAndSwitchProject('Untitled Project')
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors max-w-[240px]"
      >
        <span className="text-sm font-medium text-white truncate">
          {activeProject?.name || 'No Project'}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Project list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {projects.map((project) => {
              const isActive = project.id === activeId
              const isRenaming = renamingId === project.id
              const isConfirmingDelete = confirmDeleteId === project.id
              const isWarning = switchWarningId === project.id

              return (
                <div key={project.id} className="group relative">
                  {isConfirmingDelete ? (
                    <div className="px-3 py-2 bg-red-500/10 border-y border-red-500/20">
                      <p className="text-xs text-red-400 mb-2">Delete "{project.name}"? This cannot be undone.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded text-white transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-white/70 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isWarning ? (
                    <div className="px-3 py-2 bg-yellow-500/10 border-y border-yellow-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                        <p className="text-xs text-yellow-400">Generation is running. Switch anyway?</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmSwitch(project.id)}
                          className="px-2 py-1 text-xs bg-yellow-500/30 hover:bg-yellow-500/40 rounded text-yellow-200 transition-colors"
                        >
                          Switch
                        </button>
                        <button
                          onClick={() => setSwitchWarningId(null)}
                          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-white/70 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isRenaming ? (
                    <div className="px-3 py-2">
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(project.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => handleRenameSubmit(project.id)}
                        className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        isActive ? 'bg-white/5' : 'hover:bg-white/5'
                      }`}
                      onClick={() => handleSwitch(project.id)}
                    >
                      <div className="w-4 flex-shrink-0">
                        {isActive && <Check className="w-4 h-4 text-brand-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-white/70'}`}>
                          {project.name}
                        </p>
                        <p className="text-[10px] text-white/30">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {/* Action buttons — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenameValue(project.name)
                            setRenamingId(project.id)
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3 text-white/40" />
                        </button>
                        {projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDeleteId(project.id)
                            }}
                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* New project */}
          <div className="border-t border-white/10 p-1">
            <button
              onClick={handleNewProject}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
