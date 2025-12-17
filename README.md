# Azure AI Transcriber

A web-based Progressive Web App (PWA) that records audio from your microphone and transcribes it using Azure OpenAI's transcription capabilities, including speaker diarization.

## Features

- **Audio Recording**: Captures audio directly from the browser.
- **Azure OpenAI Integration**: Sends audio chunks to your Azure OpenAI Whisper deployment for accurate transcription.
- **Speaker Diarization**: Identifies and labels different speakers in the conversation (requires a model/deployment that supports `diarized_json` response format, e.g., `gpt-4o-transcribe-diarize`).
- **Automatic Fallback**: If the configured model (e.g., `gpt-4o-transcribe`) does not support diarization, the app automatically switches to standard transcription (`json` format) to ensure recording continues.
- **Progressive Web App (PWA)**: Can be installed on devices and supports background recording on supported platforms.
- **Real-time-ish Updates**: Uploads audio in 10-second chunks for near real-time transcription updates.

## Prerequisites

To use this application, you need access to an **Azure OpenAI Service** resource with a model deployed that supports audio transcription.

1. **Azure OpenAI Resource**: Create one in the Azure Portal.
2. **Model Deployment**: Deploy a model capable of transcription (e.g., `whisper`). Ensure your deployment supports the `diarized_json` response format if you want speaker labels.

## Getting Started

### Running Locally

Since this project uses ES Modules, you need to serve it using a local web server (opening `index.html` directly in the file explorer might not work due to CORS/Module restrictions).

1. Clone the repository.
2. Serve the directory using a static file server. For example:
   - Python: `python3 -m http.server 8000`
   - Node (http-server): `npx http-server`
   - VS Code: Use the "Live Server" extension.
3. Open your browser and navigate to `http://localhost:8000` (or whatever port your server uses).

### Configuration

On the first load, the **Settings** modal will appear. You need to provide:

- **Azure Endpoint URL**: The base URL of your Azure OpenAI resource (e.g., `https://my-resource.openai.azure.com`).
- **Deployment Name**: The name of your model deployment (e.g., `gpt-4o-transcribe-diarize` or `my-whisper-model`).
- **API Key**: One of the keys for your Azure OpenAI resource.
- **API Version**: The API version to use (default: `2024-10-01-preview`).

These settings are saved in your browser's `localStorage`.

## Usage

1. Configure your Azure settings.
2. Click **Start Recording**.
3. Speak into your microphone. The app will record in 10-second chunks and upload them.
4. Transcripts will appear in the main window as they are processed.
5. Click **Stop Recording** to finish.

## Limitations

- **Chunked Diarization**: Since audio is sent in independent chunks, speaker IDs (e.g., "Speaker 1") may not persist across chunks. "Speaker 1" in the first 10 seconds might be labeled "Speaker 1" in the next chunk, but the model treats them as separate requests context-wise.
- **Browser Permissions**: Requires microphone access.
