/**
 * main.js
 * アプリケーションのエントリーポイントとなるファイルです
 * 
 * アプリケーションの初期化、イベントリスナー設定、状態管理を担当します。
 * UI.js、API.js、Chat.js、Storage.jsなどの他のモジュールと連携して
 * チャットアプリケーション全体の動作を制御します。
 * 
 * @module Main
 */

document.addEventListener('DOMContentLoaded', function() {
    /**
     * アプリケーションの状態管理
     * チャット会話、API設定、システムプロンプトなどのアプリケーション状態を管理します
     * 
     * @namespace AppState
     */
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
            return this.conversations.find(conv => conv.id === id) || null;
        },

        /**
         * グローバル設定を更新します
         * window.apiSettingsにアプリケーション状態の設定を反映します
         */
        updateGlobalSettings() {
            window.apiSettings = this.apiSettings;
        },

        /**
         * 現在のモデル名を取得します
         * 選択されているAIモデルの名前を返します。選択がない場合はデフォルト値を返します
         * 
         * @returns {string} 現在選択されているモデル名
         */
        getCurrentModel() {
            return Elements.modelSelect ? Elements.modelSelect.value : 'gpt-4o';
        }
    };

    /**
     * DOM要素のキャッシュ
     * 頻繁にアクセスするDOM要素への参照をキャッシュします
     * 
     * @namespace Elements
     */
    const Elements = (() => {
        /**
         * 一度に複数の要素を取得する関数
         * 指定されたID配列から要素を取得してオブジェクトとして返します
         * 
         * @param {string[]} selectors - 取得する要素のID配列
         * @returns {Object} ID名をキーとした要素オブジェクト
         * @private
         */
        function getElements(selectors) {
            const result = {};
            selectors.forEach(id => {
                result[id] = document.getElementById(id);
            });
            return result;
        }
        
        // 主要な要素をキャッシュ
        const ids = [
            // チャット関連
            'chatMessages', 'userInput', 'sendButton', 'modelSelect', 'chatHistory', 'chatInputContainer',
            
            // ボタン関連
            'newChatButton', 'clearHistoryButton', 'settingsButton', 'settingsMenu',
            'openSystemPromptSettings', 'openApiSettings',
            
            // ファイル関連
            'fileInput',
            
            // システムプロンプト関連
            'systemPromptModal', 'systemPromptInput', 'saveSystemPrompt',
            'cancelSystemPrompt', 'saveNewTemplate', 'newTemplateName',
            
            // API設定関連
            'apiKeyModal', 'saveApiKey', 'cancelApiKey', 'openaiRadio', 'azureRadio',
            'apiKeyInput', 'azureApiKeyInput', 'azureEndpointGpt4oMini', 
            'azureEndpointGpt4o', 'azureEndpointO1Mini', 'azureEndpointO1',
            
            // チャット名前変更関連
            'saveRenameChat', 'cancelRenameChat', 'renameChatModal', 'chatTitleInput'
        ];
        
        return getElements(ids);
    })();

    // グローバルなapiSettingsを設定
    AppState.updateGlobalSettings();

    // モバイル用のサイドバートグルボタンを追加
    window.UI.createSidebarToggle();

    // 初期化
    _init();

    // 外部ライブラリの読み込み - Markdown用
    window.Markdown.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
        .then(() => {
            console.log('Marked.js loaded successfully');
            window.Markdown.initializeMarkdown();
        })
        .catch(err => console.error('Failed to load Marked.js:', err));

    /**
     * アプリケーションを初期化します
     * API設定の確認、会話履歴の読み込み、イベントリスナーの設定を行います
     * 
     * @function _init
     * @private
     */
    function _init() {
        // API設定がなければモーダルを表示
        if (!AppState.apiSettings.openaiApiKey && !AppState.apiSettings.azureApiKey) {
            window.UI.showApiKeyModal(AppState.apiSettings);
        }

        // 会話の履歴を読み込む
        _loadConversations();

        // イベントリスナーのセットアップ
        _setupEventListeners();
    }

    /**
     * 会話履歴を読み込みます
     * 保存されている会話をロードし、現在の会話を設定します
     * 
     * @function _loadConversations
     * @private
     */
    function _loadConversations() {
        const savedConversations = window.Storage.loadConversations();
        if (savedConversations && savedConversations.length > 0) {
            AppState.conversations = savedConversations;
            _renderChatHistory();
        }

        AppState.currentConversationId = window.Storage.loadCurrentConversationId();

        // 新しい会話を作成または既存の会話を読み込む
        if (AppState.conversations.length === 0) {
            _createNewConversation();
        } else {
            _loadCurrentConversation();
        }
    }

    /**
     * イベントリスナーをセットアップします
     * アプリケーションで使用する全てのイベントリスナーを初期化します
     * 
     * @function _setupEventListeners
     * @private
     */
    function _setupEventListeners() {
        // サブ関数に分けてセットアップ
        _setupChatEvents();
        _setupSettingsEvents();
        _setupFileEvents();
        _setupModalEvents();
        _setupGlobalEvents();
    }

    /**
     * チャット関連のイベントをセットアップします
     * メッセージ送信、テキストエリア操作、新規チャット作成などの
     * チャット機能に関するイベントリスナーを設定します
     * 
     * @function _setupChatEvents
     * @private
     */
    function _setupChatEvents() {
        if (!Elements.sendButton || !Elements.userInput || 
            !Elements.newChatButton || !Elements.clearHistoryButton) return;
        
        // 送信ボタンのクリックイベント
        Elements.sendButton.addEventListener('click', _sendMessage);

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        Elements.userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _sendMessage();
            }
        });

        // テキストエリアの入力イベント（自動リサイズ）
        Elements.userInput.addEventListener('input', () => window.UI.autoResizeTextarea(Elements.userInput));

        // 新しいチャットボタン
        Elements.newChatButton.addEventListener('click', _createNewConversation);

        // 履歴クリアボタン
        Elements.clearHistoryButton.addEventListener('click', _clearAllHistory);
    }

    /**
     * 設定関連のイベントをセットアップします
     * 設定メニュー、システムプロンプト設定、API設定などの
     * 設定機能に関するイベントリスナーを設定します
     * 
     * @function _setupSettingsEvents
     * @private
     */
    function _setupSettingsEvents() {
        if (!Elements.settingsButton || !Elements.settingsMenu ||
            !Elements.openSystemPromptSettings || !Elements.openApiSettings) return;
            
        // 設定メニューのトグル
        Elements.settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            Elements.settingsMenu.classList.toggle('show');
        });

        // システムプロンプト設定を開く
        Elements.openSystemPromptSettings.addEventListener('click', () => {
            Elements.settingsMenu.classList.remove('show');
            window.UI.showSystemPromptModal(AppState.systemPrompt, _loadPromptTemplates);
        });

        // API設定を開く
        Elements.openApiSettings.addEventListener('click', () => {
            Elements.settingsMenu.classList.remove('show');
            window.UI.showApiKeyModal(AppState.apiSettings);
        });
    }

    /**
     * ファイル関連のイベントをセットアップします
     * ファイル選択、添付ファイル処理などのイベントリスナーを設定します
     * 
     * @function _setupFileEvents
     * @private
     */
    function _setupFileEvents() {
        if (!Elements.fileInput) return;
        
        // ファイル選択イベント
        Elements.fileInput.addEventListener('change', window.FileHandler.handleFileSelect.bind(window.FileHandler));

        // カスタムイベントリスナー
        document.addEventListener('file-attached', e => AppState.currentAttachments = e.detail.attachments);
        document.addEventListener('attachment-removed', () => AppState.currentAttachments = []);
    }

    /**
     * モーダル関連のイベントをセットアップします
     * APIキー設定、システムプロンプト設定、名前変更モーダルなどの
     * 各種モーダルダイアログのイベントリスナーを設定します
     * 
     * @function _setupModalEvents
     * @private
     */
    function _setupModalEvents() {
        // APIキー関連
        if (Elements.openaiRadio && Elements.azureRadio) {
            Elements.openaiRadio.addEventListener('change', window.UI.toggleAzureSettings);
            Elements.azureRadio.addEventListener('change', window.UI.toggleAzureSettings);
        }
        
        if (Elements.saveApiKey) {
            Elements.saveApiKey.addEventListener('click', _saveApiSettings);
        }
        
        if (Elements.cancelApiKey) {
            Elements.cancelApiKey.addEventListener('click', window.UI.hideApiKeyModal);
        }

        // システムプロンプト関連
        if (Elements.saveSystemPrompt) {
            Elements.saveSystemPrompt.addEventListener('click', () => {
                AppState.systemPrompt = Elements.systemPromptInput.value;
                window.Storage.saveSystemPrompt(AppState.systemPrompt);
                window.UI.hideSystemPromptModal();
            });
        }

        if (Elements.cancelSystemPrompt) {
            Elements.cancelSystemPrompt.addEventListener('click', window.UI.hideSystemPromptModal);
        }

        // 新規テンプレートとして保存
        if (Elements.saveNewTemplate && Elements.newTemplateName) {
            Elements.saveNewTemplate.addEventListener('click', () => {
                const name = Elements.newTemplateName.value.trim();
                if (name) {
                    AppState.promptTemplates[name] = Elements.systemPromptInput.value;
                    window.Storage.savePromptTemplates(AppState.promptTemplates);
                    _loadPromptTemplates();
                    Elements.newTemplateName.value = '';
                }
            });
        }

        // 名前変更モーダル関連
        if (Elements.saveRenameChat) {
            Elements.saveRenameChat.addEventListener('click', _saveRenamedChat);
        }
        
        if (Elements.cancelRenameChat) {
            Elements.cancelRenameChat.addEventListener('click', window.UI.hideRenameChatModal);
        }
    }

    /**
     * グローバルなイベントをセットアップします
     * 全体に関わるイベントや、イベント委任パターンを使用したイベントリスナーを設定します
     * 
     * @function _setupGlobalEvents
     * @private
     */
    function _setupGlobalEvents() {
        // 画面のどこかをクリックしたらメニューを閉じる
        document.addEventListener('click', (e) => {
            if (Elements.settingsMenu && Elements.settingsButton && 
                !Elements.settingsButton.contains(e.target) && 
                !Elements.settingsMenu.contains(e.target)) {
                Elements.settingsMenu.classList.remove('show');
            }
        });

        // エラー時のAPIキー設定ボタンイベント処理（イベント委任パターン）
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'showApiSettings') {
                window.UI.showApiKeyModal(AppState.apiSettings);
            }
        });
    }

    /**
     * チャットの名前を保存します
     * 名前変更モーダルで設定された新しいチャット名を保存します
     * 
     * @function _saveRenamedChat
     * @private
     */
    function _saveRenamedChat() {
        if (!Elements.renameChatModal || !Elements.chatTitleInput) return;
        
        const conversationId = Elements.renameChatModal.dataset.conversationId;
        const newTitle = Elements.chatTitleInput.value.trim();
        
        // 新しいタイトルが空でなければ保存
        if (newTitle) {
            const conversation = AppState.getConversationById(conversationId);
            if (conversation) {
                conversation.title = newTitle;
                window.Storage.saveConversations(AppState.conversations);
                _renderChatHistory();
            }
        }
        
        // モーダルを閉じる
        window.UI.hideRenameChatModal();
    }

    /**
     * メッセージを送信します
     * ユーザー入力を処理し、APIを通じてメッセージを送信します
     * 添付ファイルがある場合はそれも含めて送信します
     * 
     * @function _sendMessage
     * @private
     * @async
     */
    async function _sendMessage() {
        const currentConversation = AppState.getConversationById(AppState.currentConversationId);
        if (!currentConversation || !Elements.userInput || !Elements.chatMessages) return;
        
        try {
            // FileHandlerから現在の添付ファイルを取得
            const apiAttachments = await window.FileHandler.getAttachmentsForAPI();
            
            // 添付ファイルの参照を保持
            const attachmentsToSend = apiAttachments.length > 0 ? apiAttachments : AppState.currentAttachments;
            
            // 送信前に添付ファイルをクリア
            AppState.currentAttachments = [];
            window.FileHandler.clearSelectedFiles();
            
            const result = await window.Chat.sendMessage(
                Elements.userInput, 
                Elements.chatMessages, 
                currentConversation, 
                AppState.apiSettings, 
                AppState.systemPrompt,
                attachmentsToSend
            );
            
            if (result?.titleUpdated) {
                _renderChatHistory();
            }
            
            if (!result?.error) {
                // 会話を保存
                window.Storage.saveConversations(AppState.conversations);
            }
        } catch (error) {
            console.error('メッセージ送信中にエラーが発生しました:', error);
            // エラー表示
            const errorMsg = document.createElement('div');
            errorMsg.classList.add('error-message');
            errorMsg.textContent = 'メッセージ送信中にエラーが発生しました。';
            Elements.chatMessages.appendChild(errorMsg);
        }
    }

    /**
     * API設定を保存します
     * APIキーモーダルで設定されたAPI設定を保存します
     * OpenAIまたはAzureの設定に対応します
     * 
     * @function _saveApiSettings
     * @private
     */
    function _saveApiSettings() {
        if (!Elements.openaiRadio || !Elements.apiKeyInput || 
            !Elements.azureApiKeyInput) return;
        
        if (Elements.openaiRadio.checked) {
            AppState.apiSettings.openaiApiKey = Elements.apiKeyInput.value.trim();
            AppState.apiSettings.apiType = 'openai';
        } else {
            AppState.apiSettings.azureApiKey = Elements.azureApiKeyInput.value.trim();
            AppState.apiSettings.apiType = 'azure';
            
            // Azureエンドポイント情報の保存
            const endpoints = {
                'gpt-4o-mini': Elements.azureEndpointGpt4oMini,
                'gpt-4o': Elements.azureEndpointGpt4o,
                'o1-mini': Elements.azureEndpointO1Mini,
                'o1': Elements.azureEndpointO1
            };
            
            // 各エンドポイントを保存
            Object.entries(endpoints).forEach(([model, element]) => {
                if (element) {
                    AppState.apiSettings.azureEndpoints = AppState.apiSettings.azureEndpoints || {};
                    AppState.apiSettings.azureEndpoints[model] = element.value.trim();
                }
            });
        }

        // グローバル設定を更新
        AppState.updateGlobalSettings();

        // ローカルストレージに保存
        window.Storage.saveApiSettings(AppState.apiSettings);
        window.UI.hideApiKeyModal();
    }

    /**
     * 現在の会話を読み込みます
     * 現在選択されている会話をUIに表示します
     * 
     * @function _loadCurrentConversation
     * @private
     */
    function _loadCurrentConversation() {
        if (!AppState.currentConversationId || !AppState.getConversationById(AppState.currentConversationId)) {
            AppState.currentConversationId = AppState.conversations[0]?.id;
            if (!AppState.currentConversationId) {
                _createNewConversation();
                return;
            }
        }

        // 会話履歴から現在の会話を選択状態にする
        window.Chat.updateActiveChatInHistory(AppState.currentConversationId);

        // チャットメッセージを表示
        if (Elements.chatMessages && Elements.modelSelect) {
            window.Chat.displayConversation(
                AppState.getConversationById(AppState.currentConversationId),
                Elements.chatMessages,
                Elements.modelSelect
            );
        }
    }

    /**
     * プロンプトテンプレートを読み込みます
     * システムプロンプトのテンプレート一覧を表示します
     * 
     * @function _loadPromptTemplates
     * @private
     */
    function _loadPromptTemplates() {
        // テンプレート一覧を更新
        window.UI.updateTemplateList(
            AppState.promptTemplates, 
            (templateName) => {
                if (Elements.systemPromptInput) {
                    Elements.systemPromptInput.value = AppState.promptTemplates[templateName];
                }
            },
            (templateName) => {
                _deletePromptTemplate(templateName);
            }
        );
    }

    /**
     * テンプレートを削除します
     * システムプロンプトのテンプレートを削除します
     * デフォルトテンプレートは削除できません
     * 
     * @function _deletePromptTemplate
     * @param {string} templateName - 削除するテンプレートの名前
     * @private
     */
    function _deletePromptTemplate(templateName) {
        // デフォルトテンプレートは削除不可
        const defaultTemplates = ['default', 'creative', 'technical'];
        if (defaultTemplates.includes(templateName)) {
            alert('デフォルトテンプレートは削除できません');
            return;
        }
        
        // 削除確認
        if (confirm(`テンプレート「${templateName}」を削除してもよろしいですか？`)) {
            // 選択中のテンプレートが削除対象の場合はデフォルトに変更
            if (Elements.systemPromptInput && 
                Elements.systemPromptInput.value === AppState.promptTemplates[templateName]) {
                Elements.systemPromptInput.value = AppState.promptTemplates['default'] || '';
            }
            
            // テンプレートを削除
            delete AppState.promptTemplates[templateName];
            window.Storage.savePromptTemplates(AppState.promptTemplates);
            
            // テンプレート一覧を更新
            _loadPromptTemplates();
        }
    }

    /**
     * 会話を切り替えます
     * 指定されたIDの会話に切り替え、UIを更新します
     * 
     * @function _switchConversation
     * @param {string} conversationId - 切り替える会話のID
     * @private
     */
    function _switchConversation(conversationId) {
        if (!conversationId) return;
        
        AppState.currentConversationId = conversationId;
        window.Storage.saveCurrentConversationId(AppState.currentConversationId);
        
        window.Chat.updateActiveChatInHistory(AppState.currentConversationId);
        
        if (Elements.chatMessages && Elements.modelSelect) {
            window.Chat.displayConversation(
                AppState.getConversationById(AppState.currentConversationId),
                Elements.chatMessages,
                Elements.modelSelect
            );
        }
    }

    /**
     * 新しい会話を作成します
     * 新しいチャット会話を初期化し、UIに表示します
     * 
     * @function _createNewConversation
     * @private
     */
    function _createNewConversation() {
        const newConversation = {
            id: Date.now().toString(),
            title: '新しいチャット',
            messages: [
                {
                    role: 'system',
                    content: AppState.systemPrompt || ''
                }
            ],
            model: AppState.getCurrentModel()
        };
        
        AppState.conversations.unshift(newConversation);
        window.Storage.saveConversations(AppState.conversations);
        
        AppState.currentConversationId = newConversation.id;
        window.Storage.saveCurrentConversationId(AppState.currentConversationId);
        
        _renderChatHistory();
        
        if (Elements.chatMessages && Elements.modelSelect) {
            window.Chat.displayConversation(newConversation, Elements.chatMessages, Elements.modelSelect);
        }
    }

    /**
     * 会話履歴を表示します
     * サイドバーに会話履歴の一覧を表示します
     * 
     * @function _renderChatHistory
     * @private
     */
    function _renderChatHistory() {
        if (!Elements.chatHistory) return;
        
        window.Chat.renderChatHistory(
            AppState.conversations, 
            AppState.currentConversationId, 
            Elements.chatHistory, 
            _switchConversation, 
            window.UI.showRenameChatModal, 
            _deleteConversation
        );
    }

    /**
     * 個別のチャットを削除します
     * 指定されたIDの会話を削除し、必要に応じて別の会話に切り替えます
     * 
     * @function _deleteConversation
     * @param {string} conversationId - 削除する会話のID
     * @private
     */
    function _deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (!confirm('このチャットを削除してもよろしいですか？')) return;
            
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
                
                if (Elements.chatMessages && Elements.modelSelect) {
                    window.Chat.displayConversation(
                        AppState.getConversationById(AppState.currentConversationId),
                        Elements.chatMessages,
                        Elements.modelSelect
                    );
                }
            } else {
                // チャットがなくなった場合は新しいチャットを作成
                _createNewConversation();
                return; // createNewConversation内でrenderChatHistoryを呼ぶので、ここでは不要
            }
        }
        
        // チャット履歴の表示を更新
        _renderChatHistory();
    }

    /**
     * すべての履歴をクリアします
     * ユーザーの確認後、すべての会話履歴を削除します
     * 
     * @function _clearAllHistory
     * @private
     */
    function _clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            AppState.conversations = [];
            window.Storage.saveConversations(AppState.conversations);
            _createNewConversation();
        }
    }
});