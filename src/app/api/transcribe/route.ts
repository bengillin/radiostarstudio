import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = audioFile.type || 'audio/mpeg'

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

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
              text: `Transcribe this audio with precise word-level timestamps.

For each segment of the song (verse, chorus, bridge, etc.), provide:
1. The segment type (verse, chorus, bridge, intro, outro, instrumental, spoken)
2. Start and end times in seconds
3. The full text of the segment
4. Word-level timing for each word

Return JSON in this exact format:
{
  "segments": [
    {
      "id": "unique-id",
      "type": "verse",
      "text": "full segment text here",
      "start": 0.0,
      "end": 15.5,
      "words": [
        {"text": "word1", "start": 0.0, "end": 0.5, "confidence": 0.95},
        {"text": "word2", "start": 0.6, "end": 1.0, "confidence": 0.92}
      ]
    }
  ],
  "duration": 180.5
}

Be precise with timing. If you can't determine exact word timing, estimate based on syllables and tempo.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    const text = response.text || '{}'

    // Parse and validate the response
    let result
    try {
      result = JSON.parse(text)
    } catch {
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
