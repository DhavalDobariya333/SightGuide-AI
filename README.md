# SightGuide AI

SightGuide AI is a warm, compassionate accessibility companion designed for visually impaired users. It utilizes the multimodal capabilities of the Google Gemini Live API to provide real-time, conversational audio guidance, acting as a "human-like" guide walking arm-in-arm with the user.

## Blind-First User Guide

This application is designed to be fully usable without seeing the screen. **The entire screen is a touch surface.**

### 🖐️ Gesture Controls
Do not look for buttons. Use the following gestures anywhere on the screen:

*   **Double Tap**: **Start** the session (if stopped) or **Pause/Resume** (if running).
*   **Single Tap**: **Ask** the AI to describe exactly what is in front of you right now (Primary Action).
*   **Triple Tap**: **Emergency Stop**. Immediately cuts audio and connection.
*   **Swipe Left / Right**: **Switch Modes** (Navigation ↔ Reading ↔ Object).
*   **Long Press** (Hold 1s): Open **Settings**.

### 🔊 Audio & Haptic Feedback
Every interaction provides immediate feedback:
*   **Clicks & Beeps**: Confirm gestures have been registered.
*   **Vibration**: Distinct patterns for starting (two buzzes), stopping (long buzz), and errors.
*   **Voice**: The assistant will explicitly announce mode changes ("Navigation Mode") and status ("Paused").

### The Three Modes
SightGuide changes its personality based on your needs. Swipe Left or Right to cycle through them.

1.  **Navigation Mode (Default)**: *Your Walking Companion*
    *   **Purpose**: Walking, avoiding obstacles, and orientation.
    *   **Behavior**: Provides a "heartbeat" update every 3 seconds. It prioritizes hazards (curbs, poles) and path clarity.
2.  **Reading Mode**: *Your Reader*
    *   **Purpose**: Reading mail, menus, signs, or screens.
    *   **Behavior**: Automatically detects and reads text. Polite and patient with page turns.
3.  **Object Mode**: *Your Describer*
    *   **Purpose**: Finding lost items or exploring a room.
    *   **Behavior**: Describes the environment in detail ("There is a blue mug to your right") and helps you interact with objects.

### Settings Menu (Long Press)
*   **High Contrast**: Toggles strictly Black & White visuals (Enabled by default).
*   **Safe Mode**: Makes the AI extra cautious and verbose about safety hazards.
*   **Voice Selection**: Choose from 5 distinct voices (Kore, Puck, Charon, Fenrir, Zephyr).

---

## Developer Instructions

### Prerequisites
*   Node.js (v18+ recommended)
*   A Google AI Studio API Key with access to the `gemini-2.5-flash-native-audio-preview` model.

### Setup

1.  **Environment Variable**
    This project requires a valid API Key. Ensure `process.env.API_KEY` is available in your build environment.
    
    If running locally with a `.env` file:
    ```bash
    API_KEY=your_actual_api_key_here
    ```

2.  **Installation**
    Install the necessary dependencies.
    ```bash
    npm install
    ```

3.  **Running the App**
    Start the development server:
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000).

### Important Technical Notes
*   **Context**: The entire `App` container captures `onTouchStart` and `onTouchEnd` to calculate gesture duration and delta. Visual buttons use `e.stopPropagation()` to prevent conflict, but the app is fully functional via gestures alone.
*   **Audio**: Uses Web Audio API for low-latency PCM streaming (16kHz input / 24kHz output).
*   **Model**: Hardcoded to `gemini-2.5-flash-native-audio-preview-09-2025`.