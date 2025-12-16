import { SettingsManager } from './settings.js';
import { AudioManager } from './audio-manager.js';

const settingsManager = new SettingsManager();
const recordBtn = document.getElementById('record-btn');
const statusBar = document.getElementById('status-bar');
const transcriptContainer = document.getElementById('transcript-container');

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Registration Failed', err));
    });
}

// Check if settings exist on load
if (!settingsManager.isValid()) {
    document.getElementById('settings-modal').classList.remove('hidden');
}

// Initialize Audio Manager
const audioManager = new AudioManager(
    settingsManager,
    handleTranscriptResponse, // Callback for success
    updateStatus            // Callback for status
);

recordBtn.addEventListener('click', () => {
    if (recordBtn.classList.contains('start')) {
        startRecording();
    } else {
        stopRecording();
    }
});

function startRecording() {
    if (!settingsManager.isValid()) {
        alert('Please configure Azure settings first.');
        document.getElementById('settings-modal').classList.remove('hidden');
        return;
    }
    
    // UI Updates
    recordBtn.classList.remove('start');
    recordBtn.classList.add('stop');
    recordBtn.innerText = 'Stop Recording';
    
    audioManager.start();
}

function stopRecording() {
    // UI Updates
    recordBtn.classList.remove('stop');
    recordBtn.classList.add('start');
    recordBtn.innerText = 'Start Recording';
    
    audioManager.stop();
}

function updateStatus(msg) {
    statusBar.innerText = msg;
}

function handleTranscriptResponse(data) {
    // Remove placeholder if exists
    const placeholder = document.querySelector('.placeholder-text');
    if (placeholder) placeholder.remove();

    // Data can be standard { text: "..." } or diarized { entries: [...] } or { segments: [...] }
    if (data.segments && Array.isArray(data.segments)) {
        data.segments.forEach(seg => {
            appendSegment(seg.speaker || 'Unknown', seg.text);
        });
    } else if (data.text) {
        // Fallback or standard text
        appendSegment('Speaker', data.text);
    } else {
        console.warn("Unknown response format:", data);
    }
}

function appendSegment(speaker, text) {
    if (!text || text.trim() === "") return;

    const div = document.createElement('div');
    div.classList.add('transcript-segment');
    div.classList.add(`speaker-${speaker.replace(/\s+/g, '-')}`); // e.g. speaker-Speaker-1
    
    const label = document.createElement('span');
    label.classList.add('speaker-label');
    label.innerText = speaker;
    
    const content = document.createElement('div');
    content.innerText = text;

    div.appendChild(label);
    div.appendChild(content);
    
    transcriptContainer.appendChild(div);
    
    // Auto scroll
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}
