/**
 * ui.js
 * UI関連の機能を提供します
 */

// モバイル用のサイドバートグルボタンを作成
export function createSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const appContainer = document.querySelector('.app-container');
    
    // トグルボタンを作成
    const toggleButton = document.createElement('button');
    toggleButton.classList.add('sidebar-toggle');
    toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
    toggleButton.addEventListener('click', function() {
        sidebar.classList.toggle('show');
    });
    
    // チャットエリアのクリックでサイドバーを閉じる
    document.querySelector('.chat-container').addEventListener('click', function() {
        if (window.innerWidth <= 576 && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    });
    
    // ウィンドウサイズ変更時の処理
    window.addEventListener('resize', function() {
        if (window.innerWidth > 576) {
            sidebar.classList.remove('show');
        }
    });
    
    appContainer.appendChild(toggleButton);
}

// テキストエリアの高さを自動調整する関数
export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// APIキーモーダルを表示
export function showApiKeyModal(apiSettings) {
    const apiKeyModal = document.getElementById('apiKeyModal');
    apiKeyModal.classList.add('show');
    const azureApiKeyInput = document.getElementById('azureApiKeyInput');
    const openaiRadio = document.getElementById('openaiRadio');
    const azureRadio = document.getElementById('azureRadio');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const azureSettings = document.getElementById('azureSettings');
    const azureEndpointGpt4oMini = document.getElementById('azureEndpointGpt4oMini');
    const azureEndpointGpt4o = document.getElementById('azureEndpointGpt4o');
    const azureEndpointO1Mini = document.getElementById('azureEndpointO1Mini');
    const azureEndpointO1 = document.getElementById('azureEndpointO1');
    
    // OpenAIまたはAzureのAPIキーを表示
    if (apiSettings.apiType === 'azure') {
        azureRadio.checked = true;
        azureApiKeyInput.value = apiSettings.azureApiKey;
        document.getElementById('openaiSettings').classList.add('hidden');
        azureSettings.classList.remove('hidden');
        azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
        azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
        azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
        azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
    } else {
        openaiRadio.checked = true;
        apiKeyInput.value = apiSettings.openaiApiKey;
        document.getElementById('openaiSettings').classList.remove('hidden');
        azureSettings.classList.add('hidden');
    }
}

// APIキーモーダルを非表示
export function hideApiKeyModal() {
    const apiKeyModal = document.getElementById('apiKeyModal');
    apiKeyModal.classList.remove('show');
}

// Azure設定の表示/非表示を切り替え
export function toggleAzureSettings() {
    const openaiSettings = document.getElementById('openaiSettings');
    const azureSettings = document.getElementById('azureSettings');
    const azureRadio = document.getElementById('azureRadio');
    
    if (azureRadio.checked) {
        openaiSettings.classList.add('hidden');
        azureSettings.classList.remove('hidden');
    } else {
        openaiSettings.classList.remove('hidden');
        azureSettings.classList.add('hidden');
    }
}

// チャットの名前変更モーダルを表示
export function showRenameChatModal(conversation) {
    const modal = document.getElementById('renameChatModal');
    const titleInput = document.getElementById('chatTitleInput');
    
    // 現在のタイトルをセット
    titleInput.value = conversation.title || '新しいチャット';
    
    // 会話IDをモーダルに保存（データ属性を使用）
    modal.dataset.conversationId = conversation.id;
    
    // モーダルを表示
    modal.classList.add('show');
    
    // フォーカスを入力フィールドに設定
    titleInput.focus();
    titleInput.select();
}

// チャットの名前変更モーダルを非表示
export function hideRenameChatModal() {
    const modal = document.getElementById('renameChatModal');
    modal.classList.remove('show');
}

// システムプロンプト設定モーダルを表示
export function showSystemPromptModal(systemPrompt, loadPromptTemplatesCallback) {
    const systemPromptModal = document.getElementById('systemPromptModal');
    const systemPromptInput = document.getElementById('systemPromptInput');
    
    systemPromptModal.classList.add('show');
    systemPromptInput.value = systemPrompt;
    loadPromptTemplatesCallback();
}

// システムプロンプト設定モーダルを非表示
export function hideSystemPromptModal() {
    const systemPromptModal = document.getElementById('systemPromptModal');
    systemPromptModal.classList.remove('show');
}

// テンプレート一覧を表示する関数
export function updateTemplateList(promptTemplates, onTemplateSelect, onTemplateDelete) {
    // 既存のテンプレート一覧エリアを取得
    const templateListArea = document.getElementById('templateListArea');
    
    // テンプレート一覧をクリア
    templateListArea.innerHTML = '';
    
    // デフォルトテンプレートは削除不可
    const defaultTemplates = ['default', 'creative', 'technical'];
    
    // テンプレート一覧を表示
    Object.keys(promptTemplates).forEach(templateName => {
        const templateItem = document.createElement('div');
        templateItem.classList.add('template-item');
        
        const templateNameSpan = document.createElement('span');
        templateNameSpan.textContent = templateName;
        templateNameSpan.classList.add('template-name');
        templateItem.appendChild(templateNameSpan);
        
        // デフォルトテンプレート以外には削除ボタンを追加
        if (!defaultTemplates.includes(templateName)) {
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('template-delete-button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'テンプレートを削除';
            
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                onTemplateDelete(templateName);
            });
            
            templateItem.appendChild(deleteButton);
        }
        
        // テンプレートをクリックすると選択される
        templateItem.addEventListener('click', () => {
            onTemplateSelect(templateName);
        });
        
        templateListArea.appendChild(templateItem);
    });
}