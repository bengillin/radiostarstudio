import { Users, Clapperboard, Clock, MapPin, Heart } from 'lucide-react'
import type { ElementCategory } from '@/types'

export const CATEGORY_CONFIG: Record<ElementCategory, {
  label: string
  icon: typeof Users
  color: string
  bgColor: string
  placeholder: string
}> = {
  who: { label: 'Who', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/20', placeholder: 'Characters/subjects...' },
  what: { label: 'What', icon: Clapperboard, color: 'text-orange-400', bgColor: 'bg-orange-500/20', placeholder: 'Action/event...' },
  when: { label: 'When', icon: Clock, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', placeholder: 'Time period...' },
  where: { label: 'Where', icon: MapPin, color: 'text-green-400', bgColor: 'bg-green-500/20', placeholder: 'Location...' },
  why: { label: 'Why', icon: Heart, color: 'text-pink-400', bgColor: 'bg-pink-500/20', placeholder: 'Mood/motivation...' },
}

export const CATEGORIES: ElementCategory[] = ['who', 'what', 'when', 'where', 'why']
