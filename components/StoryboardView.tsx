import React, { useState, useEffect } from 'react';
import { ParodySong, StoryboardScene, StoryboardClip, VisualAsset } from '../types';
import { generateStoryboardMetadata, generateSceneImage, extractAssetsFromLyrics, generateVideoFromImage } from '../services/geminiService';
import { Film, Image as ImageIcon, RefreshCw, Wand2, Loader2, Settings2, PlayCircle, Download, KeyRound, Video } from 'lucide-react';

interface StoryboardViewProps {
  song: ParodySong;
  onUpdateSong: (updatedSong: ParodySong) => void;
}

const StoryboardView: React.FC<StoryboardViewProps> = ({ song, onUpdateSong }) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [globalStyle, setGlobalStyle] = useState(song.globalVisualStyle || "");

  useEffect(() => {
    const init = async () => {
      if (!song.storyboard || song.storyboard.length === 0) {
        setIsInitializing(true);
        try {
          // Generate Storyboard
          // This also returns a style, but we might already have one from Assets or input
          const { scenes, globalStyle: aiStyle } = await generateStoryboardMetadata(song);
          
          // Fallback: Check if assets exist
          let assets = song.assets;
          if (!assets || assets.length === 0) {
            const result = await extractAssetsFromLyrics(song);
            assets = result.assets;
          }
          
          // Determine final style: prefer existing, then what storyboard gen returned
          const finalStyle = song.globalVisualStyle || aiStyle;
          
          setGlobalStyle(finalStyle);
          onUpdateSong({ 
            ...song, 
            globalVisualStyle: finalStyle,
            storyboard: scenes,
            assets: assets
          });
        } catch (e) {
          console.error("Failed to init storyboard", e);
        } finally {
          setIsInitializing(false);
        }
      } else if (song.globalVisualStyle && !globalStyle) {
        setGlobalStyle(song.globalVisualStyle);
      }
    };
    init();
  }, []);

  // Save global style when user stops typing
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (song.storyboard && globalStyle !== song.globalVisualStyle) {
        onUpdateSong({ ...song, globalVisualStyle: globalStyle });
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [globalStyle]);

  // --- API Key Helper ---
  const ensureApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }
  };

  const handleApiError = async (e: any) => {
    console.error("API Error caught:", e);
    const msg = e?.toString() || "";
    // Check for 403 or PERMISSION_DENIED
    if (msg.includes("403") || msg.includes("PERMISSION_DENIED") || msg.includes("permission")) {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        return "Please retry after selecting a valid API key.";
      }
    }
    return "Failed to generate media. Please try again.";
  };

  // --- Image Generation Logic ---

  const handleGenerateClipImage = async (sceneId: string, clipId: string, prompt: string, sceneStyle?: string) => {
    if (!song.storyboard) return;

    await ensureApiKey();

    // Find the clip to get active assets
    const scene = song.storyboard.find(s => s.id === sceneId);
    const clip = scene?.clips.find(c => c.id === clipId);
    const activeAssets = song.assets?.filter(a => clip?.activeAssetIds?.includes(a.id)) || [];

    // Set loading state
    const updatedScenes = song.storyboard.map(s => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        clips: s.clips.map(c => c.id === clipId ? { ...c, isLoading: true } : c)
      };
    });
    onUpdateSong({ ...song, storyboard: updatedScenes });

    try {
      // Construct full prompt
      const fullPrompt = `Art Style: ${sceneStyle || globalStyle}. \nScene Context: ${scene?.description || ''}. \nAction: ${prompt}`;
      
      // Pass assets to generation service
      const imageUrl = await generateSceneImage(fullPrompt, activeAssets);
      
      const finalScenes = song.storyboard.map(s => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          clips: s.clips.map(c => c.id === clipId ? { ...c, isLoading: false, imageUrl } : c)
        };
      });
      onUpdateSong({ ...song, storyboard: finalScenes });
    } catch (e) {
      // Revert loading
      const errorScenes = song.storyboard.map(s => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          clips: s.clips.map(c => c.id === clipId ? { ...c, isLoading: false } : c)
        };
      });
      onUpdateSong({ ...song, storyboard: errorScenes });
      
      const userMsg = await handleApiError(e);
      if (userMsg) alert(userMsg);
    }
  };

  const handleGenerateClipVideo = async (sceneId: string, clipId: string, prompt: string, imageUrl: string) => {
     if (!song.storyboard) return;
     await ensureApiKey();

     // Set loading state
    const updatedScenes = song.storyboard.map(s => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        clips: s.clips.map(c => c.id === clipId ? { ...c, isVideoLoading: true } : c)
      };
    });
    onUpdateSong({ ...song, storyboard: updatedScenes });

    try {
      // prompt for video is usually the action description
      const videoBase64 = await generateVideoFromImage(prompt, imageUrl);

      const finalScenes = song.storyboard.map(s => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          clips: s.clips.map(c => c.id === clipId ? { ...c, isVideoLoading: false, videoUrl: videoBase64 } : c)
        };
      });
      onUpdateSong({ ...song, storyboard: finalScenes });

    } catch (e) {
      const errorScenes = song.storyboard.map(s => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          clips: s.clips.map(c => c.id === clipId ? { ...c, isVideoLoading: false } : c)
        };
      });
      onUpdateSong({ ...song, storyboard: errorScenes });

      const userMsg = await handleApiError(e);
      if (userMsg) alert(userMsg);
    }
  };

  const handleGenerateScene = async (sceneId: string) => {
    const scene = song.storyboard?.find(s => s.id === sceneId);
    if (!scene) return;
    
    await ensureApiKey();

    // Generate for all clips without images
    const clipsToGen = scene.clips.filter(c => !c.imageUrl);
    
    for (const clip of clipsToGen) {
        await handleGenerateClipImage(sceneId, clip.id, clip.imagePrompt, scene.sceneStyle);
    }
  };

  const toggleAssetForClip = (sceneId: string, clipId: string, assetId: string) => {
    const updatedScenes = song.storyboard?.map(s => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        clips: s.clips.map(c => {
          if (c.id !== clipId) return c;
          const currentAssets = c.activeAssetIds || [];
          const newAssets = currentAssets.includes(assetId) 
            ? currentAssets.filter(id => id !== assetId)
            : [...currentAssets, assetId];
          return { ...c, activeAssetIds: newAssets };
        })
      };
    });
    onUpdateSong({ ...song, storyboard: updatedScenes });
  };

  // --- UI Helpers ---

  const updateClipPrompt = (sceneId: string, clipId: string, text: string) => {
    if (!song.storyboard) return;
    const updated = song.storyboard.map(s => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        clips: s.clips.map(c => c.id === clipId ? { ...c, imagePrompt: text } : c)
      };
    });
    onUpdateSong({ ...song, storyboard: updated });
  };

  const updateSceneStyle = (sceneId: string, style: string) => {
    if (!song.storyboard) return;
    const updated = song.storyboard.map(s => 
      s.id === sceneId ? { ...s, sceneStyle: style } : s
    );
    onUpdateSong({ ...song, storyboard: updated });
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-500" />
        <p>Designing global aesthetics, casting characters, and planning scenes...</p>
      </div>
    );
  }

  if (!song.storyboard) return null;

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6">
      
      {/* Global Style Controller - Sticky Header */}
      <div className="sticky top-20 z-30 bg-slate-900/90 backdrop-blur-lg border border-slate-700 p-4 rounded-xl shadow-2xl mb-8 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 text-brand-400 min-w-max">
          <Settings2 className="w-5 h-5" />
          <span className="font-bold uppercase tracking-wider text-sm">Global Visual Style</span>
        </div>
        <input 
          type="text"
          value={globalStyle}
          onChange={(e) => setGlobalStyle(e.target.value)}
          placeholder="e.g., Cyberpunk Anime, Neon Colors, High Contrast"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500 outline-none"
        />
         {/* API Key Status / Trigger */}
         <button 
           onClick={ensureApiKey}
           className="ml-auto text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
         >
           <KeyRound className="w-3 h-3" />
           API Key
         </button>
      </div>

      <div className="space-y-12">
        {song.storyboard.map((scene, index) => (
          <div key={scene.id} className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
            
            {/* Scene Header */}
            <div className="bg-slate-900 p-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-brand-500" /> Scene {index + 1}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">{scene.description}</p>
               </div>
               
               <div className="flex flex-col gap-2 w-full md:w-auto">
                 <input 
                   type="text"
                   placeholder="Override style (optional)"
                   value={scene.sceneStyle || ''}
                   onChange={(e) => updateSceneStyle(scene.id, e.target.value)}
                   className="bg-slate-950 border border-slate-800 text-xs px-3 py-1.5 rounded-lg text-slate-300 w-full"
                 />
                 <button 
                  onClick={() => handleGenerateScene(scene.id)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
                 >
                   <Wand2 className="w-3 h-3" /> Generate Missing Clips
                 </button>
               </div>
            </div>

            {/* Clips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 p-6">
               {scene.clips.map((clip) => (
                 <div key={clip.id} className="flex flex-col gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 hover:border-brand-500/20 transition-colors">
                    
                    {/* Lyric Header */}
                    <div className="min-h-[3rem] flex items-center justify-center text-center">
                       <p className="text-sm font-medium text-brand-50 italic">"{clip.lyric}"</p>
                    </div>

                    {/* Media Area */}
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative group border border-slate-800">
                       
                       {/* Video Player */}
                       {clip.videoUrl ? (
                          <div className="w-full h-full relative group/video">
                             <video 
                                src={clip.videoUrl} 
                                controls 
                                className="w-full h-full object-cover"
                             />
                             {/* Overlay for quick actions even if video exists? Maybe regenerate */}
                          </div>
                       ) : clip.imageUrl ? (
                         <>
                           <img src={clip.imageUrl} alt="Clip" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              {/* Generation Actions */}
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleGenerateClipImage(scene.id, clip.id, clip.imagePrompt, scene.sceneStyle)}
                                  className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-white backdrop-blur-sm flex items-center gap-2 text-xs font-bold"
                                  title="Regenerate Image"
                                >
                                  <RefreshCw className="w-4 h-4" /> Image
                                </button>
                                <button 
                                  onClick={() => handleGenerateClipVideo(scene.id, clip.id, clip.imagePrompt, clip.imageUrl!)}
                                  disabled={clip.isVideoLoading}
                                  className="bg-brand-600/80 hover:bg-brand-600 px-3 py-2 rounded-lg text-white backdrop-blur-sm flex items-center gap-2 text-xs font-bold transition-colors"
                                  title="Generate Video from this image"
                                >
                                  {clip.isVideoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                                  {clip.isVideoLoading ? 'Making...' : 'Animate'}
                                </button>
                              </div>
                              
                              <a 
                                href={clip.imageUrl} 
                                download={`parody-scene-${index+1}-clip-${clip.lineIndex}.png`}
                                className="absolute bottom-2 right-2 p-2 text-white/50 hover:text-white"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                           </div>
                         </>
                       ) : (
                         <div className="w-full h-full flex items-center justify-center">
                            {clip.isLoading ? (
                               <div className="flex flex-col items-center">
                                 <Loader2 className="w-6 h-6 animate-spin text-brand-500 mb-2" />
                                 <span className="text-xs text-slate-500">Generating with assets...</span>
                               </div>
                            ) : (
                               <button 
                                onClick={() => handleGenerateClipImage(scene.id, clip.id, clip.imagePrompt, scene.sceneStyle)}
                                className="flex flex-col items-center gap-2 text-slate-600 hover:text-brand-400 transition-colors"
                               >
                                 <PlayCircle className="w-8 h-8" />
                                 <span className="text-xs font-bold uppercase">Render</span>
                               </button>
                            )}
                         </div>
                       )}

                       {/* Overlays that apply to both Image and Video modes (if needed) or Loading Video Overlay */}
                       {clip.isVideoLoading && !clip.videoUrl && (
                           <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center">
                              <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
                              <span className="text-xs text-white font-bold">Generating Video...</span>
                              <span className="text-[10px] text-slate-400 mt-1">This may take a minute</span>
                           </div>
                       )}

                       <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded text-[10px] font-mono text-slate-400 border border-white/5 z-10 pointer-events-none">
                         Line {clip.lineIndex + 1}
                       </div>
                    </div>

                    {/* Asset Toggles (Selection Only) */}
                    <div className="flex flex-wrap gap-2 mb-1">
                      {song.assets && song.assets.length > 0 && (
                        <div className="w-full flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                           {song.assets.map(asset => {
                             // Use the first variant as the icon, or a placeholder if none exists
                             const thumbUrl = asset.variants?.[0]?.imageUrl;
                             const isActive = clip.activeAssetIds?.includes(asset.id);
                             
                             if (!thumbUrl) return null; // Only show assets that have visuals

                             return (
                               <button
                                 key={asset.id}
                                 onClick={() => toggleAssetForClip(scene.id, clip.id, asset.id)}
                                 className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] border transition-all ${
                                   isActive 
                                     ? 'bg-brand-500/20 border-brand-500 text-brand-200' 
                                     : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                 }`}
                               >
                                  <div className="w-4 h-4 rounded-full bg-slate-800 overflow-hidden">
                                     <img src={thumbUrl} className="w-full h-full object-cover" />
                                  </div>
                                  {asset.name}
                               </button>
                             )
                           })}
                        </div>
                      )}
                    </div>

                    {/* Prompt Input */}
                    <div className="mt-auto">
                      <textarea 
                        value={clip.imagePrompt}
                        onChange={(e) => updateClipPrompt(scene.id, clip.id, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-300 h-16 resize-none focus:border-brand-500 outline-none"
                      />
                    </div>
                 </div>
               ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoryboardView;