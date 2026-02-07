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
    const { prompt, clipId, type, scene, globalStyle, model, elements, referenceImages, count, aspectRatio } = body
    const frameCount = Math.min(Math.max(count || 1, 1), 4)

    if (!prompt) {
      return NextResponse.json(
        { error: 'No prompt provided' },
        { status: 400 }
      )
    }

    const imageModel = model || 'imagen-4.0-generate-001'
    console.log('[generate-frame] Generating frame for clip:', clipId, 'type:', type, 'model:', imageModel, 'count:', frameCount)
    console.log('[generate-frame] Prompt:', prompt.substring(0, 100) + '...')

    // Build scene context from elements (preferred) or legacy fields
    let sceneContext = ''
    if (elements && elements.length > 0) {
      sceneContext = `Scene: ${scene?.title || 'Untitled'}\n` +
        elements.map((e: { category: string; name: string; description: string }) =>
          `- ${e.category.toUpperCase()}: ${e.name}${e.description ? ` - ${e.description}` : ''}`
        ).join('\n')
    } else if (scene) {
      sceneContext = `Scene: ${scene.title}
- Who: ${scene.who?.join(', ') || 'unspecified'}
- What: ${scene.what || 'unspecified'}
- When: ${scene.when || 'unspecified'}
- Where: ${scene.where || 'unspecified'}
- Why/Mood: ${scene.why || 'unspecified'}`
    }

    const resolvedAspect = aspectRatio || '16:9'
    const fullPrompt = `Cinematic frame for a music video. ${sceneContext} Visual Style: ${globalStyle || 'cinematic, high quality'}. Frame: ${prompt}. ${resolvedAspect} aspect ratio, cinematic composition, rich detail and lighting.`

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
          sampleCount: frameCount,
          personGeneration: 'ALLOW_ADULT',
          aspectRatio: resolvedAspect,
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {}
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

      // Parse all predictions into frames
      const predictions = data.predictions || data.images || []
      const generatedFrames = []
      const now = Date.now()

      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i]
        const base64Data = pred?.bytesBase64Encoded || pred?.image?.bytesBase64Encoded
        if (base64Data) {
          generatedFrames.push({
            id: `frame-${clipId}-${type}-${now}-${i}`,
            clipId,
            type,
            source: 'generated',
            url: `data:image/jpeg;base64,${base64Data}`,
            prompt,
            generatedAt: new Date().toISOString(),
            model: imageModel,
          })
        }
      }

      if (generatedFrames.length > 0) {
        console.log(`[generate-frame] ${generatedFrames.length} image(s) generated with Imagen`)
        return NextResponse.json({
          success: true,
          frame: generatedFrames[0], // backward compat
          frames: generatedFrames,
        })
      }

      throw new Error('No image in Imagen response')
    }

    // Use Gemini API for other models
    console.log('[generate-frame] Using Gemini API')
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    // Build content parts with reference images for visual consistency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [{ text: fullPrompt }]

    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        if (ref.imageData) {
          // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
          const match = ref.imageData.match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            contentParts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            })
            contentParts.push({ text: `Reference image for "${ref.description}" — maintain visual consistency with this reference.` })
          }
        }
      }
    }

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [{ parts: contentParts }],
      config: {
        responseModalities: ['image', 'text'],
        imageConfig: {
          aspectRatio: resolvedAspect,
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
