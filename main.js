/**
 * main.js
 * アプリケーションのエントリーポイントとなるファイルです
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM要素
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const modelSelect = document.getElementById('modelSelect');
    const chatHistory = document.getElementById('chatHistory');
    const newChatButton = document.getElementById('newChatButton');
    const clearHistoryButton = document.getElementById('clearHistoryButton');
    const settingsButton = document.getElementById('settingsButton');
    const openSystemPromptSettings = document.getElementById('openSystemPromptSettings');
    const openApiSettings = document.getElementById('openApiSettings');
    const settingsMenu = document.getElementById('settingsMenu');
    const fileInput = document.getElementById('fileInput');
    const chatInputContainer = document.getElementById('chatInputContainer');
    
    // システムプロンプト関連
    const systemPromptModal = document.getElementById('systemPromptModal');
    const systemPromptInput = document.getElementById('systemPromptInput');
    const saveSystemPrompt = document.getElementById('saveSystemPrompt');
    const cancelSystemPrompt = document.getElementById('cancelSystemPrompt');
    const saveNewTemplate = document.getElementById('saveNewTemplate');
    const newTemplateName = document.getElementById('newTemplateName');

    // API設定関連
    const apiKeyModal = document.getElementById('apiKeyModal');
    const saveApiKey = document.getElementById('saveApiKey');
    const cancelApiKey = document.getElementById('cancelApiKey');
    const openaiRadio = document.getElementById('openaiRadio');
    const azureRadio = document.getElementById('azureRadio');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const azureApiKeyInput = document.getElementById('azureApiKeyInput');
    const azureEndpointGpt4oMini = document.getElementById('azureEndpointGpt4oMini');
    const azureEndpointGpt4o = document.getElementById('azureEndpointGpt4o');
    const azureEndpointO1Mini = document.getElementById('azureEndpointO1Mini');
    const azureEndpointO1 = document.getElementById('azureEndpointO1');

    // 状態変数
    let conversations = [];
    let currentConversationId = null;
    let apiSettings = window.Storage.loadApiSettings();
    let systemPrompt = window.Storage.loadSystemPrompt();
    let promptTemplates = window.Storage.loadPromptTemplates();
    let currentAttachments = []; // 添付ファイルを保存する配列

    // グローバルなapiSettingsを設定
    window.apiSettings = apiSettings;

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

    // 初期化関数
    function init() {
        // API設定がなければモーダルを表示
        if (!apiSettings.openaiApiKey && !apiSettings.azureApiKey) {
            window.UI.showApiKeyModal(apiSettings);
        }

        // 会話の履歴を読み込む
        loadConversations();

        // イベントリスナーのセットアップ
        setupEventListeners();
    }

    // 会話履歴を読み込む
    function loadConversations() {
        const savedConversations = window.Storage.loadConversations();
        if (savedConversations && savedConversations.length > 0) {
            conversations = savedConversations;
            renderChatHistory();
        }

        currentConversationId = window.Storage.loadCurrentConversationId();

        // 新しい会話を作成
        if (conversations.length === 0) {
            createNewConversation();
        } else {
            loadCurrentConversation();
        }
    }

    // イベントリスナーのセットアップ
    function setupEventListeners() {
        // 送信ボタンのクリックイベント
        sendButton.addEventListener('click', sendMessage);

        // テキストエリアのEnterキーイベント（Shift+Enterで改行）
        userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // テキストエリアの入力イベント（自動リサイズ）
        userInput.addEventListener('input', () => window.UI.autoResizeTextarea(userInput));

        // 新しいチャットボタン
        newChatButton.addEventListener('click', createNewConversation);

        // 履歴クリアボタン
        clearHistoryButton.addEventListener('click', clearAllHistory);

        // APIキー関連
        openaiRadio.addEventListener('change', window.UI.toggleAzureSettings);
        azureRadio.addEventListener('change', window.UI.toggleAzureSettings);
        saveApiKey.addEventListener('click', saveApiSettings);
        cancelApiKey.addEventListener('click', window.UI.hideApiKeyModal);

        // 名前変更モーダルの保存ボタン
        document.getElementById('saveRenameChat').addEventListener('click', saveRenamedChat);
        
        // 名前変更モーダルのキャンセルボタン
        document.getElementById('cancelRenameChat').addEventListener('click', window.UI.hideRenameChatModal);

        // 設定メニューのイベントリスナー
        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = settingsMenu.classList.contains('show');
            // 一旦すべてのメニューを閉じる
            document.querySelectorAll('.settings-menu').forEach(menu => menu.classList.remove('show'));
            if (!isOpen) {
                settingsMenu.classList.add('show');
            }
        });

        // システムプロンプト設定を開く
        openSystemPromptSettings.addEventListener('click', () => {
            settingsMenu.classList.remove('show');
            window.UI.showSystemPromptModal(systemPrompt, loadPromptTemplates);
        });

        // API設定を開く
        openApiSettings.addEventListener('click', () => {
            settingsMenu.classList.remove('show');
            window.UI.showApiKeyModal(apiSettings);
        });

        // システムプロンプトを保存
        saveSystemPrompt.addEventListener('click', () => {
            systemPrompt = systemPromptInput.value;
            window.Storage.saveSystemPrompt(systemPrompt);
            window.UI.hideSystemPromptModal();
        });

        // システムプロンプト設定をキャンセル
        cancelSystemPrompt.addEventListener('click', () => {
            window.UI.hideSystemPromptModal();
        });

        // 新規テンプレートとして保存
        saveNewTemplate.addEventListener('click', () => {
            const name = newTemplateName.value.trim();
            if (name) {
                promptTemplates[name] = systemPromptInput.value;
                window.Storage.savePromptTemplates(promptTemplates);
                loadPromptTemplates();
                newTemplateName.value = '';
            }
        });

        // 画面のどこかをクリックしたらメニューを閉じる
        document.addEventListener('click', (e) => {
            if (!settingsButton.contains(e.target) && !settingsMenu.contains(e.target)) {
                settingsMenu.classList.remove('show');
            }
        });

        // ファイル選択イベント
        fileInput.addEventListener('change', window.FileHandler.handleFileSelect.bind(window.FileHandler));

        // ファイル添付イベント
        document.addEventListener('file-attached', function(e) {
            currentAttachments = e.detail.attachments;
        });

        // ファイル削除イベント
        document.addEventListener('attachment-removed', function() {
            currentAttachments = [];
        });

        // エラー時のAPIキー設定ボタンイベント処理
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'showApiSettings') {
                window.UI.showApiKeyModal(apiSettings);
            }
        });
    }

    // API設定を保存
    function saveApiSettings() {
        if (openaiRadio.checked) {
            apiSettings.openaiApiKey = apiKeyInput.value.trim();
            apiSettings.apiType = 'openai';
        } else {
            apiSettings.azureApiKey = azureApiKeyInput.value.trim();
            apiSettings.apiType = 'azure';
            apiSettings.azureEndpoints['gpt-4o-mini'] = azureEndpointGpt4oMini.value.trim();
            apiSettings.azureEndpoints['gpt-4o'] = azureEndpointGpt4o.value.trim();
            apiSettings.azureEndpoints['o1-mini'] = azureEndpointO1Mini.value.trim();
            apiSettings.azureEndpoints['o1'] = azureEndpointO1.value.trim();
        }

        // グローバル設定を更新
        window.apiSettings = apiSettings;

        // ローカルストレージに保存
        window.Storage.saveApiSettings(apiSettings);
        window.UI.hideApiKeyModal();
    }

    // 現在の会話を読み込む
    function loadCurrentConversation() {
        if (!currentConversationId || !getConversationById(currentConversationId)) {
            currentConversationId = conversations[0].id;
        }

        // 会話履歴から現在の会話を選択状態にする
        window.Chat.updateActiveChatInHistory(currentConversationId);

        // チャットメッセージを表示
        window.Chat.displayConversation(getConversationById(currentConversationId), chatMessages, modelSelect);
    }

    // プロンプトテンプレートを読み込む関数
    function loadPromptTemplates() {
        // テンプレート一覧を更新
        window.UI.updateTemplateList(
            promptTemplates, 
            (templateName) => {
                systemPromptInput.value = promptTemplates[templateName];
            },
            (templateName) => {
                deletePromptTemplate(templateName);
            }
        );
    }

    // テンプレートを削除する関数
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
            if (systemPromptInput.value === promptTemplates[templateName]) {
                systemPromptInput.value = promptTemplates['default'];
            }
            
            // テンプレートを削除
            delete promptTemplates[templateName];
            window.Storage.savePromptTemplates(promptTemplates);
            
            // テンプレート一覧を更新
            loadPromptTemplates();
        }
    }

    // 会話を切り替える
    function switchConversation(conversationId) {
        currentConversationId = conversationId;
        window.Storage.saveCurrentConversationId(currentConversationId);
        
        window.Chat.updateActiveChatInHistory(currentConversationId);
        window.Chat.displayConversation(getConversationById(currentConversationId), chatMessages, modelSelect);
    }

    // 新しい会話を作成
    function createNewConversation() {
        const newConversation = {
            id: Date.now().toString(),
            title: '新しいチャット',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                }
            ],
            model: modelSelect.value
        };
        
        conversations.unshift(newConversation);
        window.Storage.saveConversations(conversations);
        
        currentConversationId = newConversation.id;
        window.Storage.saveCurrentConversationId(currentConversationId);
        
        renderChatHistory();
        window.Chat.displayConversation(newConversation, chatMessages, modelSelect);
    }

    // IDで会話を取得
    function getConversationById(id) {
        return conversations.find(conv => conv.id === id);
    }

    // 会話履歴を表示する
    function renderChatHistory() {
        window.Chat.renderChatHistory(
            conversations, 
            currentConversationId, 
            chatHistory, 
            switchConversation, 
            window.UI.showRenameChatModal, 
            deleteConversation
        );
    }

    // 個別のチャットを削除
    function deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (confirm('このチャットを削除してもよろしいですか？')) {
            // 削除するチャットが現在表示中のチャットかどうか確認
            const isCurrentChat = conversationId === currentConversationId;
            
            // チャットを削除
            conversations = conversations.filter(conv => conv.id !== conversationId);
            window.Storage.saveConversations(conversations);
            
            // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
            if (isCurrentChat) {
                if (conversations.length > 0) {
                    // 最初のチャットに切り替え
                    currentConversationId = conversations[0].id;
                    window.Storage.saveCurrentConversationId(currentConversationId);
                    window.Chat.displayConversation(getConversationById(currentConversationId), chatMessages, modelSelect);
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

    // すべての履歴をクリア
    function clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            conversations = [];
            window.Storage.saveConversations(conversations);
            createNewConversation();
        }
    }

    // チャットの名前を保存
    function saveRenamedChat() {
        const modal = document.getElementById('renameChatModal');
        const titleInput = document.getElementById('chatTitleInput');
        const conversationId = modal.dataset.conversationId;
        const newTitle = titleInput.value.trim();
        
        // 新しいタイトルが空でないことを確認
        if (newTitle) {
            // 該当する会話のタイトルを更新
            const conversation = getConversationById(conversationId);
            if (conversation) {
                conversation.title = newTitle;
                window.Storage.saveConversations(conversations);
                renderChatHistory();
            }
        }
        
        // モーダルを閉じる
        window.UI.hideRenameChatModal();
    }

    // メッセージを送信する関数
    async function sendMessage() {
        const currentConversation = getConversationById(currentConversationId);
        if (!currentConversation) return;
        
        // FileHandlerから現在の添付ファイルを取得
        const apiAttachments = await window.FileHandler.getAttachmentsForAPI();
        
        const result = await window.Chat.sendMessage(
            userInput, 
            chatMessages, 
            currentConversation, 
            apiSettings, 
            systemPrompt,
            apiAttachments.length > 0 ? apiAttachments : currentAttachments // FileHandlerの添付ファイルを優先
        );
        
        if (result.titleUpdated) {
            renderChatHistory();
        } else if (!result.error) {
            // 会話を保存
            window.Storage.saveConversations(conversations);
        }
        
        // 送信後は添付ファイルをクリア
        currentAttachments = [];
        window.FileHandler.clearSelectedFiles();
    }
});