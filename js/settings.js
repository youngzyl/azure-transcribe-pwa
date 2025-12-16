export class SettingsManager {
    constructor() {
        this.endpointInput = document.getElementById('endpoint');
        this.keyInput = document.getElementById('api-key');
        this.deploymentInput = document.getElementById('deployment');
        this.apiVersionInput = document.getElementById('api-version');
        this.modal = document.getElementById('settings-modal');
        
        this.load();
        this.attachListeners();
    }

    load() {
        const stored = localStorage.getItem('azure_settings');
        if (stored) {
            const settings = JSON.parse(stored);
            this.endpointInput.value = settings.endpoint || '';
            this.keyInput.value = settings.key || '';
            this.deploymentInput.value = settings.deployment || 'gpt-4o-transcribe-diarize';
            this.apiVersionInput.value = settings.apiVersion || '2024-10-01-preview';
        }
    }

    save() {
        const settings = {
            endpoint: this.endpointInput.value.trim(),
            key: this.keyInput.value.trim(),
            deployment: this.deploymentInput.value.trim(),
            apiVersion: this.apiVersionInput.value.trim()
        };
        localStorage.setItem('azure_settings', JSON.stringify(settings));
        return settings;
    }

    getSettings() {
        const stored = localStorage.getItem('azure_settings');
        return stored ? JSON.parse(stored) : null;
    }

    attachListeners() {
        const form = document.getElementById('settings-form');
        const closeBtn = document.getElementById('close-settings');
        const settingsBtn = document.getElementById('settings-btn');

        settingsBtn.addEventListener('click', () => {
            this.modal.classList.remove('hidden');
        });

        closeBtn.addEventListener('click', () => {
            this.modal.classList.add('hidden');
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
            this.modal.classList.add('hidden');
            alert('Settings saved!');
        });
    }

    isValid() {
        const s = this.getSettings();
        return s && s.endpoint && s.key && s.deployment;
    }
}
