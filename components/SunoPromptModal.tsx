import React, { useState } from 'react';
import { ParodySong } from '../types';
import { Copy, X, Music2, Check, ExternalLink } from 'lucide-react';

interface SunoPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: ParodySong;
}

const SunoPromptModal: React.FC<SunoPromptModalProps> = ({ isOpen, onClose, song }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format specifically for Suno.ai structure
  const generateSunoPrompt = () => {
    const styleTags = song.tags ? song.tags.join(', ') : 'Pop, Parody';
    const styleBlock = `[Style: ${styleTags}, ${song.originalArtist}-style parody]`;
    
    const lyricsBlock = song.lines
      .map(line => line.parody)
      .join('\n');

    return `${styleBlock}\n\n${lyricsBlock}`;
  };

  const sunoPrompt = generateSunoPrompt();

  const handleCopy = () => {
    navigator.clipboard.writeText(sunoPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
          <div>
            <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Music2 className="w-5 h-5 text-purple-400" />
              Generate Music
            </h3>
            <p className="text-sm text-slate-400">Optimized prompt for Suno / Udio</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 relative group">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap h-64 overflow-y-auto custom-scrollbar">
              {sunoPrompt}
            </pre>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleCopy}
              className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard' : 'Copy Prompt'}
            </button>
            
            <a 
              href="https://suno.com/create" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              Open Suno <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          
          <p className="text-xs text-center text-slate-500">
            Paste this directly into the "Custom Mode" lyrics box on Suno or Udio.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SunoPromptModal;