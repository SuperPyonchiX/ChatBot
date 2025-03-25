/**
 * api.js
 * OpenAIおよびAzure OpenAI APIとの通信機能を提供します
 */

// グローバルスコープに関数を公開
window.API = {
    callOpenAIAPI: async function(messages, model) {
        if (!window.apiSettings) {
            throw new Error('API設定が見つかりません');
        }
        
        if (!window.apiSettings.openaiApiKey && !window.apiSettings.azureApiKey) {
            throw new Error('APIキーが設定されていません');
        }
        
        if (window.apiSettings.apiType === 'azure' && !window.apiSettings.azureApiKey) {
            throw new Error('Azure APIキーが設定されていません');
        }
        
        if (window.apiSettings.apiType === 'openai' && !window.apiSettings.openaiApiKey) {
            throw new Error('OpenAI APIキーが設定されていません');
        }
    
        let endpoint, headers, body;
        
        if (window.apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            });
        } else {
            // Azure OpenAI API
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (!azureEndpoint) {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントが設定されていません`);
            }
            
            endpoint = azureEndpoint;
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                messages: messages,
                temperature: 0.7
            });
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
};