import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  console.log('[plan-scenes] API called')

  if (!GEMINI_API_KEY) {
    console.log('[plan-scenes] ERROR: No API key configured')
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { transcript, style, duration } = body

    if (!transcript || transcript.length === 0) {
      console.log('[plan-scenes] ERROR: No transcript provided')
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      )
    }

    console.log('[plan-scenes] Got transcript with', transcript.length, 'segments')
    console.log('[plan-scenes] Style:', style || '(none provided)')

    // Format transcript for the prompt
    const transcriptText = transcript
      .map((seg: { type: string; text: string; start: number; end: number }) =>
        `[${seg.type}] ${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s: ${seg.text}`
      )
      .join('\n')

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    console.log('[plan-scenes] Calling Gemini API...')

    const styleInstruction = style
      ? `Use this visual style throughout: "${style}"`
      : 'Suggest a cohesive visual style that fits the song mood.'

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts: [
            {
              text: `You are a music video director planning scenes for a song.

TRANSCRIPT:
${transcriptText}

TOTAL DURATION: ${duration || 180} seconds

${styleInstruction}

Break this song into 3-6 visual scenes. For each scene, define the 5 Ws:
- WHO: Characters/subjects appearing
- WHAT: The action or event happening
- WHEN: Time period or moment (e.g., "sunset", "1980s", "dream sequence")
- WHERE: Location/setting
- WHY: Emotional motivation or mood

Return ONLY valid JSON (no markdown):
{
  "globalStyle": "overall visual aesthetic description",
  "scenes": [
    {
      "id": "scene-1",
      "title": "Scene Title",
      "description": "Brief description of the scene",
      "startTime": 0,
      "endTime": 30,
      "who": ["main character", "crowd"],
      "what": "Character walks through city",
      "when": "Night time, present day",
      "where": "Neon-lit urban street",
      "why": "Feeling of isolation in a crowd"
    }
  ]
}

Keep scenes aligned with the transcript segments. Each scene should cover one or more segments.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    console.log('[plan-scenes] Gemini response received')
    const text = response.text || '{}'
    console.log('[plan-scenes] Response length:', text.length)

    let result
    try {
      result = JSON.parse(text)
      console.log('[plan-scenes] Parsed JSON, scenes:', result.scenes?.length)
    } catch (parseError) {
      console.log('[plan-scenes] JSON parse failed:', parseError)
      console.log('[plan-scenes] Raw text (first 500):', text.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse scene planning response' },
        { status: 500 }
      )
    }

    // Ensure all scenes have IDs
    if (result.scenes) {
      result.scenes = result.scenes.map((scene: { id?: string }, index: number) => ({
        ...scene,
        id: scene.id || `scene-${index + 1}`,
      }))
    }

    console.log('[plan-scenes] Success, returning result')
    return NextResponse.json(result)
  } catch (error) {
    console.error('[plan-scenes] ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to plan scenes', details: errorMessage },
      { status: 500 }
    )
  }
}
