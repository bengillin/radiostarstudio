import { useEffect } from 'react'
import { useProjectStore } from '@/store/project-store'
import type { Scene } from '@/types'

const VEO_MAX_DURATION = 8

interface UseKeyboardShortcutsOptions {
  currentTime: number
  isPlaying: boolean
  togglePlayback: () => void
  handleSeek: (time: number) => void
  handleDeleteSelectedClip: () => void
  handleSplitAtPlayhead: () => void
  setCenterTab: (tab: 'lyrics' | 'world' | 'scenes' | 'clips') => void
  setRightPanelTab: (tab: 'library' | 'queue') => void
  setShowShortcutsModal: (show: boolean) => void
  setShowExportDialog: (show: boolean) => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function useKeyboardShortcuts({
  currentTime,
  isPlaying,
  togglePlayback,
  handleSeek,
  handleDeleteSelectedClip,
  handleSplitAtPlayhead,
  setCenterTab,
  setRightPanelTab,
  setShowShortcutsModal,
  setShowExportDialog,
  showToast,
}: UseKeyboardShortcutsOptions) {
  const {
    scenes,
    undo,
    redo,
    saveToHistory,
    createScene,
    createClip,
    timeline,
  } = useProjectStore()

  const selectedClipIds = timeline?.selectedClipIds ?? []
  const selectedClipId = selectedClipIds.length > 0 ? selectedClipIds[selectedClipIds.length - 1] : null

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlayback()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handleSeek(currentTime - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          handleSeek(currentTime + 5)
          break
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) {
            e.preventDefault()
            handleDeleteSelectedClip()
          }
          break
        case 'KeyZ':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
          }
          break
        case 'KeyS':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            handleSplitAtPlayhead()
          }
          break
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault()
            setShowShortcutsModal(true)
          }
          break
        case 'KeyN':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) {
              const sceneAtPlayhead = scenes.find((s: Scene) =>
                currentTime >= s.startTime && currentTime < s.endTime
              )
              if (sceneAtPlayhead) {
                saveToHistory()
                createClip(currentTime, Math.min(currentTime + VEO_MAX_DURATION, sceneAtPlayhead.endTime), undefined, sceneAtPlayhead.id)
                showToast('Clip created', 'success')
              } else {
                showToast('No scene at playhead position', 'error')
              }
            } else {
              saveToHistory()
              createScene()
              showToast('Scene created', 'success')
            }
          }
          break
        case 'KeyG':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            setRightPanelTab('queue')
          }
          break
        case 'KeyE':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            setShowExportDialog(true)
          }
          break
        case 'KeyM':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            setRightPanelTab('library')
          }
          break
        case 'KeyB':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            setCenterTab('clips')
          }
          break
        case 'KeyL':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            setCenterTab('lyrics')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTime, selectedClipId, selectedClipIds, isPlaying, scenes, togglePlayback, handleSeek, handleDeleteSelectedClip, handleSplitAtPlayhead, undo, redo, saveToHistory, createScene, createClip, showToast, setCenterTab, setRightPanelTab, setShowShortcutsModal, setShowExportDialog])
}
