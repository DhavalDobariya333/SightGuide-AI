import React, { useState, useEffect } from 'react';
import LiveAssistant from './components/LiveAssistant';
import ControlPanel from './components/ControlPanel';
import StatusOverlay from './components/StatusOverlay';
import { AppMode, AppState, ConnectionStatus, AppSettings } from './types';
import { AVAILABLE_VOICES } from './constants';
import { playBeep, announce, vibrate } from './utils/audioUtils';

const App: React.FC = () => {
  // Global App State Machine
  const [appState, setAppState] = useState<AppState>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [mode, setMode] = useState<AppMode>(AppMode.NAVIGATION);
  const [error, setError] = useState<string>('');
  const [retryMessage, setRetryMessage] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [actionTrigger, setActionTrigger] = useState<number>(0);

  const [settings, setSettings] = useState<AppSettings>({
    highContrast: true, // Default to high contrast for better accessibility
    largeText: true,
    safeMode: false,
    voiceName: 'Kore',
  });

  // Initial Voice Guidance
  useEffect(() => {
    const timer = setTimeout(() => {
        announce("Hello there! I'm ready to help. Double tap anywhere when you're ready to start.");
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
      if (appState !== 'idle' && appState !== 'error') return;
      vibrate([50, 50]);
      playBeep(440, 'sine', 0.1);
      announce("Opening your camera now, just a moment.");
      setError('');
      setRetryMessage('');
      setAppState('starting');
      setTimeout(() => setAppState('running'), 100);
  };

  const handleStop = () => {
      if (appState === 'idle') return;
      vibrate([50, 100, 50]);
      announce("Okay, stopping now. Have a good rest.");
      setAppState('stopping');
      // Give enough time for cleanup logic in LiveAssistant to run before unmounting
      setTimeout(() => {
          setAppState('idle');
          setConnectionStatus('disconnected');
      }, 500);
  };

  const handleTogglePause = () => {
      if (appState === 'running') {
          vibrate([30]);
          announce("I'll take a quick pause.");
          setAppState('paused');
      } else if (appState === 'paused') {
          vibrate([30]);
          announce("Alright, let's continue.");
          setAppState('running');
      }
  };

  const handleModeChange = (newMode: AppMode) => {
      if (mode !== newMode) {
          setMode(newMode);
          let text = "";
          switch(newMode) {
              case AppMode.NAVIGATION: text = "Let's walk together."; break;
              case AppMode.READING: text = "I'll help you read that."; break;
              case AppMode.OBJECT: text = "Let's look around."; break;
              default: text = `${newMode} Mode`;
          }
          announce(text);
          vibrate([20]);
      } else {
          // Same mode clicked: Silent trigger action
          vibrate([15]);
          setActionTrigger(Date.now());
      }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(prev => ({...prev, [key]: value}));
      if (key === 'highContrast') announce(value ? "High Contrast Enabled" : "High Contrast Disabled");
      if (key === 'safeMode') announce(value ? "Safe Mode active. I'll be extra careful." : "Safe Mode off.");
  };

  // Include 'stopping' to keep component mounted during cleanup phase
  const isAssistantActive = appState === 'starting' || appState === 'running' || appState === 'paused' || appState === 'stopping';

  // --- RENDER IDLE SCREEN (Big Touch Target) ---
  if (!isAssistantActive && !showSettings) {
      return (
        <button 
            onClick={() => {
                // Single tap feedback
                announce("Double tap to start.");
            }}
            onDoubleClick={handleStart}
            className={`w-full h-[100dvh] flex flex-col items-center justify-center gap-8 ${settings.highContrast ? 'bg-black text-white' : 'bg-slate-900 text-white'}`}
            aria-label="Start Screen. Double tap to start SightGuide."
        >
             <div className="w-32 h-32 rounded-full bg-yellow-400 flex items-center justify-center mb-4 animate-pulse">
                <span className="text-6xl">👁️</span>
             </div>
             <h1 className="text-5xl font-extrabold tracking-tight text-center">SightGuide</h1>
             <p className="text-2xl font-medium text-center max-w-xs opacity-80">Double Tap to Start</p>
             
             {/* Settings Button (Discrete) */}
             <div 
                className="absolute top-4 right-4 p-4"
                onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
             >
                 <span className="text-4xl" role="img" aria-label="Settings">⚙️</span>
             </div>
        </button>
      );
  }

  // --- RENDER ACTIVE APP ---
  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden relative ${settings.highContrast ? 'bg-black text-white' : 'bg-slate-900 text-white'}`}>
      
      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col p-2 gap-2 overflow-hidden">
        
        {/* Camera Viewport */}
        <div className={`flex-1 relative rounded-2xl overflow-hidden shadow-inner ${settings.highContrast ? 'border-4 border-white' : 'bg-black border-slate-700'}`}>
            <LiveAssistant 
                mode={mode} 
                appState={appState}
                settings={settings}
                onStatusChange={setConnectionStatus}
                onError={(err) => { setError(err); setAppState('error'); }}
                onModeChange={handleModeChange}
                onRetryUpdate={setRetryMessage}
                onTogglePause={handleTogglePause}
                onOpenSettings={() => { setShowSettings(true); announce("Settings."); }}
                actionTrigger={actionTrigger}
            />
            <StatusOverlay status={connectionStatus} errorMessage={error} retryMessage={retryMessage} />
            
            {/* Pause Overlay Indicator for accessibility */}
            {appState === 'paused' && (
                <div className="sr-only" role="alert">Session Paused</div>
            )}
        </div>

        {/* Controls */}
        <div className="flex-none pb-safe flex flex-col gap-3 p-2">
            <ControlPanel 
                currentMode={mode} 
                onModeChange={handleModeChange} 
                disabled={!isAssistantActive || connectionStatus !== 'connected'}
                highContrast={settings.highContrast}
            />
            
            {/* Big Stop Button & Settings Row */}
            <div className="flex gap-3 h-20 md:h-24">
                <button
                    onClick={handleStop}
                    className="flex-1 bg-red-600 active:bg-red-800 text-white font-black text-3xl tracking-widest rounded-2xl border-4 border-red-900 shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95"
                    aria-label="Stop and End Session"
                >
                    <span className="text-4xl" aria-hidden="true">🛑</span> STOP
                </button>
                
                <button 
                    onClick={() => { setShowSettings(true); announce("Settings."); }}
                    className="w-24 bg-gray-700 active:bg-gray-600 text-white rounded-2xl border-2 border-gray-500 flex items-center justify-center shadow-lg"
                    aria-label="Open Settings"
                >
                    <span className="text-4xl" aria-hidden="true">⚙️</span>
                </button>
            </div>
        </div>

      </main>

      {/* Settings Modal - Rendered last to ensure correct stacking */}
      {showSettings && (
          <div className="absolute inset-0 z-[100] bg-black flex flex-col p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                  <h2 className="text-4xl font-bold text-yellow-400">Settings</h2>
                  <button 
                    onClick={() => { setShowSettings(false); announce("Closing settings."); }} 
                    className="p-4 bg-gray-800 rounded-xl"
                    aria-label="Close Settings"
                  >
                      <span className="text-4xl">✕</span>
                  </button>
              </div>
              
              <div className="flex flex-col gap-8">
                  {/* High Contrast */}
                  <div className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl border border-gray-700">
                      <label htmlFor="hc-toggle" className="font-bold text-2xl">High Contrast</label>
                      <button 
                        id="hc-toggle"
                        onClick={() => updateSetting('highContrast', !settings.highContrast)}
                        className={`w-20 h-10 rounded-full relative transition-colors ${settings.highContrast ? 'bg-white' : 'bg-gray-600'}`}
                      >
                          <div className={`absolute top-1 w-8 h-8 rounded-full bg-black transition-all ${settings.highContrast ? 'left-11' : 'left-1'}`} />
                      </button>
                  </div>

                  {/* Safe Mode */}
                  <div className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl border border-gray-700">
                      <div>
                        <label htmlFor="safe-toggle" className="font-bold text-2xl">Safe Mode</label>
                        <p className="text-sm text-gray-400 mt-1">Extra cautious guidance</p>
                      </div>
                      <button 
                        id="safe-toggle"
                        onClick={() => updateSetting('safeMode', !settings.safeMode)}
                        className={`w-20 h-10 rounded-full relative transition-colors ${settings.safeMode ? 'bg-green-500' : 'bg-gray-600'}`}
                      >
                           <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all ${settings.safeMode ? 'left-11' : 'left-1'}`} />
                      </button>
                  </div>

                   {/* Voice Selection */}
                   <div className="flex flex-col gap-4">
                      <label className="font-bold text-2xl">Assistant Voice</label>
                      <div className="grid grid-cols-2 gap-3">
                          {AVAILABLE_VOICES.map(v => (
                              <button
                                key={v}
                                onClick={() => updateSetting('voiceName', v)}
                                className={`p-6 rounded-xl font-bold text-xl border-4 ${settings.voiceName === v ? 'bg-blue-900 border-white text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}
                              >
                                  {v}
                              </button>
                          ))}
                      </div>
                  </div>

                  <button 
                    onClick={() => {
                        handleStop();
                        setShowSettings(false);
                    }}
                    className="mt-8 bg-red-600 text-white font-bold text-2xl p-6 rounded-2xl border-4 border-red-800"
                  >
                      STOP & QUIT
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;