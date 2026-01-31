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
    const { prompt, clipId, type, scene, globalStyle, model } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'No prompt provided' },
        { status: 400 }
      )
    }

    const imageModel = model || 'imagen-4.0-generate-001'
    console.log('[generate-frame] Generating frame for clip:', clipId, 'type:', type, 'model:', imageModel)
    console.log('[generate-frame] Prompt:', prompt.substring(0, 100) + '...')

    // Build a rich prompt incorporating scene context
    const sceneContext = scene ? `
Scene: ${scene.title}
- Who: ${scene.who?.join(', ') || 'unspecified'}
- What: ${scene.what || 'unspecified'}
- When: ${scene.when || 'unspecified'}
- Where: ${scene.where || 'unspecified'}
- Why/Mood: ${scene.why || 'unspecified'}
` : ''

    const fullPrompt = `Cinematic frame for a music video. ${sceneContext} Visual Style: ${globalStyle || 'cinematic, high quality'}. Frame: ${prompt}. 16:9 aspect ratio, cinematic composition, rich detail and lighting.`

    // Use Imagen 4.0 API (predict endpoint)
    if (imageModel.startsWith('imagen')) {
      console.log('[generate-frame] Using Imagen API')

      // Imagen requires models/ prefix in path
      const modelPath = imageModel.startsWith('models/') ? imageModel : `models/${imageModel}`
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:predict?key=${GEMINI_API_KEY}`
      console.log('[generate-frame] Imagen URL:', url)

      const requestBody = {
        instances: [{ prompt: fullPrompt }],
        parameters: {
          outputMimeType: 'image/jpeg',
          sampleCount: 1,
          personGeneration: 'ALLOW_ADULT',
          aspectRatio: '16:9',
        },
      }
      console.log('[generate-frame] Imagen request:', JSON.stringify(requestBody).substring(0, 300))

      const response = await fetch(url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      )

      const responseText = await response.text()
      console.log('[generate-frame] Imagen response status:', response.status)
      console.log('[generate-frame] Imagen raw response length:', responseText.length)
      console.log('[generate-frame] Imagen raw response (first 1000):', responseText.substring(0, 1000))

      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(responseText)
        console.log('[generate-frame] Imagen parsed keys:', Object.keys(data))
      } catch (e) {
        console.log('[generate-frame] Failed to parse JSON:', e)
      }

      if (!response.ok) {
        console.error('[generate-frame] Imagen API error:', data)
        throw new Error(data.error?.message || 'Imagen API failed')
      }

      // Try different response structures
      const base64Data = data.predictions?.[0]?.bytesBase64Encoded
        || data.predictions?.[0]?.image?.bytesBase64Encoded
        || data.images?.[0]?.bytesBase64Encoded
      if (base64Data) {
        const imageData = `data:image/jpeg;base64,${base64Data}`
        console.log('[generate-frame] Image generated successfully with Imagen')
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
            model: imageModel,
          },
        })
      }

      throw new Error('No image in Imagen response')
    }

    // Use Gemini API for other models
    console.log('[generate-frame] Using Gemini API')
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    const response = await ai.models.generateContent({
      model: imageModel,
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
              model: imageModel,
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
