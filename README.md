# Radiostar

AI-powered music video studio. Transform audio into fully visualized music videos with scene planning, frame generation, and timeline editing.

**radiostar.studio**

## Features

- Audio file ingestion with waveform analysis
- AI-powered scene and clip planning (who, what, when, where, why)
- Visual aesthetic definition (mood boards, color palettes)
- Start/end frame generation or upload
- Video clip generation with Veo
- Timeline editor for arranging and trimming clips
- Export to final video

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   ```
   npm run dev
   ```

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Google Gemini API (text, image, video generation)
