import React, { useState, useEffect, useRef, useCallback } from 'react';
import LiveAssistant from './components/LiveAssistant';
import ControlPanel from './components/ControlPanel';
import StatusOverlay from './components/StatusOverlay';
import { AppMode, AppState, ConnectionStatus, AppSettings } from './types';
import { AVAILABLE_VOICES } from './constants';
import { playBeep, playClick, announce, vibrate } from './utils/audioUtils';

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
    highContrast: true, 
    largeText: true,
    safeMode: false,
    voiceName: 'Kore',
  });

  // Refs for Stale Closure Prevention
  const appStateRef = useRef(appState);
  const modeRef = useRef(mode);
  
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // --- GESTURE STATE ---
  const touchStartRef = useRef<{x: number, y: number, time: number} | null>(null);
  const tapCountRef = useRef(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initial Voice Guidance
  useEffect(() => {
    const timer = setTimeout(() => {
        announce("SightGuide is ready. Double tap to start. Swipe to change mode. Long press for settings.");
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // --- ACTIONS ---

  const handleStart = useCallback(() => {
      const current = appStateRef.current;
      if (current !== 'idle' && current !== 'error') return;
      
      vibrate([50, 50]);
      playBeep(440, 'sine', 0.1);
      announce("Opening camera. Tap once anytime to ask what I see.");
      setError('');
      setRetryMessage('');
      setAppState('starting');
      setTimeout(() => setAppState('running'), 100);
  }, []);

  const handleStop = useCallback(() => {
      const current = appStateRef.current;
      if (current === 'idle') return;
      
      vibrate([50, 100, 50]);
      playBeep(200, 'sawtooth', 0.2);
      announce("Stopped.");
      setAppState('stopping');
      setTimeout(() => {
          setAppState('idle');
          setConnectionStatus('disconnected');
      }, 500);
  }, []);

  const handleTogglePause = useCallback(() => {
      const current = appStateRef.current;
      if (current === 'running') {
          vibrate([30]);
          announce("Paused. Double tap to resume.");
          setAppState('paused');
      } else if (current === 'paused') {
          vibrate([30]);
          announce("Resuming.");
          setAppState('running');
      }
  }, []);

  const handleModeChange = useCallback((newMode: AppMode) => {
      if (modeRef.current !== newMode) {
          setMode(newMode);
          let text = "";
          switch(newMode) {
              case AppMode.NAVIGATION: text = "Navigation Mode."; break;
              case AppMode.READING: text = "Reading Mode."; break;
              case AppMode.OBJECT: text = "Object Mode."; break;
              default: text = `${newMode}`;
          }
          announce(text);
          vibrate([20]);
      } else {
         vibrate([10]);
      }
  }, []);

  const handleSingleTapAction = useCallback(() => {
    const current = appStateRef.current;
    playClick();
    if (current === 'idle') {
        announce("Double tap to start.");
    } else if (current === 'running') {
        vibrate([15]);
        setActionTrigger(Date.now()); // Trigger AI context update
    } else if (current === 'paused') {
        announce("Paused. Double tap to resume.");
    }
  }, []);

  const handleDoubleTapAction = useCallback(() => {
    const current = appStateRef.current;
    if (current === 'idle') {
        handleStart();
    } else if (current === 'running' || current === 'paused') {
        handleTogglePause();
    }
  }, [handleStart, handleTogglePause]);

  const handleTripleTapAction = useCallback(() => {
      announce("Emergency Stop.");
      handleStop();
  }, [handleStop]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
      const modes = Object.values(AppMode);
      const currentIndex = modes.indexOf(modeRef.current);
      let nextIndex = 0;
      
      if (direction === 'left') { // Next
          nextIndex = (currentIndex + 1) % modes.length;
      } else { // Prev
          nextIndex = (currentIndex - 1 + modes.length) % modes.length;
      }
      handleModeChange(modes[nextIndex]);
  }, [handleModeChange]);

  // --- GESTURE RECOGNITION ---

  const handleInputStart = (clientX: number, clientY: number) => {
      if (showSettings) return;

      touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };

      // Long Press Timer
      longPressTimeoutRef.current = setTimeout(() => {
          vibrate([50]);
          setShowSettings(true);
          announce("Settings opened.");
          touchStartRef.current = null; // Invalidate tap
          tapCountRef.current = 0; // Reset taps
      }, 800);
  };

  const handleInputEnd = (clientX: number, clientY: number) => {
      if (showSettings) return;
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      if (!touchStartRef.current) return;

      const deltaX = clientX - touchStartRef.current.x;
      const deltaY = clientY - touchStartRef.current.y;
      const duration = Date.now() - touchStartRef.current.time;
      
      touchStartRef.current = null; // Clear start point

      // Swipe Detection
      if (duration < 500 && Math.abs(deltaX) > 80 && Math.abs(deltaY) < 60) {
          handleSwipe(deltaX < 0 ? 'left' : 'right');
          tapCountRef.current = 0; 
          return;
      }

      // Tap Detection
      if (duration < 300 && Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
          tapCountRef.current += 1;
          
          if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
          if (doubleTapTimeoutRef.current) clearTimeout(doubleTapTimeoutRef.current);

          if (tapCountRef.current === 1) {
              singleTapTimeoutRef.current = setTimeout(() => {
                  handleSingleTapAction();
                  tapCountRef.current = 0;
              }, 300);
          } else if (tapCountRef.current === 2) {
              doubleTapTimeoutRef.current = setTimeout(() => {
                  handleDoubleTapAction();
                  tapCountRef.current = 0;
              }, 300);
          } else if (tapCountRef.current === 3) {
              handleTripleTapAction();
              tapCountRef.current = 0;
          }
      }
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleInputStart(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      handleInputEnd(touch.clientX, touch.clientY);
  };

  // Mouse Handlers (For Desktop Debugging)
  const handleMouseDown = (e: React.MouseEvent) => {
      handleInputStart(e.clientX, e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
      handleInputEnd(e.clientX, e.clientY);
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(prev => ({...prev, [key]: value}));
      if (key === 'highContrast') announce(value ? "High Contrast Enabled" : "High Contrast Disabled");
      if (key === 'safeMode') announce(value ? "Safe Mode active." : "Safe Mode off.");
  };

  // --- RENDER ---
  const isAssistantActive = appState === 'starting' || appState === 'running' || appState === 'paused' || appState === 'stopping';

  return (
    <div 
        className={`h-[100dvh] w-full flex flex-col overflow-hidden relative select-none ${settings.highContrast ? 'bg-black text-white' : 'bg-slate-900 text-white'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        role="application"
        aria-label="SightGuide App. Entire screen is a touch surface."
    >
      
      {/* Settings Modal (Overlay) */}
      {showSettings && (
          <div className="absolute inset-0 z-[100] bg-black flex flex-col p-6 overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                  <h2 className="text-4xl font-bold text-yellow-400">Settings</h2>
                  <button 
                    onClick={() => { setShowSettings(false); announce("Closing settings."); }} 
                    className="p-4 bg-gray-800 rounded-xl"
                  >
                      <span className="text-4xl">✕</span>
                  </button>
              </div>
              
              <div className="flex flex-col gap-8">
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

                  <div className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl border border-gray-700">
                      <div>
                        <label htmlFor="safe-toggle" className="font-bold text-2xl">Safe Mode</label>
                      </div>
                      <button 
                        id="safe-toggle"
                        onClick={() => updateSetting('safeMode', !settings.safeMode)}
                        className={`w-20 h-10 rounded-full relative transition-colors ${settings.safeMode ? 'bg-green-500' : 'bg-gray-600'}`}
                      >
                           <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all ${settings.safeMode ? 'left-11' : 'left-1'}`} />
                      </button>
                  </div>

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
                    onClick={() => { handleStop(); setShowSettings(false); }}
                    className="mt-8 bg-red-600 text-white font-bold text-2xl p-6 rounded-2xl border-4 border-red-800"
                  >
                      STOP & QUIT
                  </button>
              </div>
          </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col p-2 gap-2 overflow-hidden">
        
        {/* Camera/Idle Viewport */}
        <div className={`flex-1 relative rounded-2xl overflow-hidden shadow-inner ${settings.highContrast ? 'border-4 border-white' : 'bg-black border-slate-700'}`}>
            
            {/* Idle State Visualization */}
            {!isAssistantActive && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-10 pointer-events-none">
                     <div className="w-40 h-40 rounded-full bg-yellow-400 flex items-center justify-center mb-8 animate-pulse opacity-50">
                        <span className="text-8xl">👁️</span>
                     </div>
                     <h1 className="text-5xl font-extrabold tracking-tight text-center mb-4">SightGuide</h1>
                     <p className="text-2xl text-center max-w-sm font-bold">
                        Double tap to start. <br/>
                        Tap once to speak. <br/>
                        Triple tap to stop.
                     </p>
                 </div>
            )}

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
            
            {/* Mode Indicator Overlay (Visual only, helps orientation) */}
            <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <span className="bg-black/70 text-white px-4 py-2 rounded-lg text-xl font-bold border border-white/50">
                    {mode}
                </span>
            </div>
        </div>

        {/* Visual Controls (For low vision / reference) */}
        <div className="flex-none pb-safe flex flex-col gap-3 p-2">
            <div 
                className="pointer-events-auto" 
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()} 
                onTouchEnd={(e) => e.stopPropagation()}
            >
                <ControlPanel 
                    currentMode={mode} 
                    onModeChange={handleModeChange} 
                    disabled={!isAssistantActive || connectionStatus !== 'connected'}
                    highContrast={settings.highContrast}
                />
            </div>
            
            <div 
                className="flex gap-3 h-20 md:h-24 pointer-events-auto"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                <button
                    onClick={handleStop}
                    className="flex-1 bg-red-600 active:bg-red-800 text-white font-black text-3xl tracking-widest rounded-2xl border-4 border-red-900 shadow-xl flex items-center justify-center gap-3"
                >
                    <span className="text-4xl">🛑</span> STOP
                </button>
                
                <button 
                    onClick={() => { setShowSettings(true); announce("Settings."); }}
                    className="w-24 bg-gray-700 active:bg-gray-600 text-white rounded-2xl border-2 border-gray-500 flex items-center justify-center shadow-lg"
                >
                    <span className="text-4xl">⚙️</span>
                </button>
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;