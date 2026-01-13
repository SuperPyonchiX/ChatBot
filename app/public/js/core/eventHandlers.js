/**
 * eventHandlers.js
 * アプリケーション全体のイベントハンドラー設定を管理するモジュール
 */
class EventHandlers {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * プライベートコンストラクタ
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
     * メッセージ送信を処理します（UIの切り替えを含む）
     */
    async #handleSendMessage() {
        // 送信ボタンを停止ボタンに切り替え
        ChatUI.getInstance.showStopButton();

        try {
            await ChatActions.getInstance.sendMessage();
        } finally {
            // 送信完了後、送信ボタンに戻す
            ChatUI.getInstance.showSendButton();
        }
    }

    /**
     * チャット関連のイベントをセットアップします
     */
    setupChatEvents() {
        if (!window.Elements.sendButton || !window.Elements.userInput ||
            !window.Elements.newChatButton || !window.Elements.clearHistoryButton) return;

        // 会話検索イベント
        const chatSearchInput = document.getElementById('chatSearchInput');
        if (chatSearchInput) {
            chatSearchInput.addEventListener('input', (e) => {
                ChatHistory.getInstance.setSearchQuery(e.target.value);
            });
        }

        // 送信ボタンのクリックイベント（送信/停止の切り替え）
        window.Elements.sendButton.addEventListener('click', () => {
            if (ChatUI.getInstance.isStopMode()) {
                // 停止モードの場合：リクエストを中断
                window.AppState.abortCurrentRequest();
                ChatUI.getInstance.showSendButton();
            } else {
                // 送信モードの場合：メッセージを送信
                this.#handleSendMessage();
            }
        });

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        window.Elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // ストリーミング中は送信しない
                if (!window.AppState.isStreaming) {
                    this.#handleSendMessage();
                }
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

        // ナレッジベース (RAG)
        const openKnowledgeBaseBtn = document.getElementById('openKnowledgeBase');
        if (openKnowledgeBaseBtn) {
            openKnowledgeBaseBtn.addEventListener('click', () => {
                window.Elements.settingsMenu.style.display = 'none';
                KnowledgeBaseModal.getInstance.showModal();
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
                    // @ts-ignore - Storageはカスタムクラス（型定義あり）
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
        this.#setupKnowledgeBaseModal();
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
            // @ts-ignore - Storageはカスタムクラス（型定義あり）
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
            !window.Elements.openaiSystemRadio || !window.Elements.geminiSystemRadio ||
            !window.Elements.openaiRadio || !window.Elements.azureRadio) return;
        
        // APIキー保存
        window.Elements.saveApiKey.addEventListener('click', ModalHandlers.getInstance.saveApiSettings.bind(ModalHandlers.getInstance));
        
        // APIキーキャンセル
        window.Elements.cancelApiKey.addEventListener('click', ApiSettingsModal.getInstance.hideApiKeyModal);
        
        // API系統切り替え (OpenAI系 / Gemini / Claude)
        window.Elements.openaiSystemRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleApiSystem);
        window.Elements.geminiSystemRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleApiSystem);
        window.Elements.claudeSystemRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleApiSystem);
        
        // Claude Web検索設定
        if (window.Elements.claudeWebSearchToggle) {
            window.Elements.claudeWebSearchToggle.addEventListener('change', this.#toggleClaudeWebSearchSettings);
        }
        
        // OpenAI系内のサービス切り替え (OpenAI / Azure OpenAI)
        window.Elements.openaiRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleOpenAIService);
        window.Elements.azureRadio.addEventListener('change', ApiSettingsModal.getInstance.toggleOpenAIService);
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

        // 新規プロンプト追加ボタンのイベントハンドラー
        const addPromptButton = UICache.getInstance.get('addPromptButton');
        if (addPromptButton) {
            addPromptButton.addEventListener('click', () => {
                PromptManagerModal.getInstance.showPromptEditModal(null);
            });
        }

        // フィルターボタン（すべて）
        const showAllBtn = document.getElementById('showAllPrompts');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                PromptManagerModal.getInstance.handleFilterChange(false);
            });
        }

        // フィルターボタン（お気に入り）
        const showFavoritesBtn = document.getElementById('showFavorites');
        if (showFavoritesBtn) {
            showFavoritesBtn.addEventListener('click', () => {
                PromptManagerModal.getInstance.handleFilterChange(true);
            });
        }

        // ソート選択
        const sortSelect = document.getElementById('promptSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                PromptManagerModal.getInstance.handleSortChange(e.target.value);
            });
        }

        // 検索入力
        const searchInput = UICache.getInstance.get('promptSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                PromptManagerModal.getInstance.handleSearchChange(e.target.value);
            });
        }
    }

    /**
     * Claude Web検索設定の表示/非表示を切り替え
     */
    #toggleClaudeWebSearchSettings() {
        const toggle = window.Elements.claudeWebSearchToggle;
        const settings = window.Elements.claudeWebSearchSettings;

        if (toggle && settings) {
            if (toggle.checked) {
                settings.classList.remove('hidden');
            } else {
                settings.classList.add('hidden');
            }
        }
    }

    /**
     * ナレッジベースモーダルのイベントをセットアップします
     */
    #setupKnowledgeBaseModal() {
        // KnowledgeBaseModalのイベントリスナーを初期化
        if (typeof KnowledgeBaseModal !== 'undefined') {
            KnowledgeBaseModal.getInstance.initializeEventListeners();
        }
    }
}