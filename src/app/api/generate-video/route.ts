import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Helper to extract base64 and mime type from data URL
function parseDataUrl(dataUrl: string): { mimeType: string; imageBytes: string } | null {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], imageBytes: match[2] }
}

export async function POST(request: NextRequest) {
  console.log('[generate-video] API called')

  if (!GEMINI_API_KEY) {
    console.log('[generate-video] ERROR: No API key configured')
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { clipId, startFrameUrl, endFrameUrl, motionPrompt, scene, globalStyle, model } = body

    if (!clipId || !startFrameUrl) {
      return NextResponse.json(
        { error: 'clipId and startFrameUrl are required' },
        { status: 400 }
      )
    }

    const videoModel = model || 'veo-3.1-generate-preview'
    const hasEndFrame = !!endFrameUrl
    console.log('[generate-video] Generating video for clip:', clipId, 'model:', videoModel)
    console.log('[generate-video] Using interpolation:', hasEndFrame ? 'yes (start + end frames)' : 'no (start frame only)')
    console.log('[generate-video] Motion prompt:', motionPrompt?.substring(0, 100))

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    // Parse start frame
    const startFrame = parseDataUrl(startFrameUrl)
    if (!startFrame) {
      return NextResponse.json(
        { error: 'Invalid start frame data URL' },
        { status: 400 }
      )
    }

    // Parse end frame if provided
    const endFrame = endFrameUrl ? parseDataUrl(endFrameUrl) : null
    if (endFrameUrl && !endFrame) {
      console.log('[generate-video] Warning: Invalid end frame URL, proceeding without interpolation')
    }

    // Build motion prompt with scene context
    const sceneContext = scene ? `
Scene context:
- Setting: ${scene.where || 'unspecified'}
- Action: ${scene.what || 'unspecified'}
- Mood: ${scene.why || 'unspecified'}
- Time: ${scene.when || 'unspecified'}
` : ''

    const interpolationNote = endFrame
      ? 'Smoothly interpolate motion from the first frame to the last frame.'
      : 'Create smooth, cinematic camera movement. Maintain visual consistency with the input frame.'

    const fullPrompt = `${motionPrompt || 'Subtle cinematic motion'}

${sceneContext}
Visual style: ${globalStyle || 'cinematic, high quality'}

${interpolationNote}`

    console.log('[generate-video] Calling Veo API with model:', videoModel)

    // Build config - add lastFrame for interpolation if end frame is available
    const config: Record<string, unknown> = {
      numberOfVideos: 1,
      durationSeconds: 8,
      aspectRatio: '16:9',
      personGeneration: 'allow_adult',
      resolution: '720p',
    }

    // Add last frame for interpolation (Veo 3.1 feature)
    if (endFrame) {
      config.lastFrame = {
        imageBytes: endFrame.imageBytes,
        mimeType: endFrame.mimeType,
      }
      console.log('[generate-video] Interpolation mode: first + last frame')
    }

    // Generate video using Veo
    let operation = await ai.models.generateVideos({
      model: videoModel,
      prompt: fullPrompt,
      image: {
        imageBytes: startFrame.imageBytes,
        mimeType: startFrame.mimeType,
      },
      config,
    })

    console.log('[generate-video] Video generation started, polling...')

    // Poll for completion (max 5 minutes)
    const maxAttempts = 30
    let attempts = 0

    while (!operation.done && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second intervals
      attempts++
      console.log(`[generate-video] Polling attempt ${attempts}/${maxAttempts}`)
      operation = await ai.operations.getVideosOperation({ operation })
    }

    if (!operation.done) {
      console.log('[generate-video] Timeout waiting for video')
      return NextResponse.json(
        { error: 'Video generation timed out. Try again later.' },
        { status: 504 }
      )
    }

    if (operation.error) {
      const errorMessage = typeof operation.error === 'object' && operation.error !== null && 'message' in operation.error
        ? String(operation.error.message)
        : 'Video generation failed'
      console.log('[generate-video] Error:', errorMessage)
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri
    if (!videoUri) {
      console.log('[generate-video] No video URI in response')
      return NextResponse.json(
        { error: 'No video generated' },
        { status: 500 }
      )
    }

    console.log('[generate-video] Video generated, fetching...')

    // Fetch and convert to base64
    const videoResponse = await fetch(`${videoUri}&key=${GEMINI_API_KEY}`)
    if (!videoResponse.ok) {
      throw new Error('Failed to download video')
    }

    const blob = await videoResponse.blob()
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const videoDataUrl = `data:video/mp4;base64,${base64}`

    console.log('[generate-video] Success!', endFrame ? '(interpolated)' : '(single frame)')

    return NextResponse.json({
      success: true,
      video: {
        id: `video-${clipId}-${Date.now()}`,
        clipId,
        url: videoDataUrl,
        duration: 8,
        status: 'complete',
        startFrameId: `frame-${clipId}-start`,
        endFrameId: endFrame ? `frame-${clipId}-end` : undefined,
        motionPrompt: fullPrompt,
        model: videoModel,
        generatedAt: new Date().toISOString(),
        interpolated: !!endFrame, // Track if video used start+end frame interpolation
      },
    })
  } catch (error) {
    console.error('[generate-video] ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate video', details: errorMessage },
      { status: 500 }
    )
  }
}
