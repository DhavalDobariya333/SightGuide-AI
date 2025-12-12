import React from 'react';
import { AppMode } from '../types';

interface ControlPanelProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  disabled: boolean;
  highContrast: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ currentMode, onModeChange, disabled, highContrast }) => {
  const modes = [
    { id: AppMode.NAVIGATION, label: 'Navigation', icon: '🚶', color: 'bg-blue-600', activeColor: 'bg-blue-500' },
    { id: AppMode.READING, label: 'Reading', icon: '📖', color: 'bg-green-600', activeColor: 'bg-green-500' },
    { id: AppMode.OBJECT, label: 'Objects', icon: '🔍', color: 'bg-orange-600', activeColor: 'bg-orange-500' },
  ];

  return (
    <div 
        className={`grid grid-cols-3 gap-3 w-full p-3 h-40 md:h-48 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        role="group"
        aria-label="Mode Selection"
    >
      {modes.map((mode) => {
        const isActive = mode.id === currentMode;
        
        // Dynamic class generation for accessibility
        let containerClass = "relative flex flex-col items-center justify-center rounded-2xl transition-all duration-200 shadow-lg ";
        
        if (highContrast) {
            containerClass += isActive 
                ? "bg-white text-black border-8 border-black " 
                : "bg-black text-white border-4 border-white ";
        } else {
            containerClass += isActive
                ? `${mode.activeColor} border-4 border-white scale-105 z-10 `
                : `${mode.color} border-2 border-transparent opacity-90 `;
        }

        return (
            <button
            key={mode.id}
            onClick={() => {
                if (!disabled) {
                    onModeChange(mode.id);
                }
            }}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={`${mode.label} Mode ${isActive ? '(Active)' : ''}`}
            className={containerClass}
            >
                <span className={`text-4xl md:text-5xl mb-2 ${highContrast && isActive ? 'text-black' : 'text-white drop-shadow-md'}`} aria-hidden="true">
                    {mode.icon}
                </span>
                <span className={`font-bold text-lg md:text-xl tracking-wider uppercase ${highContrast && isActive ? 'text-black' : 'text-white'}`}>
                    {mode.label}
                </span>
                
                {/* Active Indicator Dot for non-high-contrast users */}
                {isActive && !highContrast && !disabled && (
                    <div className="absolute top-3 right-3 w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-md border-2 border-white" />
                )}
            </button>
        );
      })}
    </div>
  );
};

export default ControlPanel;