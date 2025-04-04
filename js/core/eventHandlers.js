/**
 * eventHandlers.js
 * アプリケーション全体のイベントハンドラー設定を管理するモジュール
 */

window.EventHandlers = {
    /**
     * チャット関連のイベントをセットアップします
     */
    setupChatEvents() {
        if (!window.Elements.sendButton || !window.Elements.userInput || 
            !window.Elements.newChatButton || !window.Elements.clearHistoryButton) return;
        
        // 送信ボタンのクリックイベント
        window.Elements.sendButton.addEventListener('click', window.ChatActions.sendMessage.bind(window.ChatActions));

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        window.Elements.userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.ChatActions.sendMessage();
            }
        });
        
        // テキストエリアの入力イベント（自動リサイズ）
        window.Elements.userInput.addEventListener('input', () => window.UIUtils.autoResizeTextarea(window.Elements.userInput));

        // 新しいチャットボタン
        window.Elements.newChatButton.addEventListener('click', window.ChatActions.createNewConversation.bind(window.ChatActions));

        // 履歴クリアボタン
        window.Elements.clearHistoryButton.addEventListener('click', window.ChatActions.clearAllHistory.bind(window.ChatActions));
    },

    /**
     * 設定関連のイベントをセットアップします
     */
    setupSettingsEvents() {
        if (!window.Elements.settingsButton || !window.Elements.settingsMenu || 
            !window.Elements.openSystemPromptSettings || !window.Elements.openApiSettings) return;
        
        // 設定ボタンのクリックでメニュー表示
        window.Elements.settingsButton.addEventListener('click', () => {
            window.Elements.settingsMenu.style.display = 
                window.Elements.settingsMenu.style.display === 'block' ? 'none' : 'block';
        });
        
        // ドキュメント内のクリックでメニューを閉じる
        document.addEventListener('click', e => {
            if (window.Elements.settingsMenu.style.display === 'block' && 
                !window.Elements.settingsButton.contains(e.target) && 
                !window.Elements.settingsMenu.contains(e.target)) {
                window.Elements.settingsMenu.style.display = 'none';
            }
        });
        
        // システムプロンプト設定
        window.Elements.openSystemPromptSettings.addEventListener('click', () => {
            window.Elements.settingsMenu.style.display = 'none';
            window.UI.showSystemPromptModal(
                window.AppState.systemPrompt, 
                window.AppState.promptTemplates, 
                window.ModalHandlers.onTemplateSelect, 
                window.ModalHandlers.onTemplateDelete
            );
        });
        
        // API設定
        window.Elements.openApiSettings.addEventListener('click', () => {
            window.Elements.settingsMenu.style.display = 'none';
            window.UI.showApiKeyModal(window.AppState.apiSettings);
        });
        
        // 高度なプロンプト管理
        if (window.Elements.openPromptManager) {
            window.Elements.openPromptManager.addEventListener('click', () => {
                window.Elements.settingsMenu.style.display = 'none';
                window.UI.showPromptManagerModal();
            });
        }
    },

    /**
     * ファイル関連のイベントをセットアップします
     */
    setupFileEvents() {
        if (!window.Elements.fileInput) return;
        
        // FileHandlerの初期化を行う
        if (window.FileHandler && window.FileHandler.init) {
            window.FileHandler.init();
        }
        
        // ファイル選択イベント
        window.Elements.fileInput.addEventListener('change', window.FileHandler.handleFileSelect.bind(window.FileHandler));

        // カスタムイベントリスナー
        document.addEventListener('file-attached', e => window.AppState.currentAttachments = e.detail.attachments);
        document.addEventListener('attachment-removed', () => window.AppState.currentAttachments = []);
    },

    /**
     * モーダル関連のイベントをセットアップします
     */
    setupModalEvents() {
        this.setupSystemPromptModal();
        this.setupApiKeyModal();
        this.setupRenameChatModal();
        this.setupPromptManagerModal();
    },

    /**
     * システムプロンプトモーダルのイベントをセットアップします
     */
    setupSystemPromptModal() {
        if (!window.Elements.saveSystemPrompt || !window.Elements.cancelSystemPrompt || 
            !window.Elements.saveNewTemplate) return;
        
        // システムプロンプト保存
        window.Elements.saveSystemPrompt.addEventListener('click', () => {
            if (!window.Elements.systemPromptInput) return;
            
            window.AppState.systemPrompt = window.Elements.systemPromptInput.value.trim();
            window.Storage.saveSystemPrompt(window.AppState.systemPrompt);
            window.UI.hideSystemPromptModal();
        });
        
        // システムプロンプトキャンセル
        window.Elements.cancelSystemPrompt.addEventListener('click', window.UI.hideSystemPromptModal);
        
        // 新しいテンプレート保存
        window.Elements.saveNewTemplate.addEventListener('click', window.ModalHandlers.saveNewTemplate.bind(window.ModalHandlers));

        // 高度なプロンプト管理へ切り替え
        const switchToPromptManagerBtn = document.getElementById('switchToPromptManager');
        if (switchToPromptManagerBtn) {
            switchToPromptManagerBtn.addEventListener('click', () => {
                window.UI.hideSystemPromptModal();
                window.UI.showPromptManagerModal();
            });
        }
    },

    /**
     * APIキーモーダルのイベントをセットアップします
     */
    setupApiKeyModal() {
        if (!window.Elements.saveApiKey || !window.Elements.cancelApiKey || 
            !window.Elements.openaiRadio || !window.Elements.azureRadio) return;
        
        // APIキー保存
        window.Elements.saveApiKey.addEventListener('click', window.ModalHandlers.saveApiSettings);
        
        // APIキーキャンセル
        window.Elements.cancelApiKey.addEventListener('click', window.UI.hideApiKeyModal);
        
        // APIタイプ切り替え
        window.Elements.openaiRadio.addEventListener('change', window.UI.toggleAzureSettings);
        window.Elements.azureRadio.addEventListener('change', window.UI.toggleAzureSettings);
    },

    /**
     * チャット名変更モーダルのイベントをセットアップします
     */
    setupRenameChatModal() {
        if (!window.Elements.saveRenameChat || !window.Elements.cancelRenameChat) return;
        
        // 保存ボタン
        window.Elements.saveRenameChat.addEventListener('click', window.ModalHandlers.saveRenamedChat);
        
        // キャンセルボタン
        window.Elements.cancelRenameChat.addEventListener('click', window.UI.hideRenameChatModal);
    },

    /**
     * プロンプト管理モーダルのイベントをセットアップします
     */
    setupPromptManagerModal() {
        // 閉じるボタンのイベントハンドラー
        const closePromptManagerBtn = document.getElementById('closePromptManager');
        if (closePromptManagerBtn) {
            closePromptManagerBtn.addEventListener('click', () => {
                window.UI.hidePromptManagerModal();
            });
        }

        // システムプロンプト設定への切り替えボタンのイベントハンドラー
        const switchToSystemPromptBtn = document.getElementById('switchToSystemPrompt');
        if (switchToSystemPromptBtn) {
            switchToSystemPromptBtn.addEventListener('click', () => {
                window.UI.hidePromptManagerModal();
                window.UI.showSystemPromptModal(
                    window.AppState.systemPrompt,
                    window.AppState.promptTemplates,
                    window.ModalHandlers.onTemplateSelect,
                    window.ModalHandlers.onTemplateDelete
                );
            });
        }
    },

    /**
     * グローバルなイベントをセットアップします
     */
    setupGlobalEvents() {
        // エラーアクションのイベント委任
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'showApiSettings') {
                window.UI.showApiKeyModal(window.AppState.apiSettings);
            }
        });
        
        // モデル選択変更イベント
        if (window.Elements.modelSelect) {
            window.Elements.modelSelect.addEventListener('change', function() {
                const currentConversation = window.AppState.getConversationById(window.AppState.currentConversationId);
                if (currentConversation) {
                    currentConversation.model = window.Elements.modelSelect.value;
                    window.Storage.saveConversations(window.AppState.conversations);
                }
            });
        }

        // モーダルのEscapeキーイベント
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // 開いているモーダルを閉じる
                const modals = [
                    { id: 'systemPromptModal', hide: window.UI.hideSystemPromptModal },
                    { id: 'apiKeyModal', hide: window.UI.hideApiKeyModal },
                    { id: 'renameChatModal', hide: window.UI.hideRenameChatModal }
                ];
                
                modals.forEach(modal => {
                    const element = document.getElementById(modal.id);
                    if (element && element.style.display === 'block' && typeof modal.hide === 'function') {
                        modal.hide();
                    }
                });
            }
        });
    }
};