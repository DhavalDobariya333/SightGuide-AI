import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AppMode, AppSettings, AppState } from '../types';
import { MODEL_NAME, SYSTEM_INSTRUCTIONS, AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT, TOOLS } from '../constants';
import { createPcmBlob, base64ToUint8Array, decodeAudioData, blobToBase64, playBeep, announce, vibrate } from '../utils/audioUtils';

interface LiveAssistantProps {
  mode: AppMode;
  appState: AppState;
  settings: AppSettings;
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error') => void;
  onError: (error: string) => void;
  onModeChange: (mode: AppMode) => void;
  onRetryUpdate: (msg: string) => void;
  onTogglePause: () => void;
  onOpenSettings: () => void;
  actionTrigger: number;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ 
    mode, 
    appState, 
    settings, 
    onStatusChange, 
    onError, 
    onModeChange, 
    onRetryUpdate, 
    onTogglePause,
    onOpenSettings,
    actionTrigger
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // State Refs (Crucial for access inside closures/callbacks)
  const appStateRef = useRef(appState);
  const modeRef = useRef(mode);
  const settingsRef = useRef(settings);
  const isMountedRef = useRef(false);

  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  
  // State Guards
  const isMountingRef = useRef(false);
  const cleanupInProgressRef = useRef(false);
  const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Reconnection & Gestures
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Gesture Refs
  const touchStartRef = useRef<{x: number, y: number, time: number} | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = appState === 'running' || appState === 'starting' || appState === 'paused';
  const isPaused = appState === 'paused';

  // Helper to stop all audio
  const stopAudioOutput = useCallback(() => {
    audioSourcesRef.current.forEach(source => {
      try { 
          source.stop(); 
          source.disconnect();
      } catch (e) {}
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  // Comprehensive Cleanup function
  const cleanup = useCallback(async () => {
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;
    console.log("Stopping LiveAssistant...");

    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    // Stop Audio Output Immediately
    stopAudioOutput();

    if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch(e) {}
        processorRef.current = null;
    }
    if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e) {}
        sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }

    if (sessionPromiseRef.current) {
       const session = await sessionPromiseRef.current.catch(() => null);
       if (session) {
         try { session.close(); } catch(e) {}
       }
       sessionPromiseRef.current = null;
    }

    if (inputAudioContextRef.current) {
      await inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      await outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
    
    lastFrameDataRef.current = null;
    cleanupInProgressRef.current = false;
  }, [stopAudioOutput]);

  // Handle Mode Switching dynamically
  useEffect(() => {
    if (!sessionPromiseRef.current || !isActive || cleanupInProgressRef.current || isPaused) return;
    
    sessionPromiseRef.current.then(session => {
        let instruction = SYSTEM_INSTRUCTIONS[mode];
        if (settings.safeMode) {
             instruction += " WARNING: SAFE MODE ACTIVE. BE EXTRA CAUTIOUS AND SUPPORTIVE.";
        }
        
        session.sendRealtimeInput({
            text: `CONTEXT UPDATE: The user has switched to ${mode}. Please adopt your caring, warm ${mode} persona immediately. ${instruction}`
        });
    }).catch(() => {});
  }, [mode, isActive, isPaused, settings.safeMode]);

  // Handle Explicit Trigger (Tap on active mode)
  useEffect(() => {
    if (actionTrigger === 0 || !sessionPromiseRef.current || !isActive || isPaused) return;

    sessionPromiseRef.current.then(session => {
        session.sendRealtimeInput({
            text: `INTERACTION: The user tapped the screen for help. Warmly provide an update or reassurance based on the current ${mode} context.`
        });
    }).catch(() => {});
  }, [actionTrigger, isActive, isPaused, mode]);

  const connect = async (isRetry = false) => {
      if (cleanupInProgressRef.current) return;
      if (!isActive) return;
      
      isMountingRef.current = true;
      if (isRetry) onStatusChange('reconnecting');
      else onStatusChange('connecting');

      try {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
        
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: AUDIO_SAMPLE_RATE_INPUT
            }, 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "environment"
            } 
        });
        
        // Strict Race Condition Check: If we unmounted or stopped while getting media, abort immediately.
        if (!isMountedRef.current || !appStateRef.current || appStateRef.current === 'idle' || appStateRef.current === 'stopping') {
            mediaStream.getTracks().forEach(t => t.stop());
            if (inputAudioContextRef.current) inputAudioContextRef.current.close();
            if (outputAudioContextRef.current) outputAudioContextRef.current.close();
            return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let systemPrompt = SYSTEM_INSTRUCTIONS[mode];
        if (settings.safeMode) {
            systemPrompt += " SAFETY PRIORITY: You are in SAFE MODE. Be extra cautious, gentle, and supportive in your warnings.";
        }
        
        sessionPromiseRef.current = ai.live.connect({
          model: MODEL_NAME,
          config: {
            responseModalities: [Modality.AUDIO],
            tools: [{ functionDeclarations: TOOLS }],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceName } },
            },
            systemInstruction: systemPrompt,
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              // Re-check mount/state status after connection established
              if (!isMountedRef.current || (appStateRef.current !== 'running' && appStateRef.current !== 'starting' && appStateRef.current !== 'paused')) { 
                  cleanup(); 
                  return; 
              }

              onStatusChange('connected');
              retryCountRef.current = 0;
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              onRetryUpdate("");
              playBeep(880, 'sine', 0.1); 
              announce(`Connected. Let's walk together.`);
              
              if (!inputAudioContextRef.current || !streamRef.current) return;
              
              const audioSource = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              sourceRef.current = audioSource;
              const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              
              processor.onaudioprocess = (e) => {
                const current = appStateRef.current;
                if (!isMountedRef.current) return;
                
                // Mute input ONLY when strictly paused, but ensure we don't process if stopped.
                if (current !== 'running' && current !== 'starting' && current !== 'paused') return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromiseRef.current?.then(session => {
                    // Check strict mount status again in async callback
                    if (isMountedRef.current) {
                        session.sendRealtimeInput({ media: pcmBlob });
                    }
                });
              };
              
              audioSource.connect(processor);
              processor.connect(inputAudioContextRef.current.destination);

              startFrameStreaming();
            },
            onmessage: async (message: LiveServerMessage) => {
                if (!isMountedRef.current) return;
                const currentAppState = appStateRef.current;
                if (currentAppState !== 'running' && currentAppState !== 'starting' && currentAppState !== 'paused') return;

                // Handle Audio Output
                const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio && outputAudioContextRef.current) {
                    if (currentAppState !== 'paused') {
                        const ctx = outputAudioContextRef.current;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                        const audioBytes = base64ToUint8Array(base64Audio);
                        const audioBuffer = await decodeAudioData(audioBytes, ctx, AUDIO_SAMPLE_RATE_OUTPUT);
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(ctx.destination);
                        source.addEventListener('ended', () => {
                            try { source.disconnect(); audioSourcesRef.current.delete(source); } catch(e) {}
                        });
                        source.start(nextStartTimeRef.current);
                        audioSourcesRef.current.add(source);
                        nextStartTimeRef.current += audioBuffer.duration;
                    }
                }

                if (message.toolCall) {
                    for (const fc of message.toolCall.functionCalls) {
                        if (fc.name === 'changeMode') {
                            const newMode = fc.args.mode as AppMode;
                            onModeChange(newMode);
                            // announce(`${newMode} mode selected.`); // Handled by App.tsx onModeChange
                            // vibrate([50]);
                            sessionPromiseRef.current?.then(session => {
                                if(isMountedRef.current) {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: `Switched to ${newMode}. Speak warmly to the user.` } }
                                    });
                                }
                            });
                        } else if (fc.name === 'toggleCamera') {
                            const action = fc.args.action;
                            const isCurrentlyPaused = currentAppState === 'paused';
                            let resultText = '';
                            if (action === 'pause') {
                                if (!isCurrentlyPaused) {
                                    onTogglePause();
                                    resultText = 'Camera paused.';
                                } else resultText = 'Camera is already paused.';
                            } else if (action === 'resume') {
                                if (isCurrentlyPaused) {
                                    onTogglePause();
                                    resultText = 'Camera resumed.';
                                } else resultText = 'Camera is already active.';
                            }
                            sessionPromiseRef.current?.then(session => {
                                if(isMountedRef.current) {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: resultText } }
                                    });
                                }
                            });
                        }
                    }
                }
                if (message.serverContent?.interrupted) {
                    stopAudioOutput();
                }
            },
            onclose: () => { if (isActive && isMountedRef.current) handleDisconnect(); },
            onerror: (err) => { if (isActive && isMountedRef.current) handleDisconnect(); }
          }
        });
      } catch (err: any) {
        if (isMountedRef.current) {
            onError(err.message || "Failed to start camera or connection");
            if (isActive) handleDisconnect();
        }
      } finally {
        isMountingRef.current = false;
      }
  };

  const handleDisconnect = () => {
      if (!isActive || cleanupInProgressRef.current || !isMountedRef.current) return;
      cleanup().then(() => {
        if (!isMountedRef.current) return;
        if (retryCountRef.current < MAX_RETRIES) {
            const delay = Math.pow(2, retryCountRef.current) * 1000;
            retryCountRef.current++;
            onStatusChange('reconnecting');
            playBeep(200, 'sawtooth', 0.3);
            let secondsLeft = Math.ceil(delay / 1000);
            const updateCountdown = () => onRetryUpdate(`I'm reconnecting in ${secondsLeft}s...`);
            updateCountdown();
            countdownIntervalRef.current = setInterval(() => {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                    onRetryUpdate("Connecting...");
                } else { updateCountdown(); }
            }, 1000);
            retryTimeoutRef.current = setTimeout(() => { if (isActive && isMountedRef.current) connect(true); }, delay);
        } else {
            onStatusChange('error');
            onError("I'm having trouble connecting to the network.");
            announce("I can't reach the internet right now. Please check your connection.");
        }
      });
  };

  const startFrameStreaming = () => {
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (!diffCanvasRef.current) {
            diffCanvasRef.current = document.createElement('canvas');
            diffCanvasRef.current.width = 64; 
            diffCanvasRef.current.height = 64;
        }

        const TICK_RATE = 500; 
        const HEARTBEAT_INTERVAL = 2000; 
        
        frameIntervalRef.current = window.setInterval(() => {
            if (!isMountedRef.current) return;
            // Check Ref for current state
            const currentAppState = appStateRef.current;
            // STOP streaming if paused or stopped
            if (currentAppState === 'paused' || currentAppState !== 'running') return; 

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const diffCanvas = diffCanvasRef.current;
            if (!video || !canvas || !diffCanvas || !sessionPromiseRef.current) return;

            const now = Date.now();
            const timeSinceLastSend = now - lastFrameTimeRef.current;
            const diffCtx = diffCanvas.getContext('2d');
            
            if (diffCtx) {
                diffCtx.drawImage(video, 0, 0, 64, 64);
                const currentFrame = diffCtx.getImageData(0, 0, 64, 64);
                let hasSignificantChange = false;

                if (lastFrameDataRef.current) {
                    let totalDiff = 0;
                    const data = currentFrame.data;
                    const prevData = lastFrameDataRef.current;
                    for (let i = 0; i < data.length; i += 4) {
                        totalDiff += Math.abs(data[i] - prevData[i]) + Math.abs(data[i+1] - prevData[i+1]) + Math.abs(data[i+2] - prevData[i+2]);
                    }
                    if ((totalDiff / (64 * 64)) > 15) hasSignificantChange = true;
                } else {
                    hasSignificantChange = true;
                }

                lastFrameDataRef.current = currentFrame.data;

                if (hasSignificantChange || timeSinceLastSend > HEARTBEAT_INTERVAL) {
                     lastFrameTimeRef.current = now;
                     const ctx = canvas.getContext('2d');
                     if (ctx) {
                        const targetWidth = 480;
                        const aspect = video.videoHeight / video.videoWidth;
                        canvas.width = targetWidth;
                        canvas.height = targetWidth * aspect;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(async (blob) => {
                            // Double check state before sending
                            if (blob && appStateRef.current === 'running' && isMountedRef.current) {
                                const base64Data = await blobToBase64(blob);
                                sessionPromiseRef.current?.then(session => {
                                    if(isMountedRef.current) {
                                        session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
                                    }
                                });
                            }
                        }, 'image/jpeg', 0.5);
                     }
                }
            }
        }, TICK_RATE); 
  };

  // --- GESTURE HANDLING ---

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now()
      };

      // Detect Double Tap
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
          onTogglePause();
          // Reset
          lastTapTimeRef.current = 0;
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
          return;
      }
      lastTapTimeRef.current = now;

      // Detect Long Press
      longPressTimerRef.current = setTimeout(() => {
          vibrate([50]);
          onOpenSettings();
          touchStartRef.current = null; // Invalidate current gesture so touchend doesn't fire swipe
      }, 800);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      // Clear long press timer on release
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }

      if (!touchStartRef.current) return;
      
      const touchEnd = {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
          time: Date.now()
      };
      
      const diffX = touchEnd.x - touchStartRef.current.x;
      const diffY = touchEnd.y - touchStartRef.current.y;
      const duration = touchEnd.time - touchStartRef.current.time;

      // Swipe Detection (Must be quick and significant)
      if (duration < 500 && Math.abs(diffX) > 80 && Math.abs(diffY) < 60) {
          const modes = Object.values(AppMode);
          const currentIndex = modes.indexOf(mode);
          let newMode = mode;
          
          if (diffX < 0) { // Swipe Left -> Next
              const nextIndex = (currentIndex + 1) % modes.length;
              newMode = modes[nextIndex];
          } else { // Swipe Right -> Prev
              const prevIndex = (currentIndex - 1 + modes.length) % modes.length;
              newMode = modes[prevIndex];
          }
          
          if (newMode !== mode) {
            vibrate([20]);
            onModeChange(newMode);
            // Announce handled by parent
          }
      }
      touchStartRef.current = null;
  };

  // Pause Effect
  useEffect(() => {
      if (isPaused) {
          stopAudioOutput();
          // We do NOT disconnect session so we can still hear "Resume" commands via audio input
      }
  }, [isPaused, stopAudioOutput]);

  // Mount/Unmount Logic
  useEffect(() => {
    isMountedRef.current = true;
    if (isActive) connect();
    else { cleanup(); onStatusChange('disconnected'); }
    
    return () => { 
        isMountedRef.current = false;
        cleanup(); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]); 

  return (
    <div 
        className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-xl border-4 ${isPaused ? 'border-yellow-500' : 'border-slate-700'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="application"
        aria-label={`Camera View. Current mode: ${mode}. Double tap to ${isPaused ? 'resume' : 'pause'}. Swipe to change mode.`}
    >
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-300 ${settings.highContrast ? 'grayscale contrast-125' : 'opacity-80'} ${isPaused ? 'opacity-30 blur-sm' : ''}`}
        playsInline
        muted
        autoPlay
      />
      {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/80 p-6 rounded-2xl border-2 border-yellow-500">
                  <span className="text-6xl" role="img" aria-label="Paused">⏸️</span>
                  <p className="text-yellow-500 font-bold text-2xl mt-2 text-center">PAUSED</p>
              </div>
          </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default LiveAssistant;