import React, { useState } from 'react';
import { ParodyRequest } from '../types';
import { Music, PenTool, Sparkles, Mic2, WholeWord, Wand2 } from 'lucide-react';

interface InputFormProps {
  initialValues?: Partial<ParodyRequest>;
  onSubmit: (data: ParodyRequest) => void;
  isLoading: boolean;
  isRemix?: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, initialValues, isRemix }) => {
  const [lyrics, setLyrics] = useState(initialValues?.lyrics || '');
  const [artist, setArtist] = useState(initialValues?.originalArtist || '');
  const [title, setTitle] = useState(initialValues?.originalTitle || '');
  const [topic, setTopic] = useState(initialValues?.topic || '');
  const [mood, setMood] = useState<'funny' | 'satirical' | 'serious' | 'absurdist'>(initialValues?.mood || 'funny');
  const [mode, setMode] = useState<'parody' | 'phonetic'>(initialValues?.mode || 'parody');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'parody') {
      if (topic && artist && title) {
        onSubmit({
          lyrics, 
          originalArtist: artist,
          originalTitle: title,
          topic,
          mood,
          mode,
          groupId: initialValues?.groupId // Pass through group ID for remixes
        });
      }
    } else {
      // Phonetic mode doesn't strictly require a topic
      if (artist && title) {
        onSubmit({
          lyrics,
          originalArtist: artist,
          originalTitle: title,
          topic: "Phonetic Rewrite", // Placeholder
          mood,
          mode,
          groupId: initialValues?.groupId
        });
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className={`bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 md:p-10 shadow-2xl ${isRemix ? 'border-brand-500/30' : ''}`}>
        {!isRemix && (
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-500 mb-2">
              Compose Your Song
            </h2>
            <p className="text-slate-400">Choose a mode, provide song details, and we'll handle the rest.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button
               type="button"
               onClick={() => setMode('parody')}
               className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center ${
                 mode === 'parody' 
                   ? 'bg-brand-500/10 border-brand-500 text-white shadow-lg shadow-brand-500/10' 
                   : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
               }`}
             >
               <Wand2 className={`w-8 h-8 ${mode === 'parody' ? 'text-brand-400' : 'text-slate-500'}`} />
               <div>
                 <h3 className="font-bold text-lg">Parody Mode</h3>
                 <p className="text-xs opacity-70 mt-1">Rewrite lyrics about a completely new topic</p>
               </div>
               {mode === 'parody' && <div className="absolute top-3 right-3 w-3 h-3 bg-brand-500 rounded-full shadow-glow" />}
             </button>

             <button
               type="button"
               onClick={() => setMode('phonetic')}
               className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center ${
                 mode === 'phonetic' 
                   ? 'bg-purple-500/10 border-purple-500 text-white shadow-lg shadow-purple-500/10' 
                   : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
               }`}
             >
               <WholeWord className={`w-8 h-8 ${mode === 'phonetic' ? 'text-purple-400' : 'text-slate-500'}`} />
               <div>
                 <h3 className="font-bold text-lg">Phonetic Mode</h3>
                 <p className="text-xs opacity-70 mt-1">Misspelled curses, silent letters & alternate spellings</p>
               </div>
               {mode === 'phonetic' && <div className="absolute top-3 right-3 w-3 h-3 bg-purple-500 rounded-full shadow-glow" />}
             </button>
          </div>

          {/* Top Section: Song Metadata */}
          {/* If Remix, show read-only or collapsible summary of original? For flexibility, keep editable but labelled */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/50">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Music className="w-4 h-4 text-brand-400" />
                Original Song Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bohemian Rhapsody"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
                required
                readOnly={isRemix} 
                disabled={isRemix}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Mic2 className="w-4 h-4 text-brand-400" />
                Original Artist
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Queen"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
                required
                readOnly={isRemix}
                disabled={isRemix}
              />
            </div>
          </div>

          {/* Lyrics Input (Optional) - Hide on Remix if we assume we have them, or allow edit? 
              If we have them, we pass them in. 
          */}
          <div className={`space-y-2 ${isRemix ? 'hidden' : ''}`}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <PenTool className="w-4 h-4 text-brand-400" />
              Original Lyrics <span className="text-slate-500 font-normal ml-2">(Optional - we can find them for you)</span>
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste lyrics here if you have them, or leave blank to auto-fetch..."
              className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none font-mono text-sm leading-relaxed resize-none"
            />
          </div>

          {/* Prompt Section - Only for Parody Mode */}
          {mode === 'parody' && (
            <div className="space-y-6 pt-6 border-t border-slate-700 animate-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-brand-300">
                    <Sparkles className="w-4 h-4" />
                    What's the parody about?
                  </label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Describe your parody idea in detail...&#10;e.g. A programmer struggling with bugs to the tune of 'Yesterday'..."
                    className="w-full h-32 bg-slate-900/50 border border-brand-900/50 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none resize-none"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Mood</label>
                  <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value as any)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
                  >
                    <option value="funny">Funny</option>
                    <option value="satirical">Satirical</option>
                    <option value="absurdist">Absurdist</option>
                    <option value="serious">Serious / Dramatic</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {mode === 'phonetic' && (
             <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm text-purple-200 animate-in slide-in-from-top-2 duration-300">
                <p><strong>Phonetic Mode Active:</strong> We will keep the original lyrics but apply creative spelling rules:</p>
                <ul className="list-disc ml-5 mt-2 space-y-1 text-slate-300">
                   <li>Curse words will be misspelled (e.g. <em>sh*t</em> → <em>sheit</em>)</li>
                   <li>Silent letters will be added (e.g. <em>dumb</em> → <em>dumbe</em>)</li>
                   <li>Alternate spellings used (e.g. <em>night</em> → <em>nite</em>)</li>
                   <li>Pronunciation remains exactly the same!</li>
                </ul>
             </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 px-6 rounded-lg font-bold text-lg tracking-wide shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99]
              ${isLoading 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : mode === 'parody' 
                  ? 'bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-brand-500/25'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25'
              }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              mode === 'parody' ? 'Generate Parody' : 'Rewrite Phonetically'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputForm;