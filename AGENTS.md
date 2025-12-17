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
*   **Logic:** We simulate real-time transcription by slicing the audio into chunks.
    *   **Max Duration:** 3 minutes (180,000ms).
    *   **VAD (Voice Activity Detection):** Checks for silence every 100ms. If speech is followed by >3 seconds of silence, the chunk is cut and uploaded immediately to reduce latency.
    *   **Silence Skipping:** Chunks consisting of pure silence are discarded to save bandwidth.
*   **Limitation:** Diarization (Speaker ID) context is lost between chunks. "Speaker 1" in Chunk A might be "Speaker 1" in Chunk B, but the API does not guarantee consistency across separate requests.

### 3. API Integration
*   The client sends `multipart/form-data` requests.
*   **Parameters:**
    *   `model`: Set to the deployment name (e.g., `gpt-4o-transcribe-diarize`).
    *   `response_format`: Defaults to `"diarized_json"`.
*   **Retry Logic:** If the API returns a 400 error indicating `diarized_json` is unsupported (code: `unsupported_value`), the client automatically retries with `response_format="json"` (standard transcription). This supports models like `gpt-4o-transcribe` which do not support diarization.

## Testing
*   **Integration Tests:** Located in `verification/`. Use `playwright` to run them.
*   **Mocking:** Since the app requires a microphone and Azure keys, tests usually mock the `fetch` API and use Chrome flags (`--use-fake-device-for-media-stream`) to simulate audio input.
*   **Service Worker & Playwright:** The application registers a Service Worker (`sw.js`). When running Playwright tests that rely on network interception (`page.route`), the Service Worker can bypass these interceptions if it handles the fetch. To successfully mock API calls in Playwright, verify that the Service Worker is disabled or unregistered (e.g., via `page.add_init_script("delete navigator.serviceWorker;")`).

## Deployment
This is a static site. It can be deployed to GitHub Pages, Vercel, or any static host. Ensure `sw.js` and `manifest.json` are served correctly.
