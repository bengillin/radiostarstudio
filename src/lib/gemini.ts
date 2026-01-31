import { GoogleGenAI } from '@google/genai'

// Model selection
const MODELS = {
  flash: 'gemini-2.0-flash',
  pro: 'gemini-2.0-pro',
  image: 'gemini-2.0-flash-exp', // For image generation
  video: 'veo-2.0-generate-001',
} as const

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return new GoogleGenAI({ apiKey })
}

// Transcribe audio to text with word-level timestamps
export async function transcribeAudio(audioUrl: string): Promise<{
  text: string
  segments: Array<{
    text: string
    start: number
    end: number
    words: Array<{ text: string; start: number; end: number; confidence: number }>
  }>
}> {
  const ai = getClient()

  // For now, use Gemini to analyze audio
  // In production, you might use Whisper via fal.ai or another service
  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: `Analyze this audio and provide a transcript with timestamps.
    Return JSON with this structure:
    {
      "text": "full transcript",
      "segments": [
        {
          "text": "segment text",
          "start": 0.0,
          "end": 2.5,
          "words": [{"text": "word", "start": 0.0, "end": 0.5, "confidence": 0.95}]
        }
      ]
    }`,
  })

  const text = response.text || '{}'
  return JSON.parse(text)
}

// Plan scenes from transcript
export async function planScenes(
  transcript: string,
  style?: string
): Promise<{
  globalStyle: string
  scenes: Array<{
    title: string
    description: string
    startTime: number
    endTime: number
    who: string[]
    what: string
    when: string
    where: string
    why: string
  }>
}> {
  const ai = getClient()

  const styleInstruction = style
    ? `Use this visual style: "${style}"`
    : 'Suggest an appropriate visual style for this content.'

  const response = await ai.models.generateContent({
    model: MODELS.pro,
    contents: `You are a music video director planning scenes for a song.

Transcript:
${transcript}

${styleInstruction}

Break this into logical scenes. For each scene, provide:
- Title and description
- Time boundaries (start/end in seconds)
- The 5 Ws: Who (characters), What (action), When (time period), Where (location), Why (mood/motivation)

Return JSON:
{
  "globalStyle": "visual style description",
  "scenes": [
    {
      "title": "Scene Title",
      "description": "What happens in this scene",
      "startTime": 0,
      "endTime": 30,
      "who": ["character1", "character2"],
      "what": "Action description",
      "when": "Time period or moment",
      "where": "Location",
      "why": "Emotional motivation"
    }
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  })

  const text = response.text || '{}'
  return JSON.parse(text)
}

// Generate an image frame
export async function generateFrame(
  prompt: string,
  referenceImages?: string[]
): Promise<string> {
  const ai = getClient()

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = []

  // Add reference images if provided
  if (referenceImages && referenceImages.length > 0) {
    for (const img of referenceImages) {
      const base64 = img.split(',')[1] || img
      parts.push({
        inlineData: {
          data: base64,
          mimeType: 'image/png',
        },
      })
      parts.push({
        text: 'Reference image for visual consistency.',
      })
    }
  }

  parts.push({ text: prompt })

  const response = await ai.models.generateContent({
    model: MODELS.image,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: '16:9',
      },
    },
  })

  const responseParts = response.candidates?.[0]?.content?.parts
  if (responseParts) {
    for (const part of responseParts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
      }
    }
  }

  throw new Error('No image generated')
}

// Generate video from frames
export async function generateVideo(
  prompt: string,
  startFrameBase64: string,
  endFrameBase64?: string
): Promise<string> {
  const ai = getClient()

  const match = startFrameBase64.match(/^data:(.+);base64,(.+)$/)
  if (!match) throw new Error('Invalid image data URI')

  const mimeType = match[1]
  const imageBytes = match[2]

  let operation = await ai.models.generateVideos({
    model: MODELS.video,
    prompt,
    image: {
      imageBytes,
      mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9',
    },
  })

  // Poll for completion
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000))
    operation = await ai.operations.getVideosOperation({ operation })
  }

  if (operation.error) {
    const errorMessage = typeof operation.error === 'object' && operation.error !== null && 'message' in operation.error
      ? String(operation.error.message)
      : 'Video generation failed'
    throw new Error(errorMessage)
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri
  if (!videoUri) {
    throw new Error('No video URI returned')
  }

  // Fetch and convert to base64
  const response = await fetch(`${videoUri}&key=${process.env.GEMINI_API_KEY}`)
  if (!response.ok) throw new Error('Failed to download video')

  const blob = await response.blob()
  const buffer = await blob.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return `data:video/mp4;base64,${base64}`
}
