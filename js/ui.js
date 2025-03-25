/**
 * ui.js
 * UI関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.UI = {
    // モバイル用のサイドバートグルボタンを作成
    createSidebarToggle: function() {
        const sidebar = document.querySelector('.sidebar');
        const appContainer = document.querySelector('.app-container');
        
        // トグルボタンの表示エリアを作成
        const toggleArea = document.createElement('div');
        toggleArea.classList.add('sidebar-toggle-area');
        
        // トグルボタンを作成
        const toggleButton = document.createElement('button');
        toggleButton.classList.add('sidebar-toggle');
        toggleButton.innerHTML = '<i class="fas fa-bars"></i>';

        // 保存された状態を復元
        const isCollapsed = window.Storage.loadSidebarState();
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            toggleButton.classList.add('sidebar-visible');
        }
        
        toggleButton.addEventListener('click', function() {
            const isNowCollapsed = sidebar.classList.contains('collapsed');
            if (isNowCollapsed) {
                sidebar.classList.remove('collapsed');
                toggleButton.classList.add('sidebar-visible');
                window.Storage.saveSidebarState(false);
            } else {
                sidebar.classList.add('collapsed');
                toggleButton.classList.remove('sidebar-visible');
                window.Storage.saveSidebarState(true);
            }
        });
        
        // チャットエリアのクリックでサイドバーを閉じる（モバイルのみ）
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
        
        // トグルボタンを表示エリアに追加
        toggleArea.appendChild(toggleButton);
        appContainer.appendChild(toggleArea);
    },

    // テキストエリアの高さを自動調整する関数
    autoResizeTextarea: function(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    },

    // APIキーモーダルを表示
    showApiKeyModal: function(apiSettings) {
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
    },

    // APIキーモーダルを非表示
    hideApiKeyModal: function() {
        const apiKeyModal = document.getElementById('apiKeyModal');
        apiKeyModal.classList.remove('show');
    },

    // Azure設定の表示/非表示を切り替え
    toggleAzureSettings: function() {
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
    },

    // チャットの名前変更モーダルを表示
    showRenameChatModal: function(conversation) {
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
    },

    // チャットの名前変更モーダルを非表示
    hideRenameChatModal: function() {
        const modal = document.getElementById('renameChatModal');
        modal.classList.remove('show');
    },

    // システムプロンプト設定モーダルを表示
    showSystemPromptModal: function(systemPrompt, loadPromptTemplatesCallback) {
        const systemPromptModal = document.getElementById('systemPromptModal');
        const systemPromptInput = document.getElementById('systemPromptInput');
        
        systemPromptModal.classList.add('show');
        systemPromptInput.value = systemPrompt;
        loadPromptTemplatesCallback();
    },

    // システムプロンプト設定モーダルを非表示
    hideSystemPromptModal: function() {
        const systemPromptModal = document.getElementById('systemPromptModal');
        systemPromptModal.classList.remove('show');
    },

    // テンプレート一覧を表示する関数
    updateTemplateList: function(promptTemplates, onTemplateSelect, onTemplateDelete) {
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
    },
    
    /**
     * ファイル添付ボタンと添付ファイル表示エリアを作成
     * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
     * @param {Function} onFileAttached - ファイル添付時のコールバック関数
     */
    createFileAttachmentUI: function(chatInputContainer, onFileAttached) {
        // ファイル入力要素を作成（非表示）
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileAttachment';
        fileInput.accept = 'image/*';  // 画像ファイルのみ許可
        fileInput.style.display = 'none';
        fileInput.multiple = false;    // 1つのファイルのみ
        
        // ファイル添付ボタンを作成
        const attachButton = document.createElement('button');
        attachButton.classList.add('attachment-button');
        attachButton.innerHTML = '<i class="fas fa-paperclip"></i>';
        attachButton.title = '画像を添付';
        
        // 添付ファイル表示エリアを作成
        const attachmentPreviewArea = document.createElement('div');
        attachmentPreviewArea.classList.add('attachment-preview-area');
        attachmentPreviewArea.style.display = 'none';
        
        // ファイル選択ダイアログを表示
        attachButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        // ファイル選択時の処理
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                try {
                    // ファイルをbase64エンコード
                    const base64Data = await window.API.encodeImageToBase64(file);
                    
                    // プレビュー表示
                    this.showAttachmentPreview(attachmentPreviewArea, file, base64Data);
                    
                    // コールバック関数を実行
                    if (onFileAttached) {
                        onFileAttached({
                            type: 'image',
                            name: file.name,
                            data: base64Data
                        });
                    }
                } catch (error) {
                    console.error('ファイルの処理中にエラーが発生しました:', error);
                    alert('ファイルの処理中にエラーが発生しました');
                }
            }
            
            // input要素をリセット（同じファイルを連続で選択できるように）
            fileInput.value = '';
        });
        
        // 要素を追加
        chatInputContainer.appendChild(fileInput);
        
        // 入力ボタングループに添付ボタンを追加
        const inputButtonGroup = chatInputContainer.querySelector('.input-button-group');
        if (inputButtonGroup) {
            // 送信ボタンの前に挿入
            const sendButton = inputButtonGroup.querySelector('.send-button');
            if (sendButton) {
                inputButtonGroup.insertBefore(attachButton, sendButton);
            } else {
                inputButtonGroup.appendChild(attachButton);
            }
        } else {
            chatInputContainer.appendChild(attachButton);
        }
        
        // 添付ファイル表示エリアを追加
        chatInputContainer.insertBefore(attachmentPreviewArea, inputButtonGroup || chatInputContainer.firstChild);
        
        return {
            fileInput,
            attachButton,
            attachmentPreviewArea
        };
    },
    
    /**
     * 添付ファイルのプレビューを表示
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     * @param {File} file - 添付ファイル
     * @param {string} base64Data - Base64エンコードされたファイルデータ
     */
    showAttachmentPreview: function(previewArea, file, base64Data) {
        previewArea.innerHTML = '';
        previewArea.style.display = 'flex';
        
        // プレビュー要素を作成
        const previewItem = document.createElement('div');
        previewItem.classList.add('attachment-preview-item');
        
        // 画像プレビュー
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = base64Data;
            img.alt = file.name;
            img.classList.add('attachment-preview-image');
            previewItem.appendChild(img);
        }
        
        // ファイル情報
        const fileInfo = document.createElement('div');
        fileInfo.classList.add('attachment-file-info');
        fileInfo.textContent = file.name;
        previewItem.appendChild(fileInfo);
        
        // 削除ボタン
        const removeButton = document.createElement('button');
        removeButton.classList.add('attachment-remove-button');
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.title = '添付を削除';
        
        removeButton.addEventListener('click', () => {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
            
            // 添付ファイル削除イベントを発火
            const removeEvent = new CustomEvent('attachment-removed');
            previewArea.dispatchEvent(removeEvent);
        });
        
        previewItem.appendChild(removeButton);
        previewArea.appendChild(previewItem);
    },
    
    /**
     * 添付ファイルをクリア
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     */
    clearAttachments: function(previewArea) {
        if (previewArea) {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
        }
    }
};