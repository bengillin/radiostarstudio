import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const CATEGORY_FRAMING: Record<string, string> = {
  who: 'Character portrait, medium shot,',
  what: 'Dynamic action shot,',
  when: 'Atmospheric establishing shot showing the time period,',
  where: 'Wide establishing shot of the location,',
  why: 'Abstract mood board image capturing the emotion,',
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { name, description, category, globalStyle, model } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'No element name provided' }, { status: 400 })
    }

    const imageModel = model || 'imagen-4.0-generate-001'
    const framing = CATEGORY_FRAMING[category] || 'Cinematic shot of'
    const fullPrompt = `${framing} "${name}". ${description || ''}. ${globalStyle ? `Visual style: ${globalStyle}.` : ''} High quality, cinematic lighting, rich detail. Music video reference image.`

    if (imageModel.startsWith('imagen')) {
      const modelPath = imageModel.startsWith('models/') ? imageModel : `models/${imageModel}`
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:predict?key=${GEMINI_API_KEY}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: fullPrompt }],
          parameters: {
            outputMimeType: 'image/jpeg',
            sampleCount: 1,
            personGeneration: 'ALLOW_ADULT',
            aspectRatio: '1:1',
          },
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Imagen API failed')

      const predictions = data.predictions || []
      const base64Data = predictions[0]?.bytesBase64Encoded || predictions[0]?.image?.bytesBase64Encoded
      if (!base64Data) throw new Error('No image in Imagen response')

      return NextResponse.json({
        success: true,
        image: {
          url: `data:image/jpeg;base64,${base64Data}`,
          source: 'generated',
        },
      })
    }

    // Gemini model
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: ['image', 'text'],
        imageConfig: { aspectRatio: '1:1' },
      },
    })

    const parts = response.candidates?.[0]?.content?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          return NextResponse.json({
            success: true,
            image: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              source: 'generated',
            },
          })
        }
      }
    }

    return NextResponse.json({ error: 'No image generated' }, { status: 500 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Failed to generate image', details: msg }, { status: 500 })
  }
}
