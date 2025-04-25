/**
 * eventHandlers.js
 * アプリケーション全体のイベントハンドラー設定を管理するモジュール
 */
class EventHandlers {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (EventHandlers.#instance) {
            throw new Error('EventHandlersクラスは直接インスタンス化できません。EventHandlers.instanceを使用してください。');
        }
    }

    /**
     * シングルトンインスタンスを取得します
     * @returns {EventHandlers} EventHandlersのシングルトンインスタンス
     */
    static get getInstance() {
        if (!EventHandlers.#instance) {
            EventHandlers.#instance = new EventHandlers();
        }
        return EventHandlers.#instance;
    }

    /**
     * チャット関連のイベントをセットアップします
     */
    setupChatEvents() {
        if (!window.Elements.sendButton || !window.Elements.userInput || 
            !window.Elements.newChatButton || !window.Elements.clearHistoryButton) return;
        
        // 送信ボタンのクリックイベント
        window.Elements.sendButton.addEventListener('click', ChatActions.getInstance.sendMessage.bind(ChatActions.getInstance));

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        window.Elements.userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ChatActions.getInstance.sendMessage();
            }
        });
        
        // テキストエリアの入力イベント（自動リサイズ）
        window.Elements.userInput.addEventListener('input', () => UIUtils.getInstance.autoResizeTextarea(window.Elements.userInput));

        // 新しいチャットボタン
        window.Elements.newChatButton.addEventListener('click', ChatActions.getInstance.createNewConversation.bind(ChatActions.getInstance));

        // 履歴クリアボタン
        window.Elements.clearHistoryButton.addEventListener('click', ChatActions.getInstance.clearAllHistory.bind(ChatActions.getInstance));
    }

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
            SystemPromptModal.getInstance.showSystemPromptModal(
                window.AppState.systemPrompt, 
                window.AppState.systemPromptTemplates, 
                ModalHandlers.getInstance.onTemplateSelect, 
                ModalHandlers.getInstance.onTemplateDelete
            );
        });
        
        // API設定
        window.Elements.openApiSettings.addEventListener('click', () => {
            window.Elements.settingsMenu.style.display = 'none';
            ApiSettingsModal.getInstance.showApiKeyModal(window.AppState.apiSettings);
        });
        
        // 高度なプロンプト管理
        if (window.Elements.openPromptManager) {
            window.Elements.openPromptManager.addEventListener('click', () => {
                window.Elements.settingsMenu.style.display = 'none';
                PromptManagerModal.getInstance.showPromptManagerModal();
            });
        }
        
        // Confluence設定
        if (window.Elements.openConfluenceSettings) {
            window.Elements.openConfluenceSettings.addEventListener('click', () => {
                window.Elements.settingsMenu.style.display = 'none';
                // シングルトンパターンを使用して直接モーダルを表示
                ConfluenceSettingsModal.getInstance.show();
            });
        }
    }

    /**
     * ファイル関連のイベントをセットアップします
     */
    setupFileEvents() {
        if (!window.Elements.fileInput) return;
        
        // FileHandlerの初期化を行う
        if (FileHandler.getInstance && FileHandler.getInstance.init) {
            FileHandler.getInstance.init();
        }
        
        // ファイル選択イベント
        window.Elements.fileInput.addEventListener('change', FileHandler.getInstance.handleFileSelect.bind(FileHandler.getInstance));

        // カスタムイベントリスナー
        document.addEventListener('file-attached', e => window.AppState.currentAttachments = e.detail.attachments);
        document.addEventListener('attachment-removed', () => window.AppState.currentAttachments = []);
    }

    /**
     * グローバルなイベントをセットアップします
     */
    setupGlobalEvents() {
        // エラーアクションのイベント委任
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'showApiSettings') {
                ApiSettingsModal.getInstance.showApiKeyModal(window.AppState.apiSettings);
            }
        });
        
        // モデル選択変更イベント
        if (window.Elements.modelSelect) {
            window.Elements.modelSelect.addEventListener('change', function() {
                const currentConversation = window.AppState.getConversationById(window.AppState.currentConversationId);
                if (currentConversation) {
                    currentConversation.model = window.Elements.modelSelect.value;
                    Storage.getInstance.saveConversations(window.AppState.conversations);
                }
            });
        }

        // モーダルのEscapeキーイベント
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // 開いているモーダルを閉じる
                const modals = [
                    { id: 'systemPromptModal', hide: SystemPromptModal.getInstance.hideSystemPromptModal },
                    { id: 'apiKeyModal', hide: ApiSettingsModal.getInstance.hideApiKeyModal },
                    { id: 'renameChatModal', hide: RenameChatModal.getInstance.hideRenameChatModal }
                ];
                
                modals.forEach(modal => {
                    const element = UICache.getInstance.get(modal.id);
                    if (element && element.style.display === 'block' && typeof modal.hide === 'function') {
                        modal.hide();
                    }
                });
            }
        });
    }

    /**
     * モーダル関連のイベントをセットアップします
     */
    setupModalEvents() {
        this.#setupSystemPromptModal();
        this.#setupApiKeyModal();
        this.#setupRenameChatModal();
        this.#setupPromptManagerModal();
    }

    /**
     * システムプロンプトモーダルのイベントをセットアップします
     */
    #setupSystemPromptModal() {
        if (!window.Elements.saveSystemPrompt || !window.Elements.cancelSystemPrompt || 
            !window.Elements.saveNewSystemPrompt) return;
        
        // システムプロンプト保存
        window.Elements.saveSystemPrompt.addEventListener('click', () => {
            if (!window.Elements.systemPromptInput) return;
            
            window.AppState.systemPrompt = window.Elements.systemPromptInput.value.trim();
            Storage.getInstance.saveSystemPrompt(window.AppState.systemPrompt);
            SystemPromptModal.getInstance.hideSystemPromptModal();
        });
        
        // システムプロンプトキャンセル
        window.Elements.cancelSystemPrompt.addEventListener('click', SystemPromptModal.getInstance.hideSystemPromptModal.bind(SystemPromptModal.getInstance));
        
        // 新しいシステムプロンプト保存
        window.Elements.saveNewSystemPrompt.addEventListener('click', ModalHandlers.getInstance.saveNewSystemPrompt.bind(SystemPromptModal.getInstance));

        // 高度なプロンプト管理へ切り替え
        const switchToPromptManagerBtn = UICache.getInstance.get('switchToPromptManager');
        if (switchToPromptManagerBtn) {
            switchToPromptManagerBtn.addEventListener('click', () => {
                SystemPromptModal.getInstance.hideSystemPromptModal();
                PromptManagerModal.getInstance.showPromptManagerModal();
            });
        }
    }

    /**
     * APIキーモーダルのイベントをセットアップします
     */
    #setupApiKeyModal() {
        if (!window.Elements.saveApiKey || !window.Elements.cancelApiKey || 
            !window.Elements.openaiRadio || !window.Elements.azureRadio) return;
        
        // APIキー保存
        window.Elements.saveApiKey.addEventListener('click', ModalHandlers.getInstance.saveApiSettings);
        
        // APIキーキャンセル
        window.Elements.cancelApiKey.addEventListener('click', ApiSettingsModal.getInstance.hideApiKeyModal);
        
        // APIタイプ切り替え
        window.Elements.openaiRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleAzureSettings);
        window.Elements.azureRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleAzureSettings);
    }

    /**
     * チャット名変更モーダルのイベントをセットアップします
     */
    #setupRenameChatModal() {
        if (!window.Elements.saveRenameChat || !window.Elements.cancelRenameChat) return;
        
        // 保存ボタン
        window.Elements.saveRenameChat.addEventListener('click', ModalHandlers.getInstance.saveRenamedChat);
        
        // キャンセルボタン
        window.Elements.cancelRenameChat.addEventListener('click', RenameChatModal.getInstance.hideRenameChatModal);
    }

    /**
     * プロンプト管理モーダルのイベントをセットアップします
     */
    #setupPromptManagerModal() {
        // 閉じるボタンのイベントハンドラー
        const closePromptManagerBtn = UICache.getInstance.get('closePromptManager');
        if (closePromptManagerBtn) {
            closePromptManagerBtn.addEventListener('click', () => {
                PromptManagerModal.getInstance.hidePromptManagerModal();
            });
        }

        // システムプロンプト設定への切り替えボタンのイベントハンドラー
        const switchToSystemPromptBtn = UICache.getInstance.get('switchToSystemPrompt');
        if (switchToSystemPromptBtn) {
            switchToSystemPromptBtn.addEventListener('click', () => {
                PromptManagerModal.getInstance.hidePromptManagerModal();
                SystemPromptModal.getInstance.showSystemPromptModal(
                    window.AppState.systemPrompt,
                    window.AppState.systemPromptTemplates,
                    ModalHandlers.getInstance.onTemplateSelect,
                    ModalHandlers.getInstance.onTemplateDelete
                );
            });
        }

        // カテゴリ追加ボタンのイベントハンドラー
        const addCategoryBtn = UICache.getInstance.get('addCategoryButton');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => {
                PromptManagerModal.getInstance.handleAddCategory();
            });
        }

        // 新規プロンプト追加ボタンのイベントハンドラー
        const addPromptButton = UICache.getInstance.get('addPromptButton');
        if (addPromptButton) {
            addPromptButton.addEventListener('click', () => {
                PromptManagerModal.getInstance.showPromptEditModal(null);
            });
        }
    }
}
