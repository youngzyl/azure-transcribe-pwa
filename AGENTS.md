# AI Transcriber PWA - Agent Guide

This file contains instructions and context for AI agents working on this repository.

## Project Overview
This is a mobile-first Progressive Web Application (PWA) designed to record audio and transcribe it using **Azure OpenAI's `gpt-4o-transcribe-diarize` model**.

## Architecture
-   **Stack:** HTML5, Vanilla JavaScript (ES Modules), CSS3.
-   **Type:** Client-side PWA. No custom backend.
-   **Storage:** `localStorage` is used to store the user's Azure API Endpoint and Key.

## Critical Implementation Details

### 1. Background Recording (Mobile)
Mobile browsers (especially iOS Safari and Android Chrome) aggressively mute or pause the microphone when a tab goes into the background or the screen locks.
**Workaround:** We use a **Silent Audio Loop** (`<audio id="silent-audio">`) combined with the `MediaSession` API.
*   **Do not remove** the silent audio element or the logic in `AudioManager.enableBackgroundMode()`.
*   This trick fools the browser into thinking the user is "listening" to music, which keeps the `AudioContext` and `MediaRecorder` active.

### 2. "Real-time" Simulation
The `gpt-4o-transcribe-diarize` model is a REST API (file-based), not a streaming WebSocket API.
*   **Logic:** We simulate real-time transcription by slicing the audio into **3-minute chunks** in `AudioManager`.
*   **Limitation:** Diarization (Speaker ID) context is lost between chunks. "Speaker 1" in Chunk A might be "Speaker 1" in Chunk B, but the API does not guarantee consistency across separate requests.

### 3. API Integration
*   The client sends `multipart/form-data` requests.
*   It expects `response_format="diarized_json"`.

## Testing
*   **Integration Tests:** Located in `verification/`. Use `playwright` to run them.
*   **Mocking:** Since the app requires a microphone and Azure keys, tests usually mock the `fetch` API and use Chrome flags (`--use-fake-device-for-media-stream`) to simulate audio input.

## Deployment
This is a static site. It can be deployed to GitHub Pages, Vercel, or any static host. Ensure `sw.js` and `manifest.json` are served correctly.
