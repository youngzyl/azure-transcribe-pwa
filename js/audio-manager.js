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
        
        // VAD (Voice Activity Detection)
        this.audioContext = null;
        this.analyser = null;
        this.vadIntervalId = null;
        this.lastSpeechTime = 0;
        this.hasSpeechInCurrentChunk = false;
        this.SILENCE_THRESHOLD = -50; // dB
        this.SILENCE_DURATION_MS = 3000; // 3 seconds silence to cut

        // Background keep-alive elements
        this.silentAudio = document.getElementById('silent-audio');
        
        this.CHUNK_DURATION_MS = 180000; // 3 minutes max chunk duration
    }

    async start() {
        if (this.isRecording) return;

        try {
            // 1. Get Microphone Stream
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 2. Setup VAD (Voice Activity Detection)
            this.setupVAD(this.stream);

            // 3. Setup MediaRecorder
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

            // 4. Start Background Keep-Alive
            this.enableBackgroundMode();

            // 5. Start Recording Loop
            this.mediaRecorder.start();
            this.isRecording = true;
            this.onStatus('Recording... (Listening for speech)');

            // Initialize state
            this.hasSpeechInCurrentChunk = false;
            this.lastSpeechTime = Date.now(); // Reset silence timer on start

            // 6. Setup Interval to slice and send (Max duration fallback)
            this.intervalId = setInterval(() => {
                this.stopAndSendChunk();
            }, this.CHUNK_DURATION_MS);

        } catch (err) {
            console.error("Error starting recording:", err);
            this.onStatus('Error: ' + err.message);
            alert("Could not start recording. Permission denied?");
        }
    }

    setupVAD(stream) {
        try {
            // Create AudioContext if not exists or suspended
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // Start monitoring loop
            this.vadIntervalId = setInterval(() => {
                this.checkVolume(dataArray);
            }, 100); // Check every 100ms
        } catch (e) {
            console.error("VAD Setup Failed", e);
        }
    }

    checkVolume(dataArray) {
        if (!this.analyser || !this.isRecording) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average volume (RMS-like)
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Convert to dB roughly: 20*log10(average / 255)
        // Or just use the raw average (0-255).
        // Silence is usually near 0. Speech is usually > 10-20.
        // Let's use a simple threshold for 0-255 scale.
        // -50dB is very quiet.
        // In Uint8 0-255, 10 is very quiet background noise.
        const SPEECH_THRESHOLD = 10;

        if (average > SPEECH_THRESHOLD) {
            this.lastSpeechTime = Date.now();
            if (!this.hasSpeechInCurrentChunk) {
                console.log("Speech detected!");
                this.hasSpeechInCurrentChunk = true;
                this.onStatus('Recording... (Speech detected)');
            }
        } else {
            // Silence
            const timeSinceSpeech = Date.now() - this.lastSpeechTime;

            if (this.hasSpeechInCurrentChunk && timeSinceSpeech > this.SILENCE_DURATION_MS) {
                // We had speech, but now it's been silent for > 3s.
                // Cut the chunk and upload.
                console.log(`Silence detected for ${this.SILENCE_DURATION_MS}ms. Cutting chunk.`);
                this.stopAndSendChunk();
            }
        }
    }

    async stop() {
        if (!this.isRecording) return;

        clearInterval(this.intervalId);
        clearInterval(this.vadIntervalId);
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            // Final chunk
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.disableBackgroundMode();
        this.isRecording = false;
        this.onStatus('Idle');
    }

    stopAndSendChunk() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

        // Capture the state *before* we restart logic, to decide if we upload
        const shouldUpload = this.hasSpeechInCurrentChunk;

        // Restarting the recorder is the easiest way to ensure clean file headers for every chunk
        this.mediaRecorder.stop();
        
        // Reset speech flag immediately for the new chunk (which starts after start())
        // But wait, the new chunk hasn't started yet.
        // We will reset it in the timeout.

        // Wait briefly for dataavailable to fire for the stop
        setTimeout(() => {
            const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
            this.chunks = []; // Reset buffer
            
            // Only upload if the chunk had speech
            if (shouldUpload) {
                this.uploadChunk(blob);
            } else {
                console.log("Skipping upload of silent chunk.");
            }

            // Restart recorder if still supposed to be recording
            if (this.isRecording) {
                this.mediaRecorder.start();
                this.hasSpeechInCurrentChunk = false; // Reset for new chunk
                this.lastSpeechTime = Date.now(); // Reset silence timer so we don't loop-cut silence
                this.onStatus('Recording... (Listening for speech)');
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
            this.onStatus('Recording... (Listening for speech)');
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
