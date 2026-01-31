'use client'

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
})

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm
              animate-in slide-in-from-right-full fade-in duration-200
              ${toast.type === 'success' ? 'bg-green-500/90 text-white' : ''}
              ${toast.type === 'error' ? 'bg-red-500/90 text-white' : ''}
              ${toast.type === 'info' ? 'bg-white/10 text-white border border-white/20' : ''}
            `}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 hover:bg-white/20 rounded transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
