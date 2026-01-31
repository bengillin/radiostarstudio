import React, { useState, useEffect } from 'react';
import { ParodySong } from '../types';
import { ArrowLeft, Copy, Mic, Check, Music2, Share2, Film, FileText, Users, Play, Loader2, Save, Layers, Plus } from 'lucide-react';
import SunoPromptModal from './SunoPromptModal';
import StoryboardView from './StoryboardView';
import AssetManagerView from './AssetManagerView';
import RemixModal from './RemixModal';
import { saveSong, getRelatedSongs } from '../services/storageService';
import { generateSpeech } from '../services/geminiService';

interface ComparisonViewProps {
  song: ParodySong;
  onReset: () => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ song: initialSong, onReset }) => {
  const [song, setSong] = useState<ParodySong>(initialSong);
  const [versions, setVersions] = useState<ParodySong[]>([]);
  const [copied, setCopied] = useState(false);
  const [showSunoModal, setShowSunoModal] = useState(false);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'lyrics' | 'assets' | 'storyboard'>('lyrics');
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  useEffect(() => {
    // When prop changes (e.g. from history select), update local state
    setSong(initialSong);
  }, [initialSong]);

  useEffect(() => {
    const loadVersions = async () => {
      const groupId = song.groupId || song.id;
      if (groupId) {
        const related = await getRelatedSongs(groupId);
        setVersions(related);
      } else {
        setVersions([song]);
      }
    };
    loadVersions();
  }, [song]);

  // Wrapper to update state and persistence
  const handleUpdateSong = async (updatedSong: ParodySong) => {
    setSong(updatedSong);
    await saveSong(updatedSong);
    
    // Update the version in the list as well to keep titles/summaries in sync
    setVersions(prev => prev.map(v => v.id === updatedSong.id ? updatedSong : v));
  };

  const handleNewVersionCreated = (newSong: ParodySong) => {
    setSong(newSong);
    // Refresh list (it should contain new song now)
    const groupId = newSong.groupId;
    if (groupId) {
      getRelatedSongs(groupId).then(setVersions);
    }
  };

  const updateLyric = (index: number, newText: string) => {
    const updatedLines = [...song.lines];
    updatedLines[index] = { ...updatedLines[index], parody: newText };
    handleUpdateSong({ ...song, lines: updatedLines });
  };

  const handlePlayAudio = async () => {
    if (isPlaying) return; // Simple debounce, currently no stop function
    setIsAudioLoading(true);
    
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) await window.aistudio.openSelectKey();
      }

      // Concatenate lyrics for reading
      const textToRead = song.lines
        .map(l => l.isSectionHeader ? '' : l.parody) // Skip headers for flow
        .filter(t => t.trim() !== "")
        .join(". \n");

      const audioBuffer = await generateSpeech(textToRead);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => setIsPlaying(false);
      
      source.start();
      setIsPlaying(true);
    } catch (e) {
      console.error("Audio playback failed", e);
      alert("Failed to generate audio. Check API key.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = song.lines.map(l => l.parody).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareParody = () => {
    const text = `Check out this parody I made with ParodyPop!\n\n"${song.parodyTitle}"\n(Parody of ${song.originalTitle})\n\n${song.summary}\n\nWrite your own at ParodyPop!`;
    if (navigator.share) {
      navigator.share({
        title: song.parodyTitle,
        text: text,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      alert("Share text copied to clipboard!");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      <SunoPromptModal 
        isOpen={showSunoModal} 
        onClose={() => setShowSunoModal(false)} 
        song={song} 
      />

      <RemixModal
        isOpen={showRemixModal}
        onClose={() => setShowRemixModal(false)}
        baseSong={song}
        onNewVersion={handleNewVersionCreated}
      />

      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row items-center justify-between mb-8 gap-6">
        <button 
          onClick={onReset}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors self-start lg:self-auto order-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Create New
        </button>
        
        <div className="text-center order-2 lg:flex-1 flex flex-col items-center">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
            {song.parodyTitle}
          </h1>
          <p className="text-brand-300 text-sm md:text-base font-medium">
            Parody of "{song.originalTitle}"
          </p>
          
          {/* Version Selector */}
          {versions.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
              <div className="flex bg-slate-900 rounded-lg p-1 gap-1 overflow-x-auto max-w-full">
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setSong(v)}
                    className={`px-3 py-1 text-xs rounded-md transition-all whitespace-nowrap ${
                      v.id === song.id 
                        ? 'bg-brand-600 text-white font-bold shadow-sm' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    Ver {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowRemixModal(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded-lg transition-colors border border-slate-700"
                title="Create New Version"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {song.tags && (
             <div className="flex justify-center gap-2 mt-2 flex-wrap">
                {song.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 border border-slate-700">
                    {tag}
                  </span>
                ))}
             </div>
          )}
        </div>

        <div className="flex gap-2 order-3 w-full lg:w-auto justify-center lg:justify-end">
           <button 
            onClick={() => setShowSunoModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg shadow-purple-500/20"
          >
            <Music2 className="w-4 h-4" />
            <span className="hidden sm:inline">Create Music</span>
          </button>
          
          <button 
            onClick={shareParody}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8 overflow-x-auto">
        <div className="bg-slate-900/80 p-1 rounded-xl border border-slate-800 inline-flex min-w-max">
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'lyrics' 
                ? 'bg-slate-800 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" /> Lyrics
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'assets' 
                ? 'bg-slate-800 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Cast & Assets
          </button>
          <button
            onClick={() => setActiveTab('storyboard')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'storyboard' 
                ? 'bg-slate-800 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-4 h-4" /> Storyboard
          </button>
        </div>
      </div>

      {activeTab === 'lyrics' && (
        <>
          {/* Action Row */}
          <div className="flex justify-between items-center mb-4">
             <div className="text-sm text-slate-500 italic">
               Click any parody line to edit.
             </div>
             <div className="flex gap-2">
               <button 
                  onClick={handlePlayAudio}
                  disabled={isPlaying || isAudioLoading}
                  className="flex items-center gap-2 bg-brand-700 hover:bg-brand-600 border border-brand-600 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium disabled:opacity-50"
                >
                  {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Playing...' : 'Read Aloud'}
                </button>
               <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
             </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
            {/* Table Header */}
            <div className="grid grid-cols-2 bg-slate-950/50 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
              <div className="p-4 md:p-6 text-left border-r border-slate-800 pl-8">
                <h3 className="text-slate-500 font-bold uppercase tracking-wider text-xs md:text-sm">Original</h3>
              </div>
              <div className="p-4 md:p-6 text-left pl-8">
                <h3 className="text-brand-400 font-bold uppercase tracking-wider text-xs md:text-sm flex items-center justify-start gap-2">
                  <Mic className="w-4 h-4" /> Parody
                </h3>
              </div>
            </div>

            {/* Lyrics Rows */}
            <div className="divide-y divide-slate-800/50">
              {song.lines.map((line, idx) => {
                if (line.isSectionHeader) {
                  return (
                    <div key={idx} className="bg-slate-800/50 p-3 text-center border-y border-slate-700/50 mt-1 first:mt-0">
                      <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-brand-300/80">
                        {line.parody || line.original}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="grid grid-cols-2 group hover:bg-slate-800/30 transition-colors">
                    
                    {/* Original Line */}
                    <div className="p-4 md:px-8 md:py-5 border-r border-slate-800/50 flex items-center text-left">
                       {line.original === "" ? (
                         <div className="h-6" /> /* Spacer for instrumental breaks */
                       ) : (
                         <p className="text-slate-400 text-sm md:text-lg font-light leading-relaxed whitespace-pre-wrap select-none opacity-80">
                           {line.original}
                         </p>
                       )}
                    </div>

                    {/* Parody Line (Editable) */}
                    <div className="p-4 md:px-8 md:py-5 flex items-center relative text-left">
                      {line.parody === "" && line.original === "" ? (
                         <div className="h-6" />
                      ) : (
                         <div className="w-full">
                           <textarea
                             value={line.parody}
                             onChange={(e) => updateLyric(idx, e.target.value)}
                             rows={Math.max(1, Math.ceil(line.parody.length / 40))}
                             className="w-full bg-transparent text-brand-50 text-sm md:text-lg font-medium leading-relaxed whitespace-pre-wrap border-none focus:ring-0 p-0 resize-none outline-none overflow-hidden"
                           />
                           
                           {/* Quality Indicators (Hidden usually, visible on hover if issues exist) */}
                           {line.syllableDiff !== 0 && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-yellow-500/50 border border-yellow-500/20 px-1 rounded pointer-events-none">
                                {line.syllableDiff > 0 ? '+' : ''}{line.syllableDiff} syl
                              </span>
                           )}
                         </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      
      {activeTab === 'assets' && (
        <AssetManagerView 
          song={song} 
          onUpdateSong={handleUpdateSong} 
          globalStyle={song.globalVisualStyle || 'Cinematic'} 
        />
      )}

      {activeTab === 'storyboard' && (
        <StoryboardView song={song} onUpdateSong={handleUpdateSong} />
      )}

      <div className="mt-8 text-center pb-10">
        <p className="text-slate-500 text-sm italic">
          "{song.summary}"
        </p>
      </div>

    </div>
  );
};

export default ComparisonView;