/**
 * main.js
 * アプリケーションのエントリーポイントとなるファイルです
 */

document.addEventListener('DOMContentLoaded', function() {
    // アプリケーションの状態管理
    const AppState = {
        conversations: [],
        currentConversationId: null,
        apiSettings: window.Storage.loadApiSettings(),
        systemPrompt: window.Storage.loadSystemPrompt(),
        promptTemplates: window.Storage.loadPromptTemplates(),
        currentAttachments: [], // 添付ファイルを保存する配列

        /**
         * 指定したIDの会話を取得します
         * @param {string} id - 会話ID
         * @returns {Object|null} - 会話オブジェクトまたはnull
         */
        getConversationById(id) {
            return this.conversations.find(conv => conv.id === id);
        },

        /**
         * グローバル設定を更新します
         */
        updateGlobalSettings() {
            window.apiSettings = this.apiSettings;
        }
    };

    // DOM要素
    const Elements = {
        // チャット関連
        chatMessages: document.getElementById('chatMessages'),
        userInput: document.getElementById('userInput'),
        sendButton: document.getElementById('sendButton'),
        modelSelect: document.getElementById('modelSelect'),
        chatHistory: document.getElementById('chatHistory'),
        chatInputContainer: document.getElementById('chatInputContainer'),
        
        // ボタン関連
        newChatButton: document.getElementById('newChatButton'),
        clearHistoryButton: document.getElementById('clearHistoryButton'),
        settingsButton: document.getElementById('settingsButton'),
        settingsMenu: document.getElementById('settingsMenu'),
        openSystemPromptSettings: document.getElementById('openSystemPromptSettings'),
        openApiSettings: document.getElementById('openApiSettings'),
        
        // ファイル関連
        fileInput: document.getElementById('fileInput'),
        
        // システムプロンプト関連
        systemPromptModal: document.getElementById('systemPromptModal'),
        systemPromptInput: document.getElementById('systemPromptInput'),
        saveSystemPrompt: document.getElementById('saveSystemPrompt'),
        cancelSystemPrompt: document.getElementById('cancelSystemPrompt'),
        saveNewTemplate: document.getElementById('saveNewTemplate'),
        newTemplateName: document.getElementById('newTemplateName'),
        
        // API設定関連
        apiKeyModal: document.getElementById('apiKeyModal'),
        saveApiKey: document.getElementById('saveApiKey'),
        cancelApiKey: document.getElementById('cancelApiKey'),
        openaiRadio: document.getElementById('openaiRadio'),
        azureRadio: document.getElementById('azureRadio'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        azureApiKeyInput: document.getElementById('azureApiKeyInput'),
        azureEndpointGpt4oMini: document.getElementById('azureEndpointGpt4oMini'),
        azureEndpointGpt4o: document.getElementById('azureEndpointGpt4o'),
        azureEndpointO1Mini: document.getElementById('azureEndpointO1Mini'),
        azureEndpointO1: document.getElementById('azureEndpointO1'),
        
        // チャット名前変更関連
        saveRenameChat: document.getElementById('saveRenameChat'),
        cancelRenameChat: document.getElementById('cancelRenameChat'),
        renameChatModal: document.getElementById('renameChatModal'),
        chatTitleInput: document.getElementById('chatTitleInput')
    };

    // グローバルなapiSettingsを設定
    AppState.updateGlobalSettings();

    // モバイル用のサイドバートグルボタンを追加
    window.UI.createSidebarToggle();

    // 初期化
    init();

    // 外部ライブラリの読み込み - Markdown用
    window.Markdown.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
        .then(() => {
            console.log('Marked.js loaded successfully');
            window.Markdown.initializeMarkdown();
        })
        .catch(err => console.error('Failed to load Marked.js:', err));

    /**
     * アプリケーションを初期化します
     */
    function init() {
        // API設定がなければモーダルを表示
        if (!AppState.apiSettings.openaiApiKey && !AppState.apiSettings.azureApiKey) {
            window.UI.showApiKeyModal(AppState.apiSettings);
        }

        // 会話の履歴を読み込む
        loadConversations();

        // イベントリスナーのセットアップ
        setupEventListeners();
    }

    /**
     * 会話履歴を読み込みます
     */
    function loadConversations() {
        const savedConversations = window.Storage.loadConversations();
        if (savedConversations && savedConversations.length > 0) {
            AppState.conversations = savedConversations;
            renderChatHistory();
        }

        AppState.currentConversationId = window.Storage.loadCurrentConversationId();

        // 新しい会話を作成または既存の会話を読み込む
        if (AppState.conversations.length === 0) {
            createNewConversation();
        } else {
            loadCurrentConversation();
        }
    }

    /**
     * イベントリスナーをセットアップします
     */
    function setupEventListeners() {
        setupChatEvents();
        setupSettingsEvents();
        setupFileEvents();
        setupModalEvents();
        setupGlobalEvents();
    }

    /**
     * チャット関連のイベントをセットアップします
     */
    function setupChatEvents() {
        // 送信ボタンのクリックイベント
        Elements.sendButton.addEventListener('click', sendMessage);

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        Elements.userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // テキストエリアの入力イベント（自動リサイズ）
        Elements.userInput.addEventListener('input', () => window.UI.autoResizeTextarea(Elements.userInput));

        // 新しいチャットボタン
        Elements.newChatButton.addEventListener('click', createNewConversation);

        // 履歴クリアボタン
        Elements.clearHistoryButton.addEventListener('click', clearAllHistory);
    }

    /**
     * 設定関連のイベントをセットアップします
     */
    function setupSettingsEvents() {
        // 設定メニューのイベントリスナー
        Elements.settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = Elements.settingsMenu.classList.contains('show');
            // 一旦すべてのメニューを閉じる
            document.querySelectorAll('.settings-menu').forEach(menu => menu.classList.remove('show'));
            if (!isOpen) {
                Elements.settingsMenu.classList.add('show');
            }
        });

        // システムプロンプト設定を開く
        Elements.openSystemPromptSettings.addEventListener('click', () => {
            Elements.settingsMenu.classList.remove('show');
            window.UI.showSystemPromptModal(AppState.systemPrompt, loadPromptTemplates);
        });

        // API設定を開く
        Elements.openApiSettings.addEventListener('click', () => {
            Elements.settingsMenu.classList.remove('show');
            window.UI.showApiKeyModal(AppState.apiSettings);
        });
    }

    /**
     * ファイル関連のイベントをセットアップします
     */
    function setupFileEvents() {
        // ファイル選択イベント
        Elements.fileInput.addEventListener('change', window.FileHandler.handleFileSelect.bind(window.FileHandler));

        // ファイル添付イベント
        document.addEventListener('file-attached', function(e) {
            AppState.currentAttachments = e.detail.attachments;
        });

        // ファイル削除イベント
        document.addEventListener('attachment-removed', function() {
            AppState.currentAttachments = [];
        });
    }

    /**
     * モーダル関連のイベントをセットアップします
     */
    function setupModalEvents() {
        // APIキー関連
        Elements.openaiRadio.addEventListener('change', window.UI.toggleAzureSettings);
        Elements.azureRadio.addEventListener('change', window.UI.toggleAzureSettings);
        Elements.saveApiKey.addEventListener('click', saveApiSettings);
        Elements.cancelApiKey.addEventListener('click', window.UI.hideApiKeyModal);

        // システムプロンプト関連
        Elements.saveSystemPrompt.addEventListener('click', () => {
            AppState.systemPrompt = Elements.systemPromptInput.value;
            window.Storage.saveSystemPrompt(AppState.systemPrompt);
            window.UI.hideSystemPromptModal();
        });

        Elements.cancelSystemPrompt.addEventListener('click', () => {
            window.UI.hideSystemPromptModal();
        });

        // 新規テンプレートとして保存
        Elements.saveNewTemplate.addEventListener('click', () => {
            const name = Elements.newTemplateName.value.trim();
            if (name) {
                AppState.promptTemplates[name] = Elements.systemPromptInput.value;
                window.Storage.savePromptTemplates(AppState.promptTemplates);
                loadPromptTemplates();
                Elements.newTemplateName.value = '';
            }
        });

        // 名前変更モーダルの保存ボタン
        Elements.saveRenameChat.addEventListener('click', saveRenamedChat);
        
        // 名前変更モーダルのキャンセルボタン
        Elements.cancelRenameChat.addEventListener('click', window.UI.hideRenameChatModal);
    }

    /**
     * グローバルなイベントをセットアップします
     */
    function setupGlobalEvents() {
        // 画面のどこかをクリックしたらメニューを閉じる
        document.addEventListener('click', (e) => {
            if (!Elements.settingsButton.contains(e.target) && !Elements.settingsMenu.contains(e.target)) {
                Elements.settingsMenu.classList.remove('show');
            }
        });

        // エラー時のAPIキー設定ボタンイベント処理
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'showApiSettings') {
                window.UI.showApiKeyModal(AppState.apiSettings);
            }
        });
    }

    /**
     * チャットの名前を保存します
     */
    function saveRenamedChat() {
        const conversationId = Elements.renameChatModal.dataset.conversationId;
        const newTitle = Elements.chatTitleInput.value.trim();
        
        // 新しいタイトルが空でないことを確認
        if (newTitle) {
            // 該当する会話のタイトルを更新
            const conversation = AppState.getConversationById(conversationId);
            if (conversation) {
                conversation.title = newTitle;
                window.Storage.saveConversations(AppState.conversations);
                renderChatHistory();
            }
        }
        
        // モーダルを閉じる
        window.UI.hideRenameChatModal();
    }

    /**
     * メッセージを送信します
     */
    async function sendMessage() {
        const currentConversation = AppState.getConversationById(AppState.currentConversationId);
        if (!currentConversation) return;
        
        // FileHandlerから現在の添付ファイルを取得
        const apiAttachments = await window.FileHandler.getAttachmentsForAPI();
        
        // 添付ファイルの参照を保持
        const attachmentsToSend = apiAttachments.length > 0 ? apiAttachments : AppState.currentAttachments;
        
        // 送信前に添付ファイルをクリア（ユーザーから見て即座に添付が消える）
        AppState.currentAttachments = [];
        window.FileHandler.clearSelectedFiles();
        
        const result = await window.Chat.sendMessage(
            Elements.userInput, 
            Elements.chatMessages, 
            currentConversation, 
            AppState.apiSettings, 
            AppState.systemPrompt,
            attachmentsToSend // 保持した添付ファイルを送信
        );
        
        if (result.titleUpdated) {
            renderChatHistory();
        }
        if (!result.error) {
            // 会話を保存
            window.Storage.saveConversations(AppState.conversations);
        }
    }

    /**
     * API設定を保存します
     */
    function saveApiSettings() {
        if (Elements.openaiRadio.checked) {
            AppState.apiSettings.openaiApiKey = Elements.apiKeyInput.value.trim();
            AppState.apiSettings.apiType = 'openai';
        } else {
            AppState.apiSettings.azureApiKey = Elements.azureApiKeyInput.value.trim();
            AppState.apiSettings.apiType = 'azure';
            AppState.apiSettings.azureEndpoints['gpt-4o-mini'] = Elements.azureEndpointGpt4oMini.value.trim();
            AppState.apiSettings.azureEndpoints['gpt-4o'] = Elements.azureEndpointGpt4o.value.trim();
            AppState.apiSettings.azureEndpoints['o1-mini'] = Elements.azureEndpointO1Mini.value.trim();
            AppState.apiSettings.azureEndpoints['o1'] = Elements.azureEndpointO1.value.trim();
        }

        // グローバル設定を更新
        AppState.updateGlobalSettings();

        // ローカルストレージに保存
        window.Storage.saveApiSettings(AppState.apiSettings);
        window.UI.hideApiKeyModal();
    }

    /**
     * 現在の会話を読み込みます
     */
    function loadCurrentConversation() {
        if (!AppState.currentConversationId || !AppState.getConversationById(AppState.currentConversationId)) {
            AppState.currentConversationId = AppState.conversations[0].id;
        }

        // 会話履歴から現在の会話を選択状態にする
        window.Chat.updateActiveChatInHistory(AppState.currentConversationId);

        // チャットメッセージを表示
        window.Chat.displayConversation(
            AppState.getConversationById(AppState.currentConversationId),
            Elements.chatMessages,
            Elements.modelSelect
        );
    }

    /**
     * プロンプトテンプレートを読み込みます
     */
    function loadPromptTemplates() {
        // テンプレート一覧を更新
        window.UI.updateTemplateList(
            AppState.promptTemplates, 
            (templateName) => {
                Elements.systemPromptInput.value = AppState.promptTemplates[templateName];
            },
            (templateName) => {
                deletePromptTemplate(templateName);
            }
        );
    }

    /**
     * テンプレートを削除します
     * @param {string} templateName - 削除するテンプレートの名前
     */
    function deletePromptTemplate(templateName) {
        // デフォルトテンプレートは削除不可
        const defaultTemplates = ['default', 'creative', 'technical'];
        if (defaultTemplates.includes(templateName)) {
            alert('デフォルトテンプレートは削除できません');
            return;
        }
        
        // 削除確認
        if (confirm(`テンプレート「${templateName}」を削除してもよろしいですか？`)) {
            // 選択中のテンプレートが削除対象の場合はデフォルトに変更
            if (Elements.systemPromptInput.value === AppState.promptTemplates[templateName]) {
                Elements.systemPromptInput.value = AppState.promptTemplates['default'];
            }
            
            // テンプレートを削除
            delete AppState.promptTemplates[templateName];
            window.Storage.savePromptTemplates(AppState.promptTemplates);
            
            // テンプレート一覧を更新
            loadPromptTemplates();
        }
    }

    /**
     * 会話を切り替えます
     * @param {string} conversationId - 切り替える会話のID
     */
    function switchConversation(conversationId) {
        AppState.currentConversationId = conversationId;
        window.Storage.saveCurrentConversationId(AppState.currentConversationId);
        
        window.Chat.updateActiveChatInHistory(AppState.currentConversationId);
        window.Chat.displayConversation(
            AppState.getConversationById(AppState.currentConversationId),
            Elements.chatMessages,
            Elements.modelSelect
        );
    }

    /**
     * 新しい会話を作成します
     */
    function createNewConversation() {
        const newConversation = {
            id: Date.now().toString(),
            title: '新しいチャット',
            messages: [
                {
                    role: 'system',
                    content: AppState.systemPrompt
                }
            ],
            model: Elements.modelSelect.value
        };
        
        AppState.conversations.unshift(newConversation);
        window.Storage.saveConversations(AppState.conversations);
        
        AppState.currentConversationId = newConversation.id;
        window.Storage.saveCurrentConversationId(AppState.currentConversationId);
        
        renderChatHistory();
        window.Chat.displayConversation(newConversation, Elements.chatMessages, Elements.modelSelect);
    }

    /**
     * 会話履歴を表示します
     */
    function renderChatHistory() {
        window.Chat.renderChatHistory(
            AppState.conversations, 
            AppState.currentConversationId, 
            Elements.chatHistory, 
            switchConversation, 
            window.UI.showRenameChatModal, 
            deleteConversation
        );
    }

    /**
     * 個別のチャットを削除します
     * @param {string} conversationId - 削除する会話のID
     */
    function deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (confirm('このチャットを削除してもよろしいですか？')) {
            // 削除するチャットが現在表示中のチャットかどうか確認
            const isCurrentChat = conversationId === AppState.currentConversationId;
            
            // チャットを削除
            AppState.conversations = AppState.conversations.filter(conv => conv.id !== conversationId);
            window.Storage.saveConversations(AppState.conversations);
            
            // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
            if (isCurrentChat) {
                if (AppState.conversations.length > 0) {
                    // 最初のチャットに切り替え
                    AppState.currentConversationId = AppState.conversations[0].id;
                    window.Storage.saveCurrentConversationId(AppState.currentConversationId);
                    window.Chat.displayConversation(
                        AppState.getConversationById(AppState.currentConversationId),
                        Elements.chatMessages,
                        Elements.modelSelect
                    );
                } else {
                    // チャットがなくなった場合は新しいチャットを作成
                    createNewConversation();
                    return; // createNewConversation内でrenderChatHistoryを呼ぶので、ここでは不要
                }
            }
            
            // チャット履歴の表示を更新
            renderChatHistory();
        }
    }

    /**
     * すべての履歴をクリアします
     */
    function clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            AppState.conversations = [];
            window.Storage.saveConversations(AppState.conversations);
            createNewConversation();
        }
    }
});