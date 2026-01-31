import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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
    const { clipId, startFrameUrl, endFrameUrl, motionPrompt, scene, globalStyle } = body

    if (!clipId || !startFrameUrl) {
      return NextResponse.json(
        { error: 'clipId and startFrameUrl are required' },
        { status: 400 }
      )
    }

    console.log('[generate-video] Generating video for clip:', clipId)
    console.log('[generate-video] Motion prompt:', motionPrompt?.substring(0, 100))

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    // Extract base64 from data URL
    const match = startFrameUrl.match(/^data:(.+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid image data URL' },
        { status: 400 }
      )
    }

    const mimeType = match[1]
    const imageBytes = match[2]

    // Build motion prompt with scene context
    const sceneContext = scene ? `
Scene context:
- Setting: ${scene.where || 'unspecified'}
- Action: ${scene.what || 'unspecified'}
- Mood: ${scene.why || 'unspecified'}
- Time: ${scene.when || 'unspecified'}
` : ''

    const fullPrompt = `${motionPrompt || 'Subtle cinematic motion'}

${sceneContext}
Visual style: ${globalStyle || 'cinematic, high quality'}

Create smooth, cinematic camera movement. Maintain visual consistency with the input frame.`

    console.log('[generate-video] Calling Veo API...')

    // Generate video using Veo
    let operation = await ai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt: fullPrompt,
      image: {
        imageBytes,
        mimeType,
      },
      config: {
        numberOfVideos: 1,
        durationSeconds: 5,
        fps: 24,
        aspectRatio: '16:9',
        personGeneration: 'allow_adult',
      },
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

    console.log('[generate-video] Success!')

    return NextResponse.json({
      success: true,
      video: {
        id: `video-${clipId}-${Date.now()}`,
        clipId,
        url: videoDataUrl,
        duration: 5,
        status: 'complete',
        startFrameId: `frame-${clipId}-start`,
        motionPrompt: fullPrompt,
        model: 'veo-2.0-generate-001',
        generatedAt: new Date().toISOString(),
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
