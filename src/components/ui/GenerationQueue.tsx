'use client'

import { useEffect, useCallback } from 'react'
import { X, Play, Pause, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Loader2, Image, Video } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { processQueue } from '@/lib/generation-queue'
import type { QueueItem } from '@/types'

interface GenerationQueueProps {
  isOpen: boolean
  onClose: () => void
}

export function GenerationQueue({ isOpen, onClose }: GenerationQueueProps) {
  const {
    generationQueue,
    clips,
    scenes,
    frames,
    globalStyle,
    modelSettings,
    updateQueueItem,
    setFrame,
    setVideo,
    updateClip,
    startQueue,
    pauseQueue,
    resumeQueue,
    clearQueue,
    removeFromQueue,
  } = useProjectStore()

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Process queue when started - only trigger on isProcessing/isPaused changes
  // NOT on items changes (queue processor handles items internally)
  useEffect(() => {
    if (generationQueue.isProcessing && !generationQueue.isPaused) {
      // Use store.getState() for fresh state in callbacks, not stale closures
      const callbacks = {
        getState: () => useProjectStore.getState(),
        updateQueueItem,
        setFrame,
        setVideo,
        updateClip,
      }
      processQueue(callbacks)
    }
  }, [generationQueue.isProcessing, generationQueue.isPaused, updateQueueItem, setFrame, setVideo, updateClip])

  const handleStart = useCallback(() => {
    startQueue()
  }, [startQueue])

  const handlePause = useCallback(() => {
    pauseQueue()
  }, [pauseQueue])

  const handleResume = useCallback(() => {
    resumeQueue()
  }, [resumeQueue])

  const handleRetryFailed = useCallback(() => {
    // Reset failed items to pending
    generationQueue.items
      .filter(item => item.status === 'failed')
      .forEach(item => {
        updateQueueItem(item.id, { status: 'pending', error: undefined, retryCount: 0, progress: 0 })
      })
  }, [generationQueue.items, updateQueueItem])

  const handleClearCompleted = useCallback(() => {
    generationQueue.items
      .filter(item => item.status === 'complete')
      .forEach(item => removeFromQueue(item.id))
  }, [generationQueue.items, removeFromQueue])

  if (!isOpen) return null

  const pendingCount = generationQueue.items.filter(i => i.status === 'pending').length
  const processingCount = generationQueue.items.filter(i => i.status === 'processing').length
  const completeCount = generationQueue.items.filter(i => i.status === 'complete').length
  const failedCount = generationQueue.items.filter(i => i.status === 'failed').length
  const totalCount = generationQueue.items.length
  const overallProgress = totalCount > 0
    ? Math.round((completeCount / totalCount) * 100)
    : 0

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-white/40" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getClipTitle = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId)
    return clip?.title || 'Unknown clip'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Generation Queue</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Overall Progress</span>
            <span className="text-sm text-white">{completeCount}/{totalCount} complete</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-white/40">
            <span>{pendingCount} pending</span>
            <span>{processingCount} processing</span>
            <span className="text-green-500">{completeCount} complete</span>
            {failedCount > 0 && <span className="text-red-500">{failedCount} failed</span>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          {!generationQueue.isProcessing ? (
            <button
              onClick={handleStart}
              disabled={pendingCount === 0}
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          ) : generationQueue.isPaused ? (
            <button
              onClick={handleResume}
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}

          {failedCount > 0 && (
            <button
              onClick={handleRetryFailed}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Failed
            </button>
          )}

          {completeCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              Clear Done
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={clearQueue}
            disabled={generationQueue.isProcessing && !generationQueue.isPaused}
            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all"
          >
            <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
          </button>
        </div>

        {/* Queue items */}
        <div className="flex-1 overflow-y-auto p-4">
          {generationQueue.items.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              <p>Queue is empty</p>
              <p className="text-xs mt-1">Use "Generate All Frames" to add items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {generationQueue.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border ${
                    item.status === 'processing'
                      ? 'bg-brand-500/10 border-brand-500/30'
                      : item.status === 'complete'
                      ? 'bg-green-500/10 border-green-500/30'
                      : item.status === 'failed'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.type === 'frame' ? (
                          <Image className="w-3.5 h-3.5 text-white/40" />
                        ) : (
                          <Video className="w-3.5 h-3.5 text-white/40" />
                        )}
                        <span className="text-sm text-white truncate">
                          {getClipTitle(item.clipId)}
                        </span>
                        {item.frameType && (
                          <span className="text-xs text-white/40">({item.frameType})</span>
                        )}
                      </div>
                      {item.error && (
                        <p className="text-xs text-red-400 mt-1 truncate">{item.error}</p>
                      )}
                    </div>
                    {item.status === 'processing' && (
                      <span className="text-xs text-white/40">{item.progress}%</span>
                    )}
                    {(item.status === 'pending' || item.status === 'failed') && (
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-white/40" />
                      </button>
                    )}
                  </div>
                  {item.status === 'processing' && (
                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
