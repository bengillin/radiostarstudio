import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  console.log('[suggest-style] API called')

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { transcript } = body

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      )
    }

    console.log('[suggest-style] Analyzing transcript with', transcript.length, 'segments')

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    // Combine all transcript text
    const fullText = transcript.map((s: { text: string }) => s.text).join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a music video director. Analyze these lyrics/transcript and suggest a visual style for the music video.

Lyrics/Transcript:
${fullText}

Based on the mood, themes, imagery, and emotions in this content, suggest a visual style. Include:
- Overall aesthetic (e.g., cinematic, dreamy, gritty, neon-lit, vintage)
- Color palette suggestions
- Lighting style
- Camera movement tendencies
- Any specific visual references or inspirations

Respond with ONLY the style description, no preamble. Keep it to 2-3 sentences that could be used as a prompt for image/video generation.`,
    })

    const styleText = response.text?.trim() || ''
    console.log('[suggest-style] Generated style:', styleText.substring(0, 100))

    return NextResponse.json({
      success: true,
      style: styleText,
    })
  } catch (error) {
    console.error('[suggest-style] ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to suggest style', details: errorMessage },
      { status: 500 }
    )
  }
}
