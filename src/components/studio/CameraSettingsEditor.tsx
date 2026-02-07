'use client'

import type { CameraSettings, FilmStock, LensType, AspectRatio } from '@/types'

interface CameraSettingsEditorProps {
  settings: Partial<CameraSettings>
  onChange: (settings: Partial<CameraSettings>) => void
  isOverride?: boolean
  globalDefaults?: CameraSettings
}

const FILM_STOCKS: { value: FilmStock; label: string }[] = [
  { value: 'kodak-vision3-500t', label: 'Kodak Vision3 500T' },
  { value: 'kodak-vision3-250d', label: 'Kodak Vision3 250D' },
  { value: 'kodak-vision3-50d', label: 'Kodak Vision3 50D' },
  { value: 'kodak-ektachrome', label: 'Kodak Ektachrome' },
  { value: 'fuji-eterna-500t', label: 'Fuji Eterna 500T' },
  { value: 'fuji-provia', label: 'Fuji Provia' },
  { value: 'ilford-hp5', label: 'Ilford HP5 (B&W)' },
  { value: 'cinestill-800t', label: 'CineStill 800T' },
  { value: 'custom', label: 'Custom...' },
]

const LENS_TYPES: { value: LensType; label: string }[] = [
  { value: 'wide', label: 'Wide' },
  { value: 'standard', label: 'Standard' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'telephoto', label: 'Telephoto' },
  { value: 'macro', label: 'Macro' },
  { value: 'anamorphic', label: 'Anamorphic' },
  { value: 'custom', label: 'Custom...' },
]

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '2.39:1', '4:3', '1:1', '9:16']

const DOF_OPTIONS = ['shallow', 'medium', 'deep'] as const
const GRAIN_OPTIONS = ['none', 'light', 'medium', 'heavy'] as const

function resolveValue<T>(local: T | undefined, global: T | undefined): T | undefined {
  return local !== undefined ? local : global
}

export function CameraSettingsEditor({ settings, onChange, isOverride, globalDefaults }: CameraSettingsEditorProps) {
  const resolved = (key: keyof CameraSettings) =>
    isOverride ? resolveValue(settings[key], globalDefaults?.[key]) : settings[key]

  const isOverridden = (key: keyof CameraSettings) =>
    isOverride && settings[key] !== undefined

  const handleChange = (key: keyof CameraSettings, value: unknown) => {
    onChange({ ...settings, [key]: value || undefined })
  }

  const handleClearOverride = (key: keyof CameraSettings) => {
    const { [key]: _, ...rest } = settings
    onChange(rest)
  }

  const selectClass = 'w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-brand-500'
  const inputClass = 'w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500'

  return (
    <div className="space-y-3">
      {/* Camera Type */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-white/40 uppercase tracking-wide">Camera</label>
          {isOverride && isOverridden('cameraType') && (
            <button onClick={() => handleClearOverride('cameraType')} className="text-[10px] text-brand-400 hover:text-brand-300">
              Use global
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(['film', 'digital'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleChange('cameraType', settings.cameraType === type ? undefined : type)}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                resolved('cameraType') === type
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {type === 'film' ? 'Film' : 'Digital'}
            </button>
          ))}
        </div>
      </div>

      {/* Film Stock — only when film selected */}
      {resolved('cameraType') === 'film' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-white/40 uppercase tracking-wide">Film Stock</label>
            {isOverride && isOverridden('filmStock') && (
              <button onClick={() => handleClearOverride('filmStock')} className="text-[10px] text-brand-400 hover:text-brand-300">
                Use global
              </button>
            )}
          </div>
          <select
            value={resolved('filmStock') as string || ''}
            onChange={(e) => handleChange('filmStock', e.target.value)}
            className={selectClass}
          >
            <option value="">Select stock...</option>
            {FILM_STOCKS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {resolved('filmStock') === 'custom' && (
            <input
              type="text"
              value={(isOverridden('customFilmStock') ? settings.customFilmStock : resolved('customFilmStock') as string) || ''}
              onChange={(e) => handleChange('customFilmStock', e.target.value)}
              placeholder="Describe film look..."
              className={`mt-1 ${inputClass}`}
            />
          )}
        </div>
      )}

      {/* Lens */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-white/40 uppercase tracking-wide">Lens</label>
          {isOverride && isOverridden('lensType') && (
            <button onClick={() => handleClearOverride('lensType')} className="text-[10px] text-brand-400 hover:text-brand-300">
              Use global
            </button>
          )}
        </div>
        <select
          value={resolved('lensType') as string || ''}
          onChange={(e) => handleChange('lensType', e.target.value)}
          className={selectClass}
        >
          <option value="">Select lens...</option>
          {LENS_TYPES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        {resolved('lensType') === 'custom' && (
          <input
            type="text"
            value={(isOverridden('customLens') ? settings.customLens : resolved('customLens') as string) || ''}
            onChange={(e) => handleChange('customLens', e.target.value)}
            placeholder="Describe lens..."
            className={`mt-1 ${inputClass}`}
          />
        )}
        {resolved('lensType') && resolved('lensType') !== 'custom' && (
          <input
            type="text"
            value={(isOverridden('focalLength') ? settings.focalLength : resolved('focalLength') as string) || ''}
            onChange={(e) => handleChange('focalLength', e.target.value)}
            placeholder="Focal length (e.g. 35mm)"
            className={`mt-1 ${inputClass}`}
          />
        )}
      </div>

      {/* Aspect Ratio */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-white/40 uppercase tracking-wide">Aspect Ratio</label>
          {isOverride && isOverridden('aspectRatio') && (
            <button onClick={() => handleClearOverride('aspectRatio')} className="text-[10px] text-brand-400 hover:text-brand-300">
              Use global
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleChange('aspectRatio', settings.aspectRatio === ratio ? undefined : ratio)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                resolved('aspectRatio') === ratio
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Depth of Field */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-white/40 uppercase tracking-wide">Depth of Field</label>
          {isOverride && isOverridden('depthOfField') && (
            <button onClick={() => handleClearOverride('depthOfField')} className="text-[10px] text-brand-400 hover:text-brand-300">
              Use global
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {DOF_OPTIONS.map((dof) => (
            <button
              key={dof}
              onClick={() => handleChange('depthOfField', settings.depthOfField === dof ? undefined : dof)}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                resolved('depthOfField') === dof
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {dof}
            </button>
          ))}
        </div>
      </div>

      {/* Grain */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-white/40 uppercase tracking-wide">Film Grain</label>
          {isOverride && isOverridden('grainIntensity') && (
            <button onClick={() => handleClearOverride('grainIntensity')} className="text-[10px] text-brand-400 hover:text-brand-300">
              Use global
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {GRAIN_OPTIONS.map((grain) => (
            <button
              key={grain}
              onClick={() => handleChange('grainIntensity', settings.grainIntensity === grain ? undefined : grain)}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                resolved('grainIntensity') === grain
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {grain}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
