import React from 'react';
import { ParodySong } from '../types';
import { Clock, Trash2, ChevronRight, X } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ParodySong[];
  onSelect: (song: ParodySong) => void;
  onDelete: (id: string) => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onSelect, 
  onDelete 
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-400" />
              History
            </h2>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p>No parodies generated yet.</p>
                <p className="text-sm mt-2">Create something amazing!</p>
              </div>
            ) : (
              history.map((song) => (
                <div 
                  key={song.id} 
                  className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-brand-500/30 rounded-lg p-4 transition-all group cursor-pointer"
                  onClick={() => {
                    onSelect(song);
                    onClose();
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white line-clamp-1 group-hover:text-brand-300 transition-colors">
                      {song.parodyTitle}
                    </h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(song.id);
                      }}
                      className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Parody of {song.originalTitle}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(song.createdAt).toLocaleDateString()}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HistoryDrawer;