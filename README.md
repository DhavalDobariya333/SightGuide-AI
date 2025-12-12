# SightGuide AI

SightGuide AI is a warm, compassionate accessibility companion designed for visually impaired users. It utilizes the multimodal capabilities of the Google Gemini Live API to provide real-time, conversational audio guidance, acting as a "human-like" guide walking arm-in-arm with the user.

## User Guide

This application is designed with "Blind-First" principles, utilizing high-contrast visuals, large touch targets, and continuous audio feedback.

### Getting Started
1.  **Launch**: Open the web application. You will hear: *"Hello there! I'm ready to help..."*
2.  **Start Session**: The entire screen is a start button. **Double-tap anywhere** on the screen to open the camera and connect to the guide.
3.  **Stop Session**: Locate the large red "STOP" button at the very bottom of the screen to end the connection.

### The Three Modes
SightGuide changes its personality based on your needs. You can switch modes using the buttons at the bottom of the screen or by **Swiping Left/Right**.

1.  **Navigation Mode (Default)**: *Your Walking Companion*
    *   **Purpose**: Walking, avoiding obstacles, and orientation.
    *   **Behavior**: Provides a "heartbeat" update every 3 seconds so you know you are connected. It will warn you of hazards like curbs or poles and confirm when the path is clear.
2.  **Reading Mode**: *Your Reader*
    *   **Purpose**: Reading mail, menus, signs, or screens.
    *   **Behavior**: Automatically detects text. It handles page turns and will politely ask you to move the camera if text is cut off.
3.  **Object Mode**: *Your Describer*
    *   **Purpose**: Finding lost items or exploring a room.
    *   **Behavior**: Describes the environment in detail ("There is a blue mug to your right") and helps you interact with objects.

### Gestures & Controls
*   **Pause/Resume**: **Double-tap** the center of the screen to pause the camera and silence the audio. Double-tap again to resume.
*   **Switch Mode**: **Swipe Left** or **Swipe Right** across the screen.
*   **Settings**: **Long-press** (hold down for 1 second) anywhere on the camera view to open the Settings menu.

### Settings Menu
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
    Install the necessary dependencies (React, Google GenAI SDK).
    ```bash
    npm install
    ```

3.  **Running the App**
    Start the development server:
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) (or the port specified by your bundler).

### Important Technical Notes
*   **Browser Permissions**: The app requires `Camera` and `Microphone` access. Modern browsers only allow this on **Secure Contexts** (HTTPS) or `localhost`.
*   **Audio Context**: The app uses the Web Audio API for real-time PCM audio streaming. Ensure the user interacts with the page (the "Double Tap to Start" screen) to unlock the AudioContext.
*   **Model**: This app is hardcoded to use `gemini-2.5-flash-native-audio-preview-09-2025` to support low-latency bidirectional audio/video streaming.