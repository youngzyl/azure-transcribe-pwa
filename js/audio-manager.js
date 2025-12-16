import { AzureApiClient } from './api-client.js';

export class AudioManager {
    constructor(settingsManager, onTranscriptCallback, onStatusCallback) {
        this.settingsManager = settingsManager;
        this.onTranscript = onTranscriptCallback;
        this.onStatus = onStatusCallback;
        this.apiClient = new AzureApiClient();
        
        this.mediaRecorder = null;
        this.stream = null;
        this.intervalId = null;
        this.isRecording = false;
        
        // Background keep-alive elements
        this.silentAudio = document.getElementById('silent-audio');
        
        this.CHUNK_DURATION_MS = 10000; // 10 seconds chunks
    }

    async start() {
        if (this.isRecording) return;

        try {
            // 1. Get Microphone Stream
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 2. Setup MediaRecorder
            // Prefer mp4/aac if available (better compatibility), else webm
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            }
            
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            this.chunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.chunks.push(e.data);
                }
            };

            // 3. Start Background Keep-Alive
            this.enableBackgroundMode();

            // 4. Start Recording Loop
            this.mediaRecorder.start();
            this.isRecording = true;
            this.onStatus('Recording...');

            // 5. Setup Interval to slice and send
            this.intervalId = setInterval(() => {
                this.stopAndSendChunk();
            }, this.CHUNK_DURATION_MS);

        } catch (err) {
            console.error("Error starting recording:", err);
            this.onStatus('Error: ' + err.message);
            alert("Could not start recording. Permission denied?");
        }
    }

    async stop() {
        if (!this.isRecording) return;

        clearInterval(this.intervalId);
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            // Final chunk
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        this.disableBackgroundMode();
        this.isRecording = false;
        this.onStatus('Idle');
    }

    stopAndSendChunk() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

        // Restarting the recorder is the easiest way to ensure clean file headers for every chunk
        this.mediaRecorder.stop();
        
        // Wait briefly for dataavailable to fire for the stop
        setTimeout(() => {
            const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
            this.chunks = []; // Reset buffer
            
            // Send to API
            this.uploadChunk(blob);

            // Restart recorder if still supposed to be recording
            if (this.isRecording) {
                this.mediaRecorder.start();
            }
        }, 100);
    }

    async uploadChunk(blob) {
        // Don't send empty or too small blobs
        if (blob.size < 1000) return;

        this.onStatus('Uploading chunk...');
        try {
            const settings = this.settingsManager.getSettings();
            const result = await this.apiClient.sendAudioChunk(blob, settings);
            
            this.onTranscript(result);
            this.onStatus('Recording...'); // Switch back to recording status
        } catch (error) {
            console.error("Upload failed", error);
            this.onStatus('Error uploading: ' + error.message);
        }
    }

    enableBackgroundMode() {
        if (this.silentAudio) {
            this.silentAudio.play().catch(e => console.log("Audio play failed", e));
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', function() {});
            navigator.mediaSession.setActionHandler('pause', function() {});
            navigator.mediaSession.metadata = new MediaMetadata({
                title: "Recording in Progress",
                artist: "AI Transcriber",
                album: "Background Service",
                artwork: [
                    { src: 'https://via.placeholder.com/96', sizes: '96x96', type: 'image/png' }
                ]
            });
        }
    }

    disableBackgroundMode() {
        if (this.silentAudio) {
            this.silentAudio.pause();
            this.silentAudio.currentTime = 0;
        }
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
        }
    }
}
