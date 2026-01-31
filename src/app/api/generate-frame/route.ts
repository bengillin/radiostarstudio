import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  console.log('[generate-frame] API called')

  if (!GEMINI_API_KEY) {
    console.log('[generate-frame] ERROR: No API key configured')
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { prompt, clipId, type, scene, globalStyle } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'No prompt provided' },
        { status: 400 }
      )
    }

    console.log('[generate-frame] Generating frame for clip:', clipId, 'type:', type)
    console.log('[generate-frame] Prompt:', prompt.substring(0, 100) + '...')

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    // Build a rich prompt incorporating scene context
    const sceneContext = scene ? `
Scene: ${scene.title}
- Who: ${scene.who?.join(', ') || 'unspecified'}
- What: ${scene.what || 'unspecified'}
- When: ${scene.when || 'unspecified'}
- Where: ${scene.where || 'unspecified'}
- Why/Mood: ${scene.why || 'unspecified'}
` : ''

    const fullPrompt = `Generate a cinematic frame for a music video.

${sceneContext}
Visual Style: ${globalStyle || 'cinematic, high quality'}

Frame Description: ${prompt}

Requirements:
- 16:9 aspect ratio
- Cinematic composition
- Rich detail and lighting
- Suitable as a keyframe for video generation`

    console.log('[generate-frame] Calling Gemini API...')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: ['image', 'text'],
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
    })

    console.log('[generate-frame] Response received')

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          console.log('[generate-frame] Image generated successfully')
          return NextResponse.json({
            success: true,
            frame: {
              id: `frame-${clipId}-${type}-${Date.now()}`,
              clipId,
              type,
              source: 'generated',
              url: imageData,
              prompt,
              generatedAt: new Date().toISOString(),
              model: 'gemini-2.0-flash-exp',
            },
          })
        }
      }
    }

    // If no image was generated, return error
    console.log('[generate-frame] No image in response')
    return NextResponse.json(
      { error: 'No image generated. Try a different prompt.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[generate-frame] ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate frame', details: errorMessage },
      { status: 500 }
    )
  }
}
