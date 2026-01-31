import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { ParodyRequest, ParodySong, StoryboardScene, VisualAsset } from "../types";

// Use Flash for quick search tasks
const SEARCH_MODEL = "gemini-2.5-flash";
// Use Pro for complex creative writing and constraint satisfaction
const WRITING_MODEL = "gemini-3-pro-preview";
// Use Pro Image for high fidelity multimodal generation
const IMAGE_MODEL = "gemini-3-pro-image-preview";
// Use Flash TTS for audio generation
const AUDIO_MODEL = "gemini-2.5-flash-preview-tts";
// Use Veo Fast for video generation
const VIDEO_MODEL = "veo-3.1-fast-generate-preview";

// Helper to fetch lyrics using Google Search if user didn't provide them
const fetchLyrics = async (artist: string, title: string, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    // Use WRITING_MODEL (Pro) instead of Flash for better adherence to "complete" instructions 
    // and to avoid truncation common with smaller context windows or summarization tendencies.
    const response = await ai.models.generateContent({
      model: WRITING_MODEL,
      contents: `Find the complete, unabridged lyrics for the song "${title}" by "${artist}". 
      
      CRITICAL INSTRUCTIONS:
      1. Retrieve the FULL song text. Do not summarize. Do not truncate.
      2. Include every Verse, Chorus, Bridge, Intro, and Outro.
      3. Preserve the section headers (e.g. [Verse 1], [Chorus]).
      4. Return ONLY the lyrics text. Do not add intro/outro conversational text.`,
      config: {
        tools: [{ googleSearch: {} }],
        // responseSchema is NOT allowed with googleSearch
      }
    });
    
    return response.text || "";
  } catch (error) {
    console.warn("Failed to fetch lyrics automatically:", error);
    return "";
  }
};

export const generateParodyLyrics = async (
  request: ParodyRequest,
  onStatusUpdate?: (status: string) => void
): Promise<ParodySong> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  // Step 1: Resolve Lyrics
  let lyricsToProcess = request.lyrics;
  
  if (!lyricsToProcess || lyricsToProcess.trim() === "") {
    if (onStatusUpdate) onStatusUpdate(`Searching for lyrics for "${request.originalTitle}"...`);
    lyricsToProcess = await fetchLyrics(request.originalArtist, request.originalTitle, process.env.API_KEY);
  }

  const lyricPromptContext = (lyricsToProcess && lyricsToProcess.trim() !== "")
    ? `Original Lyrics to Rewrite:\n${lyricsToProcess}`
    : `I do not have the lyrics. Please recall the lyrics for "${request.originalTitle}" by "${request.originalArtist}" exactly from your knowledge base and use those as the Original Lyrics.`;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  if (onStatusUpdate) onStatusUpdate("Analyzing syllable structure and writing...");

  // Select System Instruction based on Mode
  let systemInstruction = "";
  let prompt = "";

  if (request.mode === 'phonetic') {
    systemInstruction = `
      You are a linguistic expert in alternate orthography and phonetic spelling.
      Your task is to rewrite the input lyrics line-by-line using "Phonetic/Cursed" spelling rules.
      
      RULES:
      1. **Profanity:** Misspell ALL curse words so they evade strict text filters but sound identical (e.g., "f*ck" -> "phuck", "sh*t" -> "sheit", "bitch" -> "bytch").
      2. **Silent Letters:** Add silent letters randomly where they don't affect pronunciation (e.g., "dog" -> "dogg", "bad" -> "badd", "time" -> "tyme", "ghost" -> "ghoast").
      3. **Alternate Spellings:** Use informal or archaic spellings if pronunciation is preserved (e.g., "light" -> "lite", "you" -> "u", "love" -> "luv", "are" -> "arr").
      4. **NO WORD CHANGES:** You must NOT change the actual words spoken or their meaning. Only the spelling changes.
      5. **Syllables:** Count must remain EXACTLY the same.
      6. **Structure:** Preserve all headers (e.g. [Chorus]).
    `;

    prompt = `
      Original Artist: ${request.originalArtist}
      Original Title: ${request.originalTitle}
      Mode: Phonetic Rewrite
      
      ${lyricPromptContext}
    `;

  } else {
    // Parody Mode
    systemInstruction = `
      You are a world-class parody songwriter and linguistic expert (comparable to "Weird Al" Yankovic). 
      Your goal is to rewrite existing song lyrics into a parody based on a specific topic.
      
      CRITICAL CRITERIA FOR SUCCESS:
      1. **Structure Preservation:** If the input lyrics contain section headers (e.g., [Verse 1], [Chorus], [Bridge]), you MUST preserve them as separate lines and set 'isSectionHeader' to true.
      2. **Strict Syllable Matching:** The parody line MUST have the exact same number of syllables as the original line. This is crucial for the song to be singable.
      3. **Rhyme Scheme Preservation:** If Original Line A rhymes with Original Line B, Parody Line A MUST rhyme with Parody Line B.
      4. **Cadence & Stress:** Match the natural stress patterns of the words so the flow remains identical.
      5. **Formatting:** Break the song down line-by-line.
      6. **Tone:** Adapt the tone based on the user's request (e.g., funny, dark, educational).
      7. **Music Generation Tags:** Generate a list of 3-5 style tags that would describe this song if fed into an AI music generator (e.g., "Upbeat", "90s Rock", "Male Vocals").
      
      For Section Headers (e.g., "[Chorus]"):
      - Set 'isSectionHeader' to true.
      - Keep the 'parody' text similar to the original header or give it a thematic twist (e.g., "[The Sad Chorus]").
      - Set 'syllableDiff' to 0.
      
      Do not be lazy. Do not approximate. The output must be perfectly singable over the original instrumental.
    `;

    prompt = `
      Original Artist: ${request.originalArtist}
      Original Title: ${request.originalTitle}
      
      Topic for Parody: ${request.topic}
      Desired Mood: ${request.mood}
      
      ${lyricPromptContext}
    `;
  }

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      originalTitle: { type: Type.STRING, description: "The original song title" },
      parodyTitle: { type: Type.STRING, description: "A creative title for the parody version" },
      summary: { type: Type.STRING, description: "A one-sentence summary of what this version is about" },
      tags: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Musical style tags for AI generation (e.g. 'Slow Ballad', 'Synthpop')" 
      },
      lines: {
        type: Type.ARRAY,
        description: "The song processed line-by-line, including section headers",
        items: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING, description: "The original lyric line or section header" },
            parody: { type: Type.STRING, description: "The newly written parody line or section header" },
            syllableDiff: { type: Type.INTEGER, description: "Difference in syllable count (0 is perfect)" },
            rhymeScheme: { type: Type.STRING, description: "The rhyme label (A, B, C, etc.) used for this line" },
            isSectionHeader: { type: Type.BOOLEAN, description: "True if this line is a section marker like [Verse] or [Chorus]" }
          },
          required: ["original", "parody", "syllableDiff", "rhymeScheme", "isSectionHeader"]
        }
      }
    },
    required: ["originalTitle", "parodyTitle", "lines", "summary"]
  };

  try {
    const response = await ai.models.generateContent({
      model: WRITING_MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 1024 } 
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response generated.");
    }

    if (onStatusUpdate) onStatusUpdate("Finalizing formatting...");
    const data = JSON.parse(text);
    
    // Enrich with client-side metadata
    const completeSong: ParodySong = {
        ...data,
        id: crypto.randomUUID(),
        groupId: request.groupId || crypto.randomUUID(),
        createdAt: Date.now(),
        originalArtist: request.originalArtist
    };
    
    return completeSong;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

interface StoryboardResponse {
  globalVisualStyle: string;
  scenes: {
    startLineIndex: number;
    endLineIndex: number;
    description: string;
    clips: {
      lineIndex: number;
      imagePrompt: string;
    }[]
  }[];
}

export const generateStoryboardMetadata = async (song: ParodySong): Promise<{ scenes: StoryboardScene[], globalStyle: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Filter out section headers for the prompt to keep context clear, but we need strict indexing
  const lyricsText = song.lines.map((l, i) => `Line ${i}: ${l.parody} ${l.isSectionHeader ? '[HEADER]' : ''}`).join('\n');

  // If a style is already defined, force the model to respect it.
  const existingStyleInstruction = song.globalVisualStyle 
    ? `The Global Visual Style is PRE-DEFINED as: "${song.globalVisualStyle}". You MUST use this style for all scene descriptions.`
    : `1. **Global Visual Style:** Define a consistent art style for the entire video (e.g., "Pixar-style animation", "Gritty 80s Cyberpunk", "Oil Painting").`;

  const systemInstruction = `
    You are a professional music video director.
    Your task is to plan a music video for a parody song.
    
    ${existingStyleInstruction}
    2. **Scenes:** Break the lyrics into logical groups (Scenes).
    3. **Clips:** For EVERY line in the lyrics (including headers if they need a title card, otherwise skip headers), create a specific image prompt.
    
    The clip prompt should be a visual description of action occurring during that specific line, consistent with the scene description.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      globalVisualStyle: { type: Type.STRING, description: "The overall art style for the entire video." },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startLineIndex: { type: Type.INTEGER },
            endLineIndex: { type: Type.INTEGER },
            description: { type: Type.STRING, description: "Director's notes on the scene action" },
            clips: {
              type: Type.ARRAY,
              description: "Individual visual cues for each line in this scene",
              items: {
                type: Type.OBJECT,
                properties: {
                  lineIndex: { type: Type.INTEGER },
                  imagePrompt: { type: Type.STRING, description: "Specific visual action for this line." }
                },
                required: ["lineIndex", "imagePrompt"]
              }
            }
          },
          required: ["startLineIndex", "endLineIndex", "description", "clips"]
        }
      }
    },
    required: ["globalVisualStyle", "scenes"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Title: ${song.parodyTitle}\nSummary: ${song.summary}\n\nLyrics with Indices:\n${lyricsText}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const rawData = JSON.parse(response.text || "{}") as StoryboardResponse;
  
  const scenes: StoryboardScene[] = (rawData.scenes || []).map((s) => ({
    id: crypto.randomUUID(),
    startLineIndex: s.startLineIndex,
    endLineIndex: s.endLineIndex,
    description: s.description,
    clips: s.clips.map(c => ({
      id: crypto.randomUUID(),
      lineIndex: c.lineIndex,
      lyric: song.lines[c.lineIndex]?.parody || "",
      imagePrompt: c.imagePrompt,
      isLoading: false,
      isVideoLoading: false,
      activeAssetIds: []
    }))
  }));

  // If we had an existing style, prefer it, otherwise accept the one the model just generated
  const finalStyle = song.globalVisualStyle || rawData.globalVisualStyle || "Cinematic";

  return { 
    scenes, 
    globalStyle: finalStyle
  };
};

export const extractAssetsFromLyrics = async (song: ParodySong): Promise<{ assets: VisualAsset[], globalStyle: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const lyricsText = song.lines.map(l => l.parody).join('\n');

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      globalVisualStyle: { type: Type.STRING, description: "A cohesive art style description for the music video (e.g. '90s Cartoon', 'Cyberpunk', 'Claymation')" },
      assets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the entity, e.g., 'Pizza Guy'" },
            type: { type: Type.STRING, enum: ["character", "location", "object"] },
            description: { type: Type.STRING, description: "Physical visual description" }
          },
          required: ["name", "type", "description"]
        }
      }
    },
    required: ["globalVisualStyle", "assets"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze these lyrics. Define a Global Visual Style for the music video, and identify the main recurring visual assets (Cast, Locations, Items).\n\nLyrics:\n${lyricsText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const data = JSON.parse(response.text || "{}");
  const assets = (data.assets || []).map((a: any) => ({
    ...a,
    id: crypto.randomUUID(),
    variants: [],
    isGenerated: true
  }));

  return {
    assets,
    globalStyle: data.globalVisualStyle || "Cinematic"
  };
};

export const enhanceDescription = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Rewrite this brief visual art style description into a high-quality, detailed AI image generation prompt. Keep it under 40 words. Description: "${text}"`,
  });

  return response.text?.trim() || text;
};

export const generateSceneImage = async (
  prompt: string, 
  referenceAssets: VisualAsset[] = []
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Construct the multimodal payload
  const parts: any[] = [];

  // 1. Add Reference Images
  if (referenceAssets.length > 0) {
    for (const asset of referenceAssets) {
      // Look for the first variant, or support a specific one if passed
      // For now, use the first variant as the "Identity" anchor
      if (asset.variants && asset.variants.length > 0) {
        const primaryVariant = asset.variants[0];
        
        if (primaryVariant.imageUrl) {
          // Strip data prefix if present for clean base64
          const base64Data = primaryVariant.imageUrl.split(',')[1] || primaryVariant.imageUrl;
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: "image/png" 
            }
          });
          // Add text context for what this image represents
          parts.push({
            text: `Reference image for character/object: ${asset.name} (${asset.description}). Maintain strict consistency with this reference.`
          });
        }
      }
    }
  }

  // 2. Add the main prompt
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL, // MUST use Pro Image for multimodal inputs
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9", 
        }
      }
    });

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data found in response");
  } catch (e) {
    console.error("Image generation failed", e);
    throw e;
  }
};

export const generateVideoFromImage = async (
  prompt: string,
  imageBase64DataURI: string
): Promise<string> => {
    // Parsing data URI
    const match = imageBase64DataURI.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URI");
    const mimeType = match[1];
    const imageBytes = match[2];

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Validate prompt
    const effectivePrompt = prompt && prompt.trim().length > 0 ? prompt : "A cinematic video scene";

    console.log("Starting video generation...", { prompt: effectivePrompt, mimeType });

    let operation = await ai.models.generateVideos({
        model: VIDEO_MODEL,
        prompt: effectivePrompt,
        image: {
            imageBytes: imageBytes,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });

    // Polling
    console.log("Polling for video...");
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Increased to 10s
        operation = await ai.operations.getVideosOperation({operation: operation});
    }

    if (operation.error) {
        console.error("Video Generation Error:", operation.error);
        const errorMsg = operation.error.message ? String(operation.error.message) : "Unknown error";
        throw new Error(errorMsg);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri as string | undefined;
    if (!downloadLink) {
        console.error("Operation response missing video URI:", JSON.stringify(operation, null, 2));
        throw new Error("No video URI returned from the API. The prompt may have been blocked or the service is busy.");
    }

    // Fetch video
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) throw new Error("Failed to download video");
    
    const blob = await response.blob();
    
    // Convert to Base64 string for storage
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


export const generateSpeech = async (text: string): Promise<AudioBuffer> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
        model: AUDIO_MODEL,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio returned");

    // Decode (Browser native decoding of pure PCM is tricky without headers, 
    // but the API often returns WAV-container or we interpret raw. 
    // The provided instruction example for TTS uses window.AudioContext decodeAudioData
    // which expects a file structure OR we decode raw if we know it. 
    // The Gemini 2.5 TTS output usually needs standard decoding)
    
    const binaryString = atob(base64Audio as string);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    return await audioContext.decodeAudioData(bytes.buffer);
};