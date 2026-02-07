'use client'

import { Loader2, Play, Pause, RotateCcw, X, Zap, ZapOff } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import type { WorkflowStage } from '@/types'

interface WorkflowBarProps {
  onStartTranscription: () => void
  onStartPlanning: () => void
  onStartGeneration: () => void
  onCancelOperation?: () => void
}

const STAGE_INFO: Record<WorkflowStage, { label: string; index: number }> = {
  empty: { label: 'Upload Audio', index: 0 },
  audio_loaded: { label: 'Ready', index: 1 },
  transcribing: { label: 'Transcribing', index: 1 },
  transcribed: { label: 'Transcribed', index: 2 },
  planning: { label: 'Planning Scenes', index: 2 },
  planned: { label: 'Ready to Generate', index: 3 },
  generating: { label: 'Generating', index: 4 },
  ready: { label: 'Ready to Export', index: 5 },
}

const TOTAL_STAGES = 5

export function WorkflowBar({
  onStartTranscription,
  onStartPlanning,
  onStartGeneration,
  onCancelOperation,
}: WorkflowBarProps) {
  const { workflow, setAutoProgress, clearWorkflowError, generationQueue, pauseQueue, resumeQueue } = useProjectStore()
  const { stage, autoProgress, error, progress } = workflow

  const stageInfo = STAGE_INFO[stage] || STAGE_INFO['empty']
  const isProcessing = stage === 'transcribing' || stage === 'planning' || stage === 'generating'

  // Get current progress for active operation
  const currentProgress = stage === 'transcribing'
    ? progress.transcription
    : stage === 'planning'
    ? progress.planning
    : stage === 'generating'
    ? progress.generation
    : 0

  // Get action button based on current stage
  const getActionButton = () => {
    if (error) {
      return (
        <button
          onClick={() => {
            clearWorkflowError()
            if (error.stage === 'transcribing') onStartTranscription()
            else if (error.stage === 'planning') onStartPlanning()
          }}
          className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      )
    }

    switch (stage) {
      case 'audio_loaded':
        return (
          <button
            onClick={onStartTranscription}
            className="px-3 py-1 text-xs bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/50 text-brand-400 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3 h-3" />
            Transcribe
          </button>
        )
      case 'transcribed':
        return (
          <button
            onClick={onStartPlanning}
            className="px-3 py-1 text-xs bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/50 text-brand-400 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3 h-3" />
            Plan Scenes
          </button>
        )
      case 'planned':
        return (
          <button
            onClick={onStartGeneration}
            className="px-3 py-1 text-xs bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/50 text-brand-400 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3 h-3" />
            Generate All
          </button>
        )
      case 'generating':
        return (
          <button
            onClick={() => generationQueue.isPaused ? resumeQueue() : pauseQueue()}
            className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            {generationQueue.isPaused ? (
              <>
                <Play className="w-3 h-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                Pause
              </>
            )}
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-black/30 border-b border-white/10">
      {/* Status indicator */}
      <div className="flex items-center gap-2 min-w-[200px]">
        {isProcessing ? (
          <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
        ) : error ? (
          <div className="w-4 h-4 rounded-full bg-red-500" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-green-500/50" />
        )}

        <div className="flex flex-col">
          <span className="text-sm font-medium text-white/90">
            {error ? 'Error' : stageInfo.label}
            {isProcessing && ` (${currentProgress}%)`}
          </span>
          {error && (
            <span className="text-xs text-red-400 truncate max-w-[180px]" title={error.message}>
              {error.message}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar (only when processing) */}
      {isProcessing && (
        <div className="flex-1 max-w-xs">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="flex items-center gap-2">
        {getActionButton()}

        {error && (
          <button
            onClick={clearWorkflowError}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Dismiss error"
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Auto-progress toggle */}
      <button
        onClick={() => setAutoProgress(!autoProgress)}
        className={`px-2 py-1 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
          autoProgress
            ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
            : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
        }`}
        title={autoProgress ? 'Auto-progress enabled' : 'Auto-progress disabled'}
      >
        {autoProgress ? (
          <Zap className="w-3 h-3" />
        ) : (
          <ZapOff className="w-3 h-3" />
        )}
        Auto
      </button>

      {/* Stage dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < stageInfo.index
                ? 'bg-brand-500'
                : i === stageInfo.index
                ? 'bg-brand-500/50 ring-2 ring-brand-500/30'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
