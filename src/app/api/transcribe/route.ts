import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  console.log('[transcribe] API called')

  if (!GEMINI_API_KEY) {
    console.log('[transcribe] ERROR: No API key configured')
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  console.log('[transcribe] API key present:', GEMINI_API_KEY.substring(0, 8) + '...')

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      console.log('[transcribe] ERROR: No audio file in request')
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    console.log('[transcribe] Got audio file:', audioFile.name, 'size:', audioFile.size, 'type:', audioFile.type)

    // Convert file to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = audioFile.type || 'audio/mpeg'

    console.log('[transcribe] Converted to base64, length:', base64Audio.length)

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    console.log('[transcribe] Calling Gemini API...')

    // Use Gemini to transcribe with word-level timestamps
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: `Transcribe this audio and identify song sections.

For each section (verse, chorus, bridge, intro, outro, instrumental), provide:
- Section type
- Start and end time in seconds
- The lyrics/text for that section

Return ONLY valid JSON in this format (no markdown, no extra text):
{"segments":[{"id":"1","type":"verse","text":"lyrics here","start":0,"end":30,"words":[]}],"duration":180}

Keep it concise. Skip word-level timing (leave words array empty). Focus on accurate section boundaries.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    console.log('[transcribe] Gemini response received')
    const text = response.text || '{}'
    console.log('[transcribe] Response text length:', text.length)

    // Parse and validate the response
    let result
    try {
      result = JSON.parse(text)
      console.log('[transcribe] Parsed JSON, segments:', result.segments?.length)
    } catch (parseError) {
      console.log('[transcribe] JSON parse failed:', parseError)
      console.log('[transcribe] Raw text (first 500 chars):', text.substring(0, 500))
      console.log('[transcribe] Raw text (last 500 chars):', text.substring(text.length - 500))
      // If JSON parsing fails, return a basic structure
      result = {
        segments: [
          {
            id: crypto.randomUUID(),
            type: 'verse',
            text: 'Transcription unavailable',
            start: 0,
            end: 10,
            words: [],
          },
        ],
        duration: 0,
      }
    }

    // Ensure all segments have IDs
    if (result.segments) {
      result.segments = result.segments.map((seg: { id?: string }) => ({
        ...seg,
        id: seg.id || crypto.randomUUID(),
      }))
    }

    console.log('[transcribe] Success, returning result')
    return NextResponse.json(result)
  } catch (error) {
    console.error('[transcribe] ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: errorMessage },
      { status: 500 }
    )
  }
}
