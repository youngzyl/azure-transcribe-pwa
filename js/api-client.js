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
        
        // Add model parameter as per API requirements (using deployment name)
        formData.append('model', settings.deployment);

        // We assume gpt-4o-transcribe-diarize supports these parameters
        // Note: For diarization, it might return 'diarized_json' format.
        // The user specifically mentioned diarize model.
        formData.append('response_format', 'diarized_json'); 
        
        // Chunking strategy 'auto' is required for longer files, but for short chunks we send, it might be optional.
        // However, since we are sending small chunks, we might NOT get good diarization across chunks (speaker IDs might reset).
        // This is a known limitation of chunked REST API without session context.
        // We'll enable auto just in case.
        // formData.append('chunking_strategy', 'auto'); 

        const performRequest = async (currentFormData) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'api-key': settings.key
                },
                body: currentFormData
            });

            if (!response.ok) {
                const errText = await response.text();
                let isCompatibilityError = false;

                // Try to parse JSON to check for specific compatibility error
                try {
                    const errJson = JSON.parse(errText);
                    const errorObj = errJson.error || {};
                    if (response.status === 400 &&
                        errorObj.code === 'unsupported_value' &&
                        errorObj.param === 'response_format' &&
                        (errorObj.message && errorObj.message.includes('diarized_json'))) {
                        isCompatibilityError = true;
                    }
                } catch (e) {
                    // Ignore JSON parse error
                }

                // Fallback string check
                if (!isCompatibilityError && response.status === 400 &&
                    errText.includes("response_format 'diarized_json' is not compatible with model")) {
                    isCompatibilityError = true;
                }

                if (isCompatibilityError) {
                    return { retry: true, error: errText };
                }

                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            return { retry: false, data: await response.json() };
        };

        try {
            let result = await performRequest(formData);

            if (result.retry) {
                console.warn("Diarization not supported by this model, falling back to standard transcription.");
                // Update response_format to json (gpt-4o-transcribe supports json or text, not verbose_json)
                formData.set('response_format', 'json');
                result = await performRequest(formData);
                // If it fails again, it will throw normally
            }

            return result.data;

        } catch (error) {
            console.error("API Upload Failed:", error);
            throw error;
        }
    }
}
