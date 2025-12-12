import React, { useEffect, useState } from 'react';
import { ConnectionStatus } from '../types';

interface StatusOverlayProps {
  status: ConnectionStatus;
  errorMessage?: string;
  retryMessage?: string;
}

const StatusOverlay: React.FC<StatusOverlayProps> = ({ status, errorMessage, retryMessage }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Return null if connected OR if intentionally disconnected (idle state)
  if ((status === 'connected' || status === 'disconnected') && !isOffline) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center" aria-live="assertive">
      
      {isOffline && (
         <div className="flex flex-col items-center mb-6 animate-pulse">
            <span className="text-4xl mb-2">📡</span>
            <h2 className="text-xl font-bold text-red-400">No Internet Connection</h2>
         </div>
      )}

      {status === 'connecting' && !isOffline && (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-yellow-400 mb-2">Connecting...</h2>
          <p className="text-white text-lg">Initializing your guide.</p>
        </div>
      )}
      
      {status === 'reconnecting' && !isOffline && (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-orange-400 border-dashed rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-orange-400 mb-2">Connection Lost</h2>
          <p className="text-white text-lg">{retryMessage || "Attempting to reconnect..."}</p>
        </div>
      )}

      {status === 'error' && !isOffline && (
        <div className="flex flex-col items-center">
           <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-3xl font-bold text-red-500 mb-4">Error</h2>
          <p className="text-white text-xl mb-6">{errorMessage || "Service unavailable."}</p>
          <button 
             onClick={() => window.location.reload()}
             className="bg-white text-black px-8 py-4 rounded-xl font-bold text-xl active:bg-gray-200 focus:ring-4 ring-yellow-400"
          >
            Reload App
          </button>
        </div>
      )}
    </div>
  );
};

export default StatusOverlay;