import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const CATEGORY_GUIDANCE: Record<string, string> = {
  who: 'Describe their appearance, clothing, body language, age, and defining visual traits. Focus on what a camera would capture.',
  what: 'Describe the action, movement, and visual dynamics. Focus on what is physically happening on screen.',
  when: 'Describe the time of day, season, era, and how it affects lighting, color temperature, and atmosphere.',
  where: 'Describe the location, environment, architecture, and spatial depth. Include foreground, middle ground, and background details.',
  why: 'Describe the emotional tone, mood, and atmosphere. How should this feel visually? Include color palette and lighting mood.',
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { name, category, globalStyle } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'No element name provided' }, { status: 400 })
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    const categoryHint = CATEGORY_GUIDANCE[category] || 'Describe this element in vivid visual detail.'

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a music video art director. Generate a detailed visual description for a world-building element.

Element name: "${name}"
Category: ${category || 'general'}
${globalStyle ? `Overall visual style: ${globalStyle}` : ''}

${categoryHint}

Write 2-3 sentences of vivid, specific visual description that could guide AI image generation. Be concrete and visual, not abstract. Respond with ONLY the description, no preamble or labels.`,
    })

    const description = response.text?.trim() || ''
    return NextResponse.json({ success: true, description })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Failed to suggest description', details: msg }, { status: 500 })
  }
}
