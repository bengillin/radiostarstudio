'use client'

import { Grid, Image, Video, Music, ImageIcon } from 'lucide-react'
import type { LibraryFilter } from '@/types'

interface MediaLibraryFiltersProps {
  activeFilter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
  counts: Record<LibraryFilter, number>
}

const filters: { id: LibraryFilter; label: string; icon: typeof Grid }[] = [
  { id: 'all', label: 'All', icon: Grid },
  { id: 'frames', label: 'Frames', icon: Image },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'references', label: 'References', icon: ImageIcon },
]

export function MediaLibraryFilters({
  activeFilter,
  onFilterChange,
  counts,
}: MediaLibraryFiltersProps) {
  return (
    <div className="flex gap-1">
      {filters.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onFilterChange(id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${activeFilter === id
              ? 'bg-brand-500 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }
          `}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          <span className={`text-xs ${activeFilter === id ? 'text-white/70' : 'text-white/40'}`}>
            {counts[id]}
          </span>
        </button>
      ))}
    </div>
  )
}
