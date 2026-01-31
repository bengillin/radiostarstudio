import React, { useState } from 'react';
import { ParodyRequest, ParodySong } from '../types';
import { X } from 'lucide-react';
import InputForm from './InputForm';
import { generateParodyLyrics } from '../services/geminiService';
import { saveSong } from '../services/storageService';

interface RemixModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseSong: ParodySong;
  onNewVersion: (newSong: ParodySong) => void;
}

const RemixModal: React.FC<RemixModalProps> = ({ isOpen, onClose, baseSong, onNewVersion }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Preparing...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRemixSubmit = async (request: ParodyRequest) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Reconstruct original lyrics from baseSong if not provided, but InputForm might not pass them if hidden.
      // Ideally we use the lines from baseSong.lines if 'request.lyrics' is empty, 
      // but 'lines' are the PARODY lines. We need original lines.
      // We can reconstruct original lines from baseSong.lines.map(l => l.original).join('\n')
      
      let lyricsToUse = request.lyrics;
      if (!lyricsToUse) {
         lyricsToUse = baseSong.lines.map(l => l.isSectionHeader ? l.original : l.original).join('\n');
      }

      const finalRequest = { ...request, lyrics: lyricsToUse };

      const result = await generateParodyLyrics(finalRequest, (status) => setLoadingStatus(status));
      await saveSong(result);
      onNewVersion(result);
      onClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Failed to generate version. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" 
        onClick={!isLoading ? onClose : undefined}
      />
      
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
         {/* Header */}
         <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <div>
            <h3 className="text-xl font-display font-bold text-white">
              Create New Version
            </h3>
            <p className="text-sm text-slate-400">Remix "{baseSong.originalTitle}"</p>
          </div>
          {!isLoading && (
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
           {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4"></div>
                 <h4 className="text-xl font-bold text-white mb-2">Generating Version...</h4>
                 <p className="text-slate-400">{loadingStatus}</p>
              </div>
           ) : (
             <>
               {errorMsg && (
                 <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 text-red-200 text-sm">
                   {errorMsg}
                 </div>
               )}
               <InputForm 
                 isLoading={isLoading} 
                 onSubmit={handleRemixSubmit}
                 isRemix={true}
                 initialValues={{
                   originalArtist: baseSong.originalArtist,
                   originalTitle: baseSong.originalTitle,
                   groupId: baseSong.groupId || baseSong.id
                   // Intentionally leaving lyrics blank so InputForm hides it or we construct it on submit
                 }}
               />
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default RemixModal;