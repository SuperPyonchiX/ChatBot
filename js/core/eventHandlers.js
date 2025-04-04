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
        window.Elements.sendButton.addEventListener('click', window.Chat.Actions.sendMessage.bind(window.Chat.Actions));

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        window.Elements.userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.Chat.Actions.sendMessage();
            }
        });
        
        // テキストエリアの入力イベント（自動リサイズ）
        window.Elements.userInput.addEventListener('input', () => window.UI.Utils.autoResizeTextarea(window.Elements.userInput));

        // 新しいチャットボタン
        window.Elements.newChatButton.addEventListener('click', window.Chat.Actions.createNewConversation.bind(window.Chat.Actions));

        // 履歴クリアボタン
        window.Elements.clearHistoryButton.addEventListener('click', window.Chat.Actions.clearAllHistory.bind(window.Chat.Actions));
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
            window.UI.Core.Modal.showSystemPromptModal(
                window.AppState.systemPrompt, 
                window.AppState.promptTemplates, 
                window.UI.Core.Modal.Handlers.onTemplateSelect, 
                window.UI.Core.Modal.Handlers.onTemplateDelete
            );
        });
        
        // API設定
        window.Elements.openApiSettings.addEventListener('click', () => {
            window.Elements.settingsMenu.style.display = 'none';
            window.UI.Core.Modal.showApiKeyModal(window.AppState.apiSettings);
        });
        
        // 高度なプロンプト管理
        if (window.Elements.openPromptManager) {
            window.Elements.openPromptManager.addEventListener('click', () => {
                window.Elements.settingsMenu.style.display = 'none';
                window.UI.Core.Modal.showPromptManagerModal();
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
            window.UI.Core.Modal.hideSystemPromptModal();
        });
        
        // システムプロンプトキャンセル
        window.Elements.cancelSystemPrompt.addEventListener('click', window.UI.Core.Modal.hideSystemPromptModal);
        
        // 新しいテンプレート保存
        window.Elements.saveNewTemplate.addEventListener('click', window.UI.Core.Modal.Handlers.saveNewTemplate.bind(window.UI.Core.Modal.Handlers));

        // 高度なプロンプト管理へ切り替え
        const switchToPromptManagerBtn =window.UI.Cache.get('switchToPromptManager');
        if (switchToPromptManagerBtn) {
            switchToPromptManagerBtn.addEventListener('click', () => {
                window.UI.Core.Modal.hideSystemPromptModal();
                window.UI.Core.Modal.showPromptManagerModal();
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
        window.Elements.saveApiKey.addEventListener('click', window.UI.Core.Modal.Handlers.saveApiSettings);
        
        // APIキーキャンセル
        window.Elements.cancelApiKey.addEventListener('click', window.UI.Core.Modal.hideApiKeyModal);
        
        // APIタイプ切り替え
        window.Elements.openaiRadio.addEventListener('change', window.UI.Core.Modal.toggleAzureSettings);
        window.Elements.azureRadio.addEventListener('change', window.UI.Core.Modal.toggleAzureSettings);
    },

    /**
     * チャット名変更モーダルのイベントをセットアップします
     */
    setupRenameChatModal() {
        if (!window.Elements.saveRenameChat || !window.Elements.cancelRenameChat) return;
        
        // 保存ボタン
        window.Elements.saveRenameChat.addEventListener('click', window.UI.Core.Modal.Handlers.saveRenamedChat);
        
        // キャンセルボタン
        window.Elements.cancelRenameChat.addEventListener('click', window.UI.Core.Modal.hideRenameChatModal);
    },

    /**
     * プロンプト管理モーダルのイベントをセットアップします
     */
    setupPromptManagerModal() {
        // 閉じるボタンのイベントハンドラー
        const closePromptManagerBtn =window.UI.Cache.get('closePromptManager');
        if (closePromptManagerBtn) {
            closePromptManagerBtn.addEventListener('click', () => {
                window.UI.Core.Modal.hidePromptManagerModal();
            });
        }

        // システムプロンプト設定への切り替えボタンのイベントハンドラー
        const switchToSystemPromptBtn =window.UI.Cache.get('switchToSystemPrompt');
        if (switchToSystemPromptBtn) {
            switchToSystemPromptBtn.addEventListener('click', () => {
                window.UI.Core.Modal.hidePromptManagerModal();
                window.UI.Core.Modal.showSystemPromptModal(
                    window.AppState.systemPrompt,
                    window.AppState.promptTemplates,
                    window.UI.Core.Modal.Handlers.onTemplateSelect,
                    window.UI.Core.Modal.Handlers.onTemplateDelete
                );
            });
        }

        // 新規プロンプト追加ボタンのイベントハンドラー
        const addPromptButton =window.UI.Cache.get('addPromptButton');
        if (addPromptButton) {
            addPromptButton.addEventListener('click', () => {
                window.UI.Core.Modal.showPromptEditModal(null);
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
                window.UI.Core.Modal.showApiKeyModal(window.AppState.apiSettings);
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
                    { id: 'systemPromptModal', hide: window.UI.Core.Modal.hideSystemPromptModal },
                    { id: 'apiKeyModal', hide: window.UI.Core.Modal.hideApiKeyModal },
                    { id: 'renameChatModal', hide: window.UI.Core.Modal.hideRenameChatModal }
                ];
                
                modals.forEach(modal => {
                    const element =window.UI.Cache.get(modal.id);
                    if (element && element.style.display === 'block' && typeof modal.hide === 'function') {
                        modal.hide();
                    }
                });
            }
        });
    }
};