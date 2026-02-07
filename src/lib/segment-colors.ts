export const SEGMENT_TYPES = ['verse', 'chorus', 'bridge', 'intro', 'outro', 'instrumental', 'spoken'] as const

export interface SegmentColorSet {
  bg: string
  border: string
  text: string
  pill: string
  dot: string
}

const SEGMENT_COLORS: Record<string, SegmentColorSet> = {
  verse:        { bg: 'bg-blue-500/30', border: 'border-blue-500/50', text: 'text-blue-400', pill: 'bg-blue-500/20 text-blue-400', dot: 'bg-blue-500' },
  chorus:       { bg: 'bg-purple-500/30', border: 'border-purple-500/50', text: 'text-purple-400', pill: 'bg-purple-500/20 text-purple-400', dot: 'bg-purple-500' },
  bridge:       { bg: 'bg-orange-500/30', border: 'border-orange-500/50', text: 'text-orange-400', pill: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-500' },
  intro:        { bg: 'bg-teal-500/30', border: 'border-teal-500/50', text: 'text-teal-400', pill: 'bg-teal-500/20 text-teal-400', dot: 'bg-teal-500' },
  outro:        { bg: 'bg-pink-500/30', border: 'border-pink-500/50', text: 'text-pink-400', pill: 'bg-pink-500/20 text-pink-400', dot: 'bg-pink-500' },
  pre_chorus:   { bg: 'bg-indigo-500/30', border: 'border-indigo-500/50', text: 'text-indigo-400', pill: 'bg-indigo-500/20 text-indigo-400', dot: 'bg-indigo-500' },
  hook:         { bg: 'bg-yellow-500/30', border: 'border-yellow-500/50', text: 'text-yellow-400', pill: 'bg-yellow-500/20 text-yellow-400', dot: 'bg-yellow-500' },
  instrumental: { bg: 'bg-green-500/30', border: 'border-green-500/50', text: 'text-green-400', pill: 'bg-green-500/20 text-green-400', dot: 'bg-green-500' },
  spoken:       { bg: 'bg-amber-500/30', border: 'border-amber-500/50', text: 'text-amber-400', pill: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
}

const DEFAULT_COLOR: SegmentColorSet = {
  bg: 'bg-white/10', border: 'border-white/20', text: 'text-white/60', pill: 'bg-white/10 text-white/60', dot: 'bg-white/40',
}

export function getSegmentColor(type: string): SegmentColorSet {
  return SEGMENT_COLORS[type.toLowerCase()] || DEFAULT_COLOR
}
