import { SettingsManager } from './settings.js';
import { AudioManager } from './audio-manager.js';
import { AzureApiClient } from './api-client.js';

const settingsManager = new SettingsManager();
const apiClient = new AzureApiClient();

const recordBtn = document.getElementById('record-btn');
const summarizeBtn = document.getElementById('summarize-btn');
const statusBar = document.getElementById('status-bar');
const transcriptContainer = document.getElementById('transcript-container');
const summaryModal = document.getElementById('summary-modal');
const summaryText = document.getElementById('summary-text');
const closeSummaryBtn = document.getElementById('close-summary');
const copySummaryBtn = document.getElementById('copy-summary');

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

summarizeBtn.addEventListener('click', async () => {
    const text = getTranscriptText();
    if (!text) {
        alert("No transcript to summarize.");
        return;
    }

    if (!settingsManager.isValid()) {
        alert("Please configure settings first.");
        return;
    }
    const settings = settingsManager.getSettings();
    if (!settings.summaryDeployment) {
        alert("Please configure a Summary Deployment Name in settings.");
        return;
    }

    statusBar.innerText = "Summarizing...";
    summarizeBtn.disabled = true;

    try {
        const messages = [
            { role: "system", content: "You are a helpful assistant. Summarize the following transcript." },
            { role: "user", content: text }
        ];

        // Initialize empty summary
        showSummary("");

        await apiClient.postChatCompletion(messages, settings, (currentText) => {
            showSummary(currentText);
        });

        statusBar.innerText = "Idle";
    } catch (err) {
        console.error("Summarization failed:", err);
        statusBar.innerText = "Error: " + err.message;
        alert("Summarization failed: " + err.message);
    } finally {
        summarizeBtn.disabled = false;
    }
});

closeSummaryBtn.addEventListener('click', () => {
    summaryModal.classList.add('hidden');
});

copySummaryBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(summaryText.innerText);
    copySummaryBtn.innerText = "Copied!";
    setTimeout(() => copySummaryBtn.innerText = "Copy", 2000);
});

function showSummary(text) {
    summaryText.innerText = text;
    summaryModal.classList.remove('hidden');
}

function getTranscriptText() {
    const segments = transcriptContainer.querySelectorAll('.transcript-segment');
    let fullText = "";
    segments.forEach(seg => {
        const speaker = seg.querySelector('.speaker-label').innerText;
        const content = seg.querySelector('div').innerText;
        fullText += `${speaker}: ${content}\n`;
    });
    return fullText.trim();
}

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
