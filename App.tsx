import React, { useState, useEffect } from 'react';
import { AppState, ParodyRequest, ParodySong } from './types';
import { generateParodyLyrics } from './services/geminiService';
import { getHistory, saveSong, deleteSong } from './services/storageService';
import InputForm from './components/InputForm';
import ComparisonView from './components/ComparisonView';
import HistoryDrawer from './components/HistoryDrawer';
import { Music, AlertCircle, History, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [parodyData, setParodyData] = useState<ParodySong | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing...");
  
  // History State
  const [history, setHistory] = useState<ParodySong[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      const data = await getHistory();
      setHistory(data);
      setIsHistoryLoading(false);
    };
    loadHistory();
  }, []);

  const handleGenerate = async (request: ParodyRequest) => {
    setAppState(AppState.GENERATING);
    setErrorMsg(null);
    setLoadingStatus("Preparing...");
    try {
      const result = await generateParodyLyrics(request, (status) => {
        setLoadingStatus(status);
      });
      
      // Save to local history (async)
      await saveSong(result);
      const updatedHistory = await getHistory();
      setHistory(updatedHistory);
      
      setParodyData(result);
      setAppState(AppState.RESULT);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Oops! The creative juices got stuck. Please verify your API Key and try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.INPUT);
    setParodyData(null);
    setErrorMsg(null);
  };

  const handleHistorySelect = (song: ParodySong) => {
    setParodyData(song);
    setAppState(AppState.RESULT);
  };

  const handleDeleteFromHistory = async (id: string) => {
    const updated = await deleteSong(id);
    setHistory(updated);
    if (parodyData?.id === id) {
      handleReset();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 text-white selection:bg-brand-500/30">
      
      <HistoryDrawer 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleHistorySelect}
        onDelete={handleDeleteFromHistory}
      />

      {/* Navbar */}
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-gradient-to-tr from-brand-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Radiostar</span>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsHistoryOpen(true)}
               disabled={isHistoryLoading}
               className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
             >
               {isHistoryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
               <span className="hidden sm:inline">My Library</span>
             </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col items-center min-h-[calc(100vh-64px)]">
        
        {appState === AppState.INPUT && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex flex-col items-center">
             <InputForm onSubmit={handleGenerate} isLoading={false} />
          </div>
        )}

        {appState === AppState.GENERATING && (
           <div className="flex flex-col items-center justify-center text-center animate-in fade-in duration-500 pt-20">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-brand-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <div className="relative w-24 h-24 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
                <Music className="absolute inset-0 m-auto w-8 h-8 text-brand-400 animate-bounce" />
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-2">Rewriting the Hits</h3>
              <p className="text-slate-400 max-w-md animate-pulse">
                {loadingStatus}
              </p>
           </div>
        )}

        {appState === AppState.RESULT && parodyData && (
          <ComparisonView song={parodyData} onReset={handleReset} />
        )}

        {appState === AppState.ERROR && (
           <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-8 text-center animate-in zoom-in-95 duration-300">
             <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-white mb-2">Generation Failed</h3>
             <p className="text-slate-300 mb-6">{errorMsg}</p>
             <button 
               onClick={handleReset}
               className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
             >
               Try Again
             </button>
           </div>
        )}

      </main>
    </div>
  );
};

export default App;