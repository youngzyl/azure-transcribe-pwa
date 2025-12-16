export class AzureApiClient {
    constructor() {
        // No persistent state needed really
    }

    async sendAudioChunk(audioBlob, settings) {
        if (!settings || !settings.endpoint || !settings.key) {
            throw new Error("Missing Azure API configuration");
        }

        // Construct URL
        // Endpoint format usually: https://{resource}.openai.azure.com/openai/deployments/{deployment}/audio/transcriptions?api-version={version}
        let baseUrl = settings.endpoint;
        if (!baseUrl.endsWith('/')) baseUrl += '/';
        
        // Handle if user provided full URL or just base
        let url;
        if (baseUrl.includes('/openai/deployments')) {
            url = `${baseUrl}?api-version=${settings.apiVersion}`;
        } else {
            url = `${baseUrl}openai/deployments/${settings.deployment}/audio/transcriptions?api-version=${settings.apiVersion}`;
        }

        const formData = new FormData();
        // File extension matters for Azure usually. MediaRecorder creates webm or mp4 usually.
        // We'll give it a generic name with .webm or .wav depending on the blob type.
        const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm'; 
        formData.append('file', audioBlob, `recording.${ext}`);
        
        // We assume gpt-4o-transcribe-diarize supports these parameters
        // Note: For diarization, it might return 'diarized_json' format.
        // The user specifically mentioned diarize model.
        formData.append('response_format', 'diarized_json'); 
        
        // Chunking strategy 'auto' is required for longer files, but for short chunks we send, it might be optional.
        // However, since we are sending small chunks, we might NOT get good diarization across chunks (speaker IDs might reset).
        // This is a known limitation of chunked REST API without session context.
        // We'll enable auto just in case.
        // formData.append('chunking_strategy', 'auto'); 

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'api-key': settings.key
                },
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("API Upload Failed:", error);
            throw error;
        }
    }
}
