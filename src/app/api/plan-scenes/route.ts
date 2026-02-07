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

Break this song into 3-6 visual scenes. First, define the recurring WORLD ELEMENTS — the characters, locations, time periods, actions, and moods that appear across the video. Then reference these elements in each scene.

For world elements, define:
- WHO elements: Characters/subjects (give each a name and detailed visual description)
- WHAT elements: Recurring actions or events
- WHEN elements: Time periods or moments
- WHERE elements: Locations/settings (describe in visual detail)
- WHY elements: Emotional themes or moods

Return ONLY valid JSON (no markdown):
{
  "globalStyle": "overall visual aesthetic description",
  "suggestedElements": [
    {
      "id": "elem-1",
      "category": "who",
      "name": "Lead Singer",
      "description": "A charismatic woman in her late 20s with short silver hair, wearing a leather jacket and vintage sunglasses"
    },
    {
      "id": "elem-2",
      "category": "where",
      "name": "Neon City",
      "description": "Rain-soaked cyberpunk cityscape at night with holographic billboards and neon reflections on wet pavement"
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "title": "Scene Title",
      "description": "Brief description of the scene",
      "startTime": 0,
      "endTime": 30,
      "elementRefs": [
        { "elementId": "elem-1" },
        { "elementId": "elem-2" }
      ],
      "who": ["Lead Singer"],
      "what": "Character walks through city",
      "when": "Night time, present day",
      "where": "Neon-lit urban street",
      "why": "Feeling of isolation in a crowd"
    }
  ]
}

Provide detailed visual descriptions for each element so they can be used as generation prompts. Keep the legacy who/what/when/where/why fields on scenes as well. Keep scenes aligned with the transcript segments.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    console.log('[plan-scenes] Gemini response received')
    let text = response.text || '{}'
    console.log('[plan-scenes] Response length:', text.length)

    let result
    try {
      // Try to parse directly first
      result = JSON.parse(text)
      console.log('[plan-scenes] Parsed JSON, scenes:', result.scenes?.length)
    } catch (parseError) {
      console.log('[plan-scenes] Initial JSON parse failed, attempting cleanup...')

      // Try to extract JSON from the response (strip markdown code blocks if present)
      let cleaned = text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()

      // Try to find and fix common JSON issues
      // Sometimes the response gets truncated or has trailing issues
      try {
        result = JSON.parse(cleaned)
        console.log('[plan-scenes] Cleaned JSON parsed successfully')
      } catch (e2) {
        // Try to find the last complete scene and truncate there
        const lastSceneEnd = cleaned.lastIndexOf('}')
        if (lastSceneEnd > 0) {
          // Find matching structure
          let depth = 0
          let foundEnd = -1
          for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === '{') depth++
            if (cleaned[i] === '}') {
              depth--
              if (depth === 0) foundEnd = i
            }
          }
          if (foundEnd > 0) {
            cleaned = cleaned.substring(0, foundEnd + 1)
            try {
              result = JSON.parse(cleaned)
              console.log('[plan-scenes] Truncated JSON parsed successfully')
            } catch (e3) {
              // Final fallback: return a minimal valid response
              console.log('[plan-scenes] All parse attempts failed, using fallback')
              console.log('[plan-scenes] Raw text (first 500):', text.substring(0, 500))
              result = {
                globalStyle: 'Cinematic, moody, atmospheric',
                scenes: [{
                  id: 'scene-1',
                  title: 'Full Song',
                  description: 'Main visual sequence for the entire song',
                  startTime: 0,
                  endTime: duration || 180,
                  who: ['Main subject'],
                  what: 'Performance and narrative',
                  when: 'Present day',
                  where: 'Various locations',
                  why: 'Express the song emotion'
                }]
              }
            }
          }
        }

        if (!result) {
          console.log('[plan-scenes] JSON parse failed completely:', parseError)
          console.log('[plan-scenes] Raw text (first 500):', text.substring(0, 500))
          return NextResponse.json(
            { error: 'Failed to parse scene planning response', details: 'AI returned invalid JSON' },
            { status: 500 }
          )
        }
      }
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
