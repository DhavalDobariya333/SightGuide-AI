export enum AppMode {
  NAVIGATION = 'NAVIGATION',
  READING = 'READING',
  OBJECT = 'OBJECT'
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}

// Robust state management types
export type AppState = 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface AppSettings {
  highContrast: boolean;
  largeText: boolean;
  safeMode: boolean;
  voiceName: VoiceName;
}