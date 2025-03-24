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
    const apiKeyModal = document.getElementById('apiKeyModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKey = document.getElementById('saveApiKey');
    const cancelApiKey = document.getElementById('cancelApiKey');
    const openaiRadio = document.getElementById('openaiRadio');
    const azureRadio = document.getElementById('azureRadio');
    const azureSettings = document.getElementById('azureSettings');
    const azureEndpointGpt4oMini = document.getElementById('azureEndpointGpt4oMini');
    const azureEndpointGpt4o = document.getElementById('azureEndpointGpt4o');
    const azureEndpointO1Mini = document.getElementById('azureEndpointO1Mini');
    const azureEndpointO1 = document.getElementById('azureEndpointO1');
    const settingsMenu = document.getElementById('settingsMenu');
    const openSystemPromptSettings = document.getElementById('openSystemPromptSettings');
    const openApiSettings = document.getElementById('openApiSettings');
    const systemPromptModal = document.getElementById('systemPromptModal');
    const systemPromptInput = document.getElementById('systemPromptInput');
    const saveSystemPrompt = document.getElementById('saveSystemPrompt');
    const cancelSystemPrompt = document.getElementById('cancelSystemPrompt');
    const saveNewTemplate = document.getElementById('saveNewTemplate');
    const newTemplateName = document.getElementById('newTemplateName');
    const fileInput = document.getElementById('fileInput');

    // 状態変数
    let conversations = [];
    let currentConversationId = null;
    let apiSettings = {
        openaiApiKey: localStorage.getItem('openaiApiKey') || '',
        azureApiKey: localStorage.getItem('azureApiKey') || '',
        apiType: localStorage.getItem('apiType') || 'openai',
        azureEndpoints: {
            'gpt-4o-mini': localStorage.getItem('azureEndpoint_gpt-4o-mini') || '',
            'gpt-4o': localStorage.getItem('azureEndpoint_gpt-4o') || '',
            'o1-mini': localStorage.getItem('azureEndpoint_o1-mini') || '',
            'o1': localStorage.getItem('azureEndpoint_o1') || ''
        }
    };

    let systemPrompt = localStorage.getItem('systemPrompt') || 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）';

    let promptTemplates = JSON.parse(localStorage.getItem('promptTemplates')) || {
        'default': 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）',
        'creative': 'あなたはクリエイティブで革新的なアイデアを提案できるAIアシスタントです。ユーザーの要望に対して、独創的で実現可能なソリューションを提供してください。',
        'technical': 'あなたは技術的な専門知識を持つエキスパートエンジニアです。コードの品質、セキュリティ、パフォーマンスを重視し、ベストプラクティスに基づいたアドバイスを提供してください。'
    };

    let selectedFiles = [];

    // モバイル用のサイドバートグルボタンを追加
    createSidebarToggle();

    // 初期化
    init();

    // 外部ライブラリの読み込み - Markdown用
    loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
        .then(() => {
            console.log('Marked.js loaded successfully');
            // マークダウンのレンダリングオプション設定
            marked.setOptions({
                breaks: true,        // 改行を認識
                gfm: true,           // GitHub Flavored Markdown
                headerIds: false,    // ヘッダーIDを無効化
                mangle: false,       // リンクを難読化しない
                sanitize: false,     // HTMLタグを許可
                highlight: function(code, lang) {
                    if (Prism.languages[lang]) {
                        try {
                            return Prism.highlight(code, Prism.languages[lang], lang);
                        } catch (e) {
                            console.error('Syntax highlighting error:', e);
                            return code;
                        }
                    }
                    return code;
                }
            });
        })
        .catch(err => console.error('Failed to load Marked.js:', err));

    // モバイル用のサイドバートグルボタンを作成
    function createSidebarToggle() {
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
    function autoResizeTextarea() {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    }

    // 初期化関数
    function init() {
        // API設定がなければモーダルを表示
        if (!apiSettings.openaiApiKey && !apiSettings.azureApiKey) {
            showApiKeyModal();
        }

        // 会話の履歴を読み込む
        loadConversations();

        // 新しい会話を作成
        if (conversations.length === 0) {
            createNewConversation();
        } else {
            loadCurrentConversation();
        }

        // イベントリスナーのセットアップ
        setupEventListeners();
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
        userInput.addEventListener('input', autoResizeTextarea);

        // 新しいチャットボタン
        newChatButton.addEventListener('click', createNewConversation);

        // 履歴クリアボタン
        clearHistoryButton.addEventListener('click', clearAllHistory);

        // APIキー関連
        openaiRadio.addEventListener('change', toggleAzureSettings);
        azureRadio.addEventListener('change', toggleAzureSettings);
        saveApiKey.addEventListener('click', saveApiSettings);
        cancelApiKey.addEventListener('click', hideApiKeyModal);

        // 名前変更モーダルの保存ボタン
        document.getElementById('saveRenameChat').addEventListener('click', saveRenamedChat);
        
        // 名前変更モーダルのキャンセルボタン
        document.getElementById('cancelRenameChat').addEventListener('click', hideRenameChatModal);

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
            systemPromptModal.classList.add('show');
            systemPromptInput.value = systemPrompt;
            loadPromptTemplates();
        });

        // API設定を開く
        openApiSettings.addEventListener('click', () => {
            settingsMenu.classList.remove('show');
            showApiKeyModal();
        });

        // システムプロンプトを保存
        saveSystemPrompt.addEventListener('click', () => {
            systemPrompt = systemPromptInput.value;
            localStorage.setItem('systemPrompt', systemPrompt);
            systemPromptModal.classList.remove('show');
        });

        // システムプロンプト設定をキャンセル
        cancelSystemPrompt.addEventListener('click', () => {
            systemPromptModal.classList.remove('show');
        });

        // 新規テンプレートとして保存
        saveNewTemplate.addEventListener('click', () => {
            const name = newTemplateName.value.trim();
            if (name) {
                promptTemplates[name] = systemPromptInput.value;
                localStorage.setItem('promptTemplates', JSON.stringify(promptTemplates));
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
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Azure設定の表示/非表示を切り替え
    function toggleAzureSettings() {
        const openaiSettings = document.getElementById('openaiSettings');
        if (azureRadio.checked) {
            openaiSettings.classList.add('hidden');
            azureSettings.classList.remove('hidden');
        } else {
            openaiSettings.classList.remove('hidden');
            azureSettings.classList.add('hidden');
        }
    }

    // APIキーモーダルを表示
    function showApiKeyModal() {
        apiKeyModal.classList.add('show');
        const azureApiKeyInput = document.getElementById('azureApiKeyInput');
        
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
    function hideApiKeyModal() {
        apiKeyModal.classList.remove('show');
    }

    // API設定を保存
    function saveApiSettings() {
        const azureApiKeyInput = document.getElementById('azureApiKeyInput');
        
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

        // ローカルストレージに保存
        localStorage.setItem('openaiApiKey', apiSettings.openaiApiKey);
        localStorage.setItem('azureApiKey', apiSettings.azureApiKey);
        localStorage.setItem('apiType', apiSettings.apiType);
        localStorage.setItem('azureEndpoint_gpt-4o-mini', apiSettings.azureEndpoints['gpt-4o-mini']);
        localStorage.setItem('azureEndpoint_gpt-4o', apiSettings.azureEndpoints['gpt-4o']);
        localStorage.setItem('azureEndpoint_o1-mini', apiSettings.azureEndpoints['o1-mini']);
        localStorage.setItem('azureEndpoint_o1', apiSettings.azureEndpoints['o1']);

        hideApiKeyModal();
    }

    // 会話履歴を読み込む
    function loadConversations() {
        const savedConversations = localStorage.getItem('conversations');
        if (savedConversations) {
            conversations = JSON.parse(savedConversations);
            renderChatHistory();
        }

        currentConversationId = localStorage.getItem('currentConversationId');
    }

    // 現在の会話を読み込む
    function loadCurrentConversation() {
        if (!currentConversationId || !getConversationById(currentConversationId)) {
            currentConversationId = conversations[0].id;
        }

        // 会話履歴から現在の会話を選択状態にする
        updateActiveChatInHistory();

        // チャットメッセージを表示
        displayConversation(getConversationById(currentConversationId));
    }

    // 会話履歴を表示する
    function renderChatHistory() {
        chatHistory.innerHTML = '';
        
        conversations.forEach(conversation => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.dataset.id = conversation.id;
            
            // コンテンツとアクションボタンを含むコンテナを作成
            const itemContent = document.createElement('div');
            itemContent.classList.add('history-item-content');
            itemContent.innerHTML = `
                <i class="fas fa-comments"></i>
                <span class="history-item-title">${conversation.title || '新しいチャット'}</span>
            `;
            
            // アクションボタンのコンテナ
            const actionButtons = document.createElement('div');
            actionButtons.classList.add('history-item-actions');
            
            // 編集ボタン
            const editButton = document.createElement('button');
            editButton.classList.add('history-action-button', 'edit-button');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'チャットの名前を変更';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();  // クリックイベントの伝播を止める
                showRenameChatModal(conversation);
            });
            
            // 削除ボタン
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('history-action-button', 'delete-button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'チャットを削除';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();  // クリックイベントの伝播を止める
                deleteConversation(conversation.id);
            });
            
            // ボタンをアクションコンテナに追加
            actionButtons.appendChild(editButton);
            actionButtons.appendChild(deleteButton);
            
            // 内容とアクションボタンをアイテムに追加
            historyItem.appendChild(itemContent);
            historyItem.appendChild(actionButtons);
            
            // チャットアイテムのクリックイベント（チャット切り替え）
            itemContent.addEventListener('click', () => {
                switchConversation(conversation.id);
            });
            
            chatHistory.appendChild(historyItem);
        });
        
        updateActiveChatInHistory();
    }

    // アクティブなチャットを更新
    function updateActiveChatInHistory() {
        const historyItems = document.querySelectorAll('.history-item');
        historyItems.forEach(item => {
            if (item.dataset.id === currentConversationId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // 会話を切り替える
    function switchConversation(conversationId) {
        currentConversationId = conversationId;
        localStorage.setItem('currentConversationId', currentConversationId);
        
        updateActiveChatInHistory();
        displayConversation(getConversationById(currentConversationId));
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
        saveConversations();
        
        currentConversationId = newConversation.id;
        localStorage.setItem('currentConversationId', currentConversationId);
        
        renderChatHistory();
        displayConversation(newConversation);
    }

    // 会話を表示
    function displayConversation(conversation) {
        if (!conversation) return;
        
        chatMessages.innerHTML = '';
        
        // システムメッセージ以外を表示
        conversation.messages.forEach(message => {
            if (message.role === 'system') return;
            
            if (message.role === 'user') {
                addUserMessage(message.content);
            } else if (message.role === 'assistant') {
                addBotMessage(message.content);
            }
        });
        
        // モデルを設定
        modelSelect.value = conversation.model || 'gpt-4o-mini';

        // シンタックスハイライトを再適用
        Prism.highlightAll();
    }

    // IDで会話を取得
    function getConversationById(id) {
        return conversations.find(conv => conv.id === id);
    }

    // 会話を保存
    function saveConversations() {
        localStorage.setItem('conversations', JSON.stringify(conversations));
    }

    // 個別のチャットを削除
    function deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (confirm('このチャットを削除してもよろしいですか？')) {
            // 削除するチャットが現在表示中のチャットかどうか確認
            const isCurrentChat = conversationId === currentConversationId;
            
            // チャットを削除
            conversations = conversations.filter(conv => conv.id !== conversationId);
            saveConversations();
            
            // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
            if (isCurrentChat) {
                if (conversations.length > 0) {
                    // 最初のチャットに切り替え
                    currentConversationId = conversations[0].id;
                    localStorage.setItem('currentConversationId', currentConversationId);
                    displayConversation(getConversationById(currentConversationId));
                } else {
                    // チャットがなくなった場合は新しいチャットを作成
                    createNewConversation();
                    return; // createNewConversation内でrenderChatHistoryを呼ぶので、ここでは不要
                }
            }
            
            // チャット履歴の表示を更新
            renderChatHistory();
            updateActiveChatInHistory();
        }
    }

    // すべての履歴をクリア
    function clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            conversations = [];
            saveConversations();
            createNewConversation();
        }
    }

    // チャットの名前変更モーダルを表示
    function showRenameChatModal(conversation) {
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
    function hideRenameChatModal() {
        const modal = document.getElementById('renameChatModal');
        modal.classList.remove('show');
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
                saveConversations();
                renderChatHistory();
            }
        }
        
        // モーダルを閉じる
        hideRenameChatModal();
    }

    // ユーザーメッセージを追加する関数
    function addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // コピーボタンを追加
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(message)
                .then(() => {
                    copyButton.classList.add('copied');
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.classList.remove('copied');
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                })
                .catch(err => console.error('クリップボードへのコピーに失敗しました:', err));
        });

        const markdownContent = document.createElement('div');
        markdownContent.classList.add('markdown-content');
        markdownContent.innerHTML = renderMarkdown(message);

        contentDiv.appendChild(copyButton);
        contentDiv.appendChild(markdownContent);
        messageDiv.appendChild(contentDiv);

        // コードブロックにコピーボタンを追加とシンタックスハイライトの適用
        setTimeout(() => {
            addCodeBlockCopyButtons(messageDiv);
            Prism.highlightAllUnder(messageDiv);
        }, 10);

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ボットメッセージを追加する関数
    function addBotMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // コピーボタンを追加
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(message)
                .then(() => {
                    copyButton.classList.add('copied');
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.classList.remove('copied');
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                })
                .catch(err => {
                    console.error('クリップボードへのコピーに失敗しました: ', err);
                });
        });
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('markdown-content');
        
        try {
            messageContent.innerHTML = marked.parse(message);
        } catch (e) {
            console.error('Markdown parsing error:', e);
            messageContent.innerHTML = formatMessage(message);
        }
        
        contentDiv.appendChild(copyButton);
        contentDiv.appendChild(messageContent);
        messageDiv.appendChild(contentDiv);
        
        // コードブロックにコピーボタンを追加とシンタックスハイライトの適用
        setTimeout(() => {
            addCodeBlockCopyButtons(messageDiv);
            Prism.highlightAllUnder(messageDiv);
        }, 10);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Markdownをレンダリングする関数
    function renderMarkdown(text) {
        try {
            return marked.parse(text);
        } catch (e) {
            console.error('Markdown rendering error:', e);
            return escapeHtml(text).replace(/\n/g, '<br>');
        }
    }

    // コードブロックにコピーボタンを追加する関数
    function addCodeBlockCopyButtons(messageElement) {
        const codeBlocks = messageElement.querySelectorAll('pre code');
        codeBlocks.forEach((codeBlock, index) => {
            const pre = codeBlock.parentElement;
            
            // ラッパーでコードブロックを囲む
            const wrapper = document.createElement('div');
            wrapper.classList.add('code-block');
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            
            // コピーボタンを追加
            const copyButton = document.createElement('button');
            copyButton.classList.add('code-copy-button');
            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            copyButton.title = 'コピーする';
            copyButton.setAttribute('data-code-index', index);
            wrapper.appendChild(copyButton);
            
            // コピーボタンのクリックイベント
            copyButton.addEventListener('click', () => {
                const codeText = codeBlock.textContent;
                navigator.clipboard.writeText(codeText)
                    .then(() => {
                        copyButton.classList.add('copied');
                        copyButton.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            copyButton.classList.remove('copied');
                            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('コードのコピーに失敗しました:', err);
                    });
            });
        });
    }

    // HTMLエスケープ
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // メッセージをフォーマット（改行やコードブロックなどを処理）
    function formatMessage(message) {
        let formattedMessage = escapeHtml(message);
        
        // 改行を<br>に変換
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        
        // コードブロックを処理
        formattedMessage = formattedMessage.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        return formattedMessage;
    }

    // メッセージを送信する関数
    async function sendMessage() {
        const message = userInput.value.trim();
        if (message || selectedFiles.length > 0) {
            // メッセージとファイルの情報を組み合わせる
            let messageContent = message;

            // ファイルがある場合は、Base64エンコードして追加
            if (selectedFiles.length > 0) {
                const fileContents = await Promise.all(selectedFiles.map(async file => {
                    const base64 = await readFileAsBase64(file);
                    return {
                        name: file.name,
                        type: file.type,
                        content: base64
                    };
                }));

                messageContent += '\n\n添付ファイル:\n' + fileContents.map(file => 
                    `[${file.name}](data:${file.type};base64,${file.content})`
                ).join('\n');
            }

            // ユーザーメッセージを表示
            addUserMessage(messageContent);
            userInput.value = '';
            userInput.style.height = 'auto';

            // プレビューをクリア
            const previewArea = document.querySelector('.file-preview');
            if (previewArea) {
                previewArea.remove();
            }
            selectedFiles = [];

            // 現在の会話にユーザーメッセージを追加
            const currentConversation = getConversationById(currentConversationId);
            currentConversation.messages.push({
                role: 'user',
                content: messageContent
            });

            // チャットタイトルがデフォルトの場合、最初のメッセージをタイトルに設定
            if (currentConversation.title === '新しいチャット' && currentConversation.messages.filter(m => m.role === 'user').length === 1) {
                currentConversation.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                renderChatHistory();
            }
            
            // 「入力中...」の表示
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot', 'typing-indicator');
            typingIndicator.innerHTML = `
                <div class="message-content">
                    <p>入力中...</p>
                </div>
            `;
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            try {
                // モデルを保存
                currentConversation.model = modelSelect.value;
                
                // API呼び出し
                const botResponse = await callOpenAIAPI(currentConversation.messages, currentConversation.model);
                
                // 入力中の表示を削除
                chatMessages.removeChild(typingIndicator);
                
                // ボットの応答を表示
                addBotMessage(botResponse);
                
                // 応答をメッセージ履歴に追加
                currentConversation.messages.push({
                    role: 'assistant',
                    content: botResponse
                });
                
                // 会話を保存
                saveConversations();
            } catch (error) {
                // 入力中の表示を削除
                chatMessages.removeChild(typingIndicator);
                
                // エラーメッセージを表示
                const errorMessageDiv = document.createElement('div');
                errorMessageDiv.classList.add('message', 'bot', 'error');
                errorMessageDiv.innerHTML = `
                    <div class="message-content">
                `;
                chatMessages.appendChild(errorMessageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                document.getElementById('showApiSettings').addEventListener('click', showApiKeyModal);
            }
        }
    }

    // ファイル選択処理
    function handleFileSelect(event) {
        const files = Array.from(event.target.files);
        selectedFiles = files;

        // 入力エリアにプレビューを追加
        const inputWrapper = document.querySelector('.input-wrapper');
        const existingPreview = inputWrapper.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        const previewArea = document.createElement('div');
        previewArea.classList.add('file-preview');

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.classList.add('file-preview-item');
            fileItem.innerHTML = `
                ${file.name}
                <span class="remove-file" data-index="${index}">
                    <i class="fas fa-times"></i>
                </span>
            `;

            // ファイル削除イベント
            fileItem.querySelector('.remove-file').addEventListener('click', () => {
                selectedFiles = selectedFiles.filter((_, i) => i !== index);
                fileItem.remove();
                if (selectedFiles.length === 0 && previewArea.parentNode) {
                    previewArea.remove();
                }
            });

            previewArea.appendChild(fileItem);
        });

        if (files.length > 0) {
            inputWrapper.insertBefore(previewArea, userInput);
        }
    }

    // ファイルをBase64として読み込む
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // OpenAI APIを呼び出す関数
    async function callOpenAIAPI(messages, model) {
        if (!apiSettings.openaiApiKey && !apiSettings.azureApiKey) {
            throw new Error('APIキーが設定されていません');
        }
        if (apiSettings.apiType === 'azure' && !apiSettings.azureApiKey) {
            throw new Error('Azure APIキーが設定されていません');
        }
        if (apiSettings.apiType === 'openai' && !apiSettings.openaiApiKey) {
            throw new Error('OpenAI APIキーが設定されていません');
        }

        // システムプロンプトを追加
        const messagesWithSystem = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system')
        ];

        let endpoint, headers, body;
        
        if (apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                model: model,
                messages: messagesWithSystem,
                temperature: 0.7
            });
        } else {
            // Azure OpenAI API
            const azureEndpoint = apiSettings.azureEndpoints[model];
            if (!azureEndpoint) {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントが設定されていません`);
            }
            
            endpoint = azureEndpoint;
            headers = {
                'api-key': apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                messages: messagesWithSystem,
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

    // 外部スクリプトを動的に読み込む関数
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    // プロンプトテンプレートを読み込む関数
    function loadPromptTemplates() {
        // テンプレート一覧を更新
        updateTemplateList();
    }

    // テンプレート一覧を表示する関数
    function updateTemplateList() {
        // 既存のテンプレート一覧エリアを取得
        let templateListArea = document.getElementById('templateListArea');
        
        // テンプレート一覧をクリア（タイトルは外部に移動したので、空にするだけ）
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
                    deletePromptTemplate(templateName);
                });
                
                templateItem.appendChild(deleteButton);
            }
            
            // テンプレートをクリックすると選択される
            templateItem.addEventListener('click', () => {
                systemPromptInput.value = promptTemplates[templateName];
            });
            
            templateListArea.appendChild(templateItem);
        });
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
            localStorage.setItem('promptTemplates', JSON.stringify(promptTemplates));
            
            // テンプレート一覧を更新
            loadPromptTemplates();
        }
    }
});