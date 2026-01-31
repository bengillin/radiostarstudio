import React, { useState, useEffect } from 'react';
import { ParodySong, VisualAsset, AssetVariant } from '../types';
import { generateSceneImage, extractAssetsFromLyrics, enhanceDescription } from '../services/geminiService';
import { Users, Trash2, Wand2, Plus, Upload, Loader2, Image as ImageIcon, MapPin, Box, Sparkles, Star, Maximize2, X, ChevronLeft, ChevronRight, Info } from 'lucide-react';

interface AssetManagerViewProps {
  song: ParodySong;
  onUpdateSong: (updatedSong: ParodySong) => void;
  globalStyle: string;
}

const AssetManagerView: React.FC<AssetManagerViewProps> = ({ song, onUpdateSong, globalStyle }) => {
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [isInitializing, setIsInitializing] = useState(false);
  const [isEnhancingStyle, setIsEnhancingStyle] = useState(false);

  // Lightbox State
  const [lightboxState, setLightboxState] = useState<{assetId: string, variantIndex: number} | null>(null);

  useEffect(() => {
    const initAssets = async () => {
      // Auto-analyze lyrics for assets if none exist
      if (!song.assets || song.assets.length === 0) {
        setIsInitializing(true);
        try {
          const { assets, globalStyle: newStyle } = await extractAssetsFromLyrics(song);
          // Preserve existing style if valid, otherwise use the newly generated one
          const styleToUse = song.globalVisualStyle || newStyle;
          
          onUpdateSong({ ...song, assets, globalVisualStyle: styleToUse });
        } catch (e) {
          console.error("Failed to analyze assets", e);
        } finally {
          setIsInitializing(false);
        }
      }
    };
    initAssets();
  }, []);

  // --- Helpers ---

  const ensureApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }
  };

  const getAssetIcon = (type: string) => {
    switch(type) {
      case 'location': return <MapPin className="w-4 h-4" />;
      case 'object': return <Box className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  // --- Handlers ---

  const handleEnhanceStyle = async () => {
    if (!song.globalVisualStyle) return;
    await ensureApiKey();
    setIsEnhancingStyle(true);
    try {
      const improved = await enhanceDescription(song.globalVisualStyle);
      onUpdateSong({ ...song, globalVisualStyle: improved });
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnhancingStyle(false);
    }
  };

  const handleGenerateVariant = async (asset: VisualAsset) => {
    await ensureApiKey();
    setGeneratingAssetId(asset.id);
    const customInstruction = customPrompts[asset.id] || "Standard reference sheet";
    
    try {
      const fullPrompt = `Character/Object Reference Sheet. 
      Subject: ${asset.name}. 
      Description: ${asset.description}. 
      Specific Pose/Expression: ${customInstruction}. 
      Global Style: ${song.globalVisualStyle || 'Cinematic'}. 
      Ensure clear visibility and neutral lighting.`;

      const referenceAssets = asset.variants.length > 0 ? [asset] : [];

      const imageUrl = await generateSceneImage(fullPrompt, referenceAssets);
      
      const newVariant: AssetVariant = {
        id: crypto.randomUUID(),
        imageUrl: imageUrl,
        prompt: customInstruction
      };

      const updatedAssets = song.assets?.map(a => 
        a.id === asset.id ? { ...a, variants: [newVariant, ...a.variants] } : a
      ) || [];

      onUpdateSong({ ...song, assets: updatedAssets });
      setCustomPrompts(prev => ({ ...prev, [asset.id]: '' })); 

    } catch (e) {
      console.error(e);
      alert("Failed to generate asset image. Check API key.");
    } finally {
      setGeneratingAssetId(null);
    }
  };

  const handleSetPrimaryVariant = (assetId: string, variantIndex: number) => {
    const assets = [...(song.assets || [])];
    const assetIndex = assets.findIndex(a => a.id === assetId);
    if (assetIndex === -1) return;

    const asset = assets[assetIndex];
    // Move the selected variant to index 0
    const variant = asset.variants[variantIndex];
    const otherVariants = asset.variants.filter((_, i) => i !== variantIndex);
    
    assets[assetIndex] = {
      ...asset,
      variants: [variant, ...otherVariants]
    };

    onUpdateSong({ ...song, assets });
    
    // Adjust lightbox index if open
    if (lightboxState && lightboxState.assetId === assetId) {
       setLightboxState({ assetId, variantIndex: 0 });
    }
  };

  const handleDeleteVariant = (assetId: string, variantIndex: number) => {
    const assets = [...(song.assets || [])];
    const assetIndex = assets.findIndex(a => a.id === assetId);
    if (assetIndex === -1) return;

    const asset = assets[assetIndex];
    asset.variants.splice(variantIndex, 1);
    
    onUpdateSong({ ...song, assets });
    
    // Close lightbox if deleting current
    if (lightboxState?.assetId === assetId) {
      setLightboxState(null);
    }
  };

  const handleUploadVariant = (assetId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const newVariant: AssetVariant = {
        id: crypto.randomUUID(),
        imageUrl: base64,
        prompt: "User Uploaded"
      };
      const updatedAssets = song.assets?.map(a => 
        a.id === assetId ? { ...a, variants: [newVariant, ...a.variants] } : a
      ) || [];
      onUpdateSong({ ...song, assets: updatedAssets });
    };
    reader.readAsDataURL(file);
  };

  const handleAddNewAsset = (type: VisualAsset['type']) => {
    const newAsset: VisualAsset = {
      id: crypto.randomUUID(),
      name: `New ${type}`,
      type: type,
      description: "Describe appearance here...",
      variants: [],
      isGenerated: false
    };
    onUpdateSong({ ...song, assets: [...(song.assets || []), newAsset] });
  };
  
  const handleUpdateAsset = (assetId: string, field: 'name' | 'description', value: string) => {
    const updatedAssets = song.assets?.map(a => 
      a.id === assetId ? { ...a, [field]: value } : a
    ) || [];
    onUpdateSong({ ...song, assets: updatedAssets });
  };
  
  const handleDeleteAsset = (assetId: string) => {
    if (confirm("Remove this asset?")) {
      const updatedAssets = song.assets?.filter(a => a.id !== assetId) || [];
      onUpdateSong({ ...song, assets: updatedAssets });
    }
  };

  // --- Lightbox Logic ---

  const handleLightboxNav = (direction: -1 | 1) => {
    if (!lightboxState) return;
    const asset = song.assets?.find(a => a.id === lightboxState.assetId);
    if (!asset) return;
    
    let newIndex = lightboxState.variantIndex + direction;
    if (newIndex < 0) newIndex = asset.variants.length - 1;
    if (newIndex >= asset.variants.length) newIndex = 0;
    
    setLightboxState({ ...lightboxState, variantIndex: newIndex });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!lightboxState) return;
    if (e.key === 'ArrowRight') handleLightboxNav(1);
    if (e.key === 'ArrowLeft') handleLightboxNav(-1);
    if (e.key === 'Escape') setLightboxState(null);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxState]);


  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-in fade-in duration-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-500" />
        <p className="text-lg font-medium text-white">Analyzing Lyrics...</p>
        <p className="text-sm mt-1">Identifying characters, locations, and key items.</p>
      </div>
    );
  }

  // --- Grouping Assets ---
  const characters = song.assets?.filter(a => a.type === 'character') || [];
  const locations = song.assets?.filter(a => a.type === 'location') || [];
  const items = song.assets?.filter(a => a.type === 'object') || [];

  const AssetSection = ({ title, assets, type }: { title: string, assets: VisualAsset[], type: VisualAsset['type'] }) => (
     <div className="space-y-4 mb-12">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
           <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
             {getAssetIcon(type)} {title}
           </h3>
           <button 
            onClick={() => handleAddNewAsset(type)}
            className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-white transition-colors"
           >
             <Plus className="w-3 h-3" /> Add
           </button>
        </div>
        
        {assets.length === 0 ? (
           <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-600 italic text-sm">
             No {title.toLowerCase()} defined.
           </div>
        ) : (
           <div className="grid grid-cols-1 gap-8">
             {assets.map(asset => renderAssetCard(asset))}
           </div>
        )}
     </div>
  );

  const renderAssetCard = (asset: VisualAsset) => (
    <div key={asset.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-brand-500/5 transition-shadow">
      {/* Input Column */}
      <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/30 flex flex-col gap-4">
         <div className="flex justify-between items-start">
            <input 
              type="text" 
              value={asset.name}
              onChange={(e) => handleUpdateAsset(asset.id, 'name', e.target.value)}
              className="bg-transparent text-xl font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-brand-500 outline-none w-full"
            />
            <button onClick={() => handleDeleteAsset(asset.id)} className="text-slate-600 hover:text-red-400 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
         </div>

         <textarea 
            value={asset.description}
            onChange={(e) => handleUpdateAsset(asset.id, 'description', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 resize-none h-32 focus:border-brand-500 outline-none focus:bg-slate-900 transition-colors"
            placeholder="Physical description..."
          />

         <div className="mt-auto space-y-3 pt-4 border-t border-slate-800">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Generator
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. Angry expression..."
                value={customPrompts[asset.id] || ''}
                onChange={(e) => setCustomPrompts(prev => ({...prev, [asset.id]: e.target.value}))}
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:border-brand-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => handleGenerateVariant(asset)}
                  disabled={generatingAssetId === asset.id}
                  className="flex-1 bg-brand-700 hover:bg-brand-600 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-50"
                >
                  {generatingAssetId === asset.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Generate
                </button>
                <label className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg cursor-pointer border border-slate-700 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUploadVariant(asset.id, e.target.files[0])} />
                </label>
            </div>
         </div>
      </div>

      {/* Gallery Column */}
      <div className="p-6 md:w-2/3 flex flex-col bg-slate-900/10">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            Variants ({asset.variants.length})
            {asset.variants.length > 0 && <span className="text-[10px] normal-case bg-brand-500/20 text-brand-200 px-2 rounded-full">Star icon sets primary reference</span>}
        </h3>
        
        {asset.variants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800/50 rounded-xl min-h-[200px]">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm opacity-50">No visuals generated yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {asset.variants.map((variant, idx) => (
              <div key={variant.id} className={`group relative aspect-square rounded-lg overflow-hidden border ${idx === 0 ? 'border-brand-500 shadow-md shadow-brand-500/20' : 'border-slate-800'}`}>
                <img src={variant.imageUrl} alt={variant.prompt} className="w-full h-full object-cover" />
                
                {/* Index 0 Badge */}
                {idx === 0 && (
                   <div className="absolute top-2 left-2 bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
                     PRIMARY
                   </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2 p-2 backdrop-blur-[1px]">
                    <button 
                      onClick={() => setLightboxState({ assetId: asset.id, variantIndex: idx })}
                      className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white backdrop-blur-sm transition-transform hover:scale-110"
                      title="Expand"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSetPrimaryVariant(asset.id, idx)}
                        className={`p-2 rounded-full backdrop-blur-sm transition-transform hover:scale-110 ${idx === 0 ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-300 hover:text-yellow-400'}`}
                        title="Set as Primary Reference"
                        disabled={idx === 0}
                      >
                        <Star className={`w-4 h-4 ${idx === 0 ? 'fill-current' : ''}`} />
                      </button>
                      <button 
                        onClick={() => handleDeleteVariant(asset.id, idx)}
                        className="bg-red-500/20 hover:bg-red-500 p-2 rounded-full text-red-200 hover:text-white backdrop-blur-sm transition-all hover:scale-110"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Global Style Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
           <Sparkles className="w-24 h-24 text-brand-500" />
        </div>
        <div className="relative z-10">
           <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
             <Wand2 className="w-5 h-5 text-brand-400" /> Global Visual Style
           </h2>
           <p className="text-sm text-slate-400 mb-4">
             This style prompt is applied to every character and storyboard frame to ensure consistency.
           </p>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={song.globalVisualStyle || ''} 
               onChange={(e) => onUpdateSong({ ...song, globalVisualStyle: e.target.value })}
               placeholder="e.g. 1980s Dark Fantasy Anime, High Contrast, Grainy..."
               className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none"
             />
             <button 
               onClick={handleEnhanceStyle}
               disabled={isEnhancingStyle || !song.globalVisualStyle}
               className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
             >
               {isEnhancingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               Magic Enhance
             </button>
           </div>
        </div>
      </div>

      <AssetSection title="Cast" assets={characters} type="character" />
      <AssetSection title="Locations" assets={locations} type="location" />
      <AssetSection title="Key Items" assets={items} type="object" />

      {/* Lightbox Overlay */}
      {lightboxState && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
           {(() => {
              const asset = song.assets?.find(a => a.id === lightboxState.assetId);
              const variant = asset?.variants[lightboxState.variantIndex];
              if (!asset || !variant) return null;
              
              const isPrimary = lightboxState.variantIndex === 0;

              return (
                 <div className="flex-1 flex flex-col h-full">
                    {/* Toolbar */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
                       <div className="flex items-center gap-3">
                          <span className="bg-slate-800 text-xs font-bold px-2 py-1 rounded text-slate-300 uppercase tracking-wider">{asset.type}</span>
                          <h3 className="font-bold text-white">{asset.name}</h3>
                          <span className="text-slate-500 text-sm">Variant {lightboxState.variantIndex + 1} / {asset.variants.length}</span>
                       </div>
                       <button onClick={() => setLightboxState(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                          <X className="w-6 h-6" />
                       </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex items-center justify-center p-4 relative">
                       {/* Nav Left */}
                       <button onClick={() => handleLightboxNav(-1)} className="absolute left-4 p-3 bg-black/50 hover:bg-brand-600 text-white rounded-full backdrop-blur-sm transition-colors z-20">
                          <ChevronLeft className="w-6 h-6" />
                       </button>

                       <img 
                         src={variant.imageUrl} 
                         alt={variant.prompt} 
                         className="max-h-full max-w-full object-contain rounded shadow-2xl" 
                       />

                       {/* Nav Right */}
                       <button onClick={() => handleLightboxNav(1)} className="absolute right-4 p-3 bg-black/50 hover:bg-brand-600 text-white rounded-full backdrop-blur-sm transition-colors z-20">
                          <ChevronRight className="w-6 h-6" />
                       </button>
                    </div>

                    {/* Footer / Metadata */}
                    <div className="bg-black/40 border-t border-white/10 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                       <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 text-brand-300 text-xs font-bold uppercase tracking-widest">
                             <Info className="w-3 h-3" /> Generator Prompt
                          </div>
                          <p className="text-slate-300 text-sm font-mono">{variant.prompt}</p>
                       </div>
                       
                       <div className="flex gap-4 shrink-0">
                          <button 
                             onClick={() => handleSetPrimaryVariant(asset.id, lightboxState.variantIndex)}
                             disabled={isPrimary}
                             className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${isPrimary ? 'bg-brand-600 text-white cursor-default' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                          >
                             <Star className={`w-4 h-4 ${isPrimary ? 'fill-current' : ''}`} />
                             {isPrimary ? 'Primary Reference' : 'Set as Primary'}
                          </button>
                          
                          <button 
                             onClick={() => handleDeleteVariant(asset.id, lightboxState.variantIndex)}
                             className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-colors border border-red-500/20"
                          >
                             <Trash2 className="w-4 h-4" />
                             Delete
                          </button>
                       </div>
                    </div>
                 </div>
              );
           })()}
        </div>
      )}
    </div>
  );
};

export default AssetManagerView;