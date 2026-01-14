/**
 * chatRenderer.js
 * チャットメッセージのレンダリング機能を提供します
 */
// @ts-ignore - グローバル型定義との競合
class ChatRenderer {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatRenderer} ChatRendererのシングルトンインスタンス
     */
    static get getInstance() {
        if (!ChatRenderer.#instance) {
            ChatRenderer.#instance = new ChatRenderer();
        }
        return ChatRenderer.#instance;
    }

    /**
     * プライベートコンストラクタ
     */
    constructor() {
        if (ChatRenderer.#instance) {
            throw new Error('ChatRendererクラスは直接インスタンス化できません。ChatRenderer.instanceを使用してください。');
        }
    }

    /**
     * ユーザーメッセージを追加する
     * ユーザーのメッセージとその添付ファイルをチャット画面に表示します
     * @async
     * @param {string} message - ユーザーが入力したテキストメッセージ
     * @param {HTMLElement} chatMessages - メッセージを表示する親DOM要素
     * @param {Attachment[]} [attachments=[]] - 添付ファイルの配列
     * @param {number|null} [timestamp=null] - メッセージのタイムスタンプ、nullの場合は現在時刻を使用
     * @returns {Promise<void>}
     */
    async addUserMessage(message, chatMessages, attachments = [], timestamp = null) {
        if (!chatMessages) return;

        const msgTimestamp = timestamp || Date.now();
        const fragment = document.createDocumentFragment();

        // メッセージコンテナ作成
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        messageDiv.dataset.timestamp = msgTimestamp.toString();
        messageDiv.dataset.rawMessage = message || '';
        messageDiv.setAttribute('role', 'region');
        messageDiv.setAttribute('aria-label', 'あなたのメッセージ');

        // アバター作成
        const avatarDiv = this.#createAvatar('user');
        messageDiv.appendChild(avatarDiv);

        // メッセージボディ作成
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'message-body';

        // ヘッダー（名前 + タイムスタンプ）
        const headerDiv = this.#createMessageHeader('You', msgTimestamp);
        bodyDiv.appendChild(headerDiv);

        // コンテンツ
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        try {
            const renderedMarkdown = await Markdown.getInstance.renderMarkdown(message || '');
            const markdownContent = document.createElement('div');
            markdownContent.className = 'markdown-content';
            markdownContent.innerHTML = renderedMarkdown;
            contentDiv.appendChild(markdownContent);

            if (attachments && attachments.length > 0) {
                contentDiv.appendChild(ChatAttachmentViewer.getInstance.createAttachmentsElement(attachments));
            }
        } catch (e) {
            console.error('ユーザーメッセージのMarkdown解析エラー:', e);
            const markdownContent = document.createElement('div');
            markdownContent.className = 'markdown-content';
            markdownContent.textContent = message || '';
            contentDiv.appendChild(markdownContent);
        }

        bodyDiv.appendChild(contentDiv);

        // アクションボタン（編集、コピー、削除）
        const actionsDiv = this.#createUserMessageActions(messageDiv, message || '');
        bodyDiv.appendChild(actionsDiv);

        messageDiv.appendChild(bodyDiv);
        fragment.appendChild(messageDiv);
        chatMessages.appendChild(fragment);

        this.#applyCodeFormatting(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * ボットメッセージを追加する
     * AIからの応答メッセージをチャット画面に表示します
     * @param {string} message - 表示するボットのメッセージ内容
     * @param {HTMLElement} chatMessages - メッセージを表示する親要素
     * @param {number|null} timestamp - メッセージのタイムスタンプ、nullの場合は現在時刻を使用
     * @param {boolean} animate - タイピングアニメーションを適用するかのフラグ
     * @returns {Promise<void>}
     */
    async addBotMessage(message, chatMessages, timestamp = null, animate = true) {
        if (!chatMessages) return;

        const msgTimestamp = timestamp || Date.now();
        const provider = this.#getCurrentProvider();

        // メッセージコンテナ作成
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.dataset.timestamp = msgTimestamp.toString();
        messageDiv.dataset.rawMessage = message || '';
        messageDiv.setAttribute('role', 'region');
        messageDiv.setAttribute('aria-label', 'AIからの返答');

        // アバター作成
        const avatarDiv = this.#createAvatar('bot', provider);
        messageDiv.appendChild(avatarDiv);

        // メッセージボディ作成
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'message-body';

        // ヘッダー（名前 + タイムスタンプ）
        const senderName = this.#getProviderDisplayName(provider);
        const headerDiv = this.#createMessageHeader(senderName, msgTimestamp);
        bodyDiv.appendChild(headerDiv);

        // コンテンツ
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const messageContent = document.createElement('div');
        messageContent.className = 'markdown-content';

        if (animate) {
            messageContent.innerHTML = '';
            contentDiv.appendChild(messageContent);
            bodyDiv.appendChild(contentDiv);
            messageDiv.appendChild(bodyDiv);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            this.#animateTyping(message, messageContent).then(() => {
                // アニメーション完了後にアクションボタンを追加
                const actionsDiv = this.#createBotMessageActions(messageDiv, message || '');
                bodyDiv.appendChild(actionsDiv);
            });
        } else {
            try {
                const renderedMarkdown = await Markdown.getInstance.renderMarkdown(message || '');
                messageContent.innerHTML = renderedMarkdown;
                contentDiv.appendChild(messageContent);
                bodyDiv.appendChild(contentDiv);

                // アクションボタン（コピー、再生成、リアクション、削除）
                const actionsDiv = this.#createBotMessageActions(messageDiv, message || '');
                bodyDiv.appendChild(actionsDiv);

                messageDiv.appendChild(bodyDiv);
                chatMessages.appendChild(messageDiv);
                this.#applyCodeFormatting(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (e) {
                console.error('ボットメッセージのMarkdown解析エラー:', e);
                messageContent.textContent = await this.#formatMessage(message || '');
                contentDiv.appendChild(messageContent);
                bodyDiv.appendChild(contentDiv);
                messageDiv.appendChild(bodyDiv);
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    /**
     * 思考過程コンテナ付きでボットメッセージを追加する（復元用）
     * ページ更新時の会話履歴復元で使用します
     * @param {string} message - メッセージ内容
     * @param {HTMLElement} chatMessages - メッセージを表示する要素
     * @param {number|null} timestamp - メッセージのタイムスタンプ
     * @returns {Promise<{messageDiv: HTMLElement, thinkingContainer: HTMLElement, contentContainer: HTMLElement}>}
     */
    async addBotMessageWithThinking(message, chatMessages, timestamp = null) {
        if (!chatMessages) return null;

        const msgTimestamp = timestamp || Date.now();
        const provider = this.#getCurrentProvider();

        // メッセージコンテナ作成
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.dataset.timestamp = msgTimestamp.toString();
        messageDiv.dataset.rawMessage = message || '';
        messageDiv.setAttribute('role', 'region');
        messageDiv.setAttribute('aria-label', 'AIからの返答');

        // アバター作成
        const avatarDiv = this.#createAvatar('bot', provider);
        messageDiv.appendChild(avatarDiv);

        // メッセージボディ作成
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'message-body';

        // ヘッダー
        const senderName = this.#getProviderDisplayName(provider);
        const headerDiv = this.#createMessageHeader(senderName, msgTimestamp);
        bodyDiv.appendChild(headerDiv);

        // コンテンツ
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // 思考過程コンテナを作成（初期状態では非表示）
        const thinkingContainer = this.#createThinkingContainer();
        contentDiv.appendChild(thinkingContainer);

        // 回答本文コンテナを作成
        const markdownContent = document.createElement('div');
        markdownContent.className = 'markdown-content';

        try {
            const renderedMarkdown = await Markdown.getInstance.renderMarkdown(message || '');
            markdownContent.innerHTML = renderedMarkdown;
        } catch (e) {
            console.error('ボットメッセージのMarkdown解析エラー:', e);
            markdownContent.textContent = await this.#formatMessage(message || '');
        }

        contentDiv.appendChild(markdownContent);
        bodyDiv.appendChild(contentDiv);

        // アクションボタン
        const actionsDiv = this.#createBotMessageActions(messageDiv, message || '');
        bodyDiv.appendChild(actionsDiv);

        messageDiv.appendChild(bodyDiv);
        chatMessages.appendChild(messageDiv);
        this.#applyCodeFormatting(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return {
            messageDiv: messageDiv,
            thinkingContainer: thinkingContainer,
            contentContainer: markdownContent
        };
    }

    /**
     * ストリーミング用のボットメッセージを追加する
     * チャットメッセージ領域に、AIの応答を表示するためのメッセージ要素を追加します
     * 思考過程コンテナと回答本文コンテナを分離して作成します
     * @param {HTMLElement} chatMessages - メッセージを表示する要素
     * @param {number|null} timestamp - メッセージのタイムスタンプ
     * @returns {{messageDiv: HTMLElement, contentContainer: HTMLElement, thinkingContainer: HTMLElement, bodyDiv: HTMLElement}} メッセージ要素とコンテンツコンテナ
     */
    addStreamingBotMessage(chatMessages, timestamp = null) {
        if (!chatMessages) return null;

        const msgTimestamp = timestamp || Date.now();
        const provider = this.#getCurrentProvider();

        // メッセージコンテナ作成
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.dataset.timestamp = msgTimestamp.toString();
        messageDiv.setAttribute('role', 'region');
        messageDiv.setAttribute('aria-label', 'AIからの返答');

        // アバター作成
        const avatarDiv = this.#createAvatar('bot', provider);
        messageDiv.appendChild(avatarDiv);

        // メッセージボディ作成
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'message-body';

        // ヘッダー
        const senderName = this.#getProviderDisplayName(provider);
        const headerDiv = this.#createMessageHeader(senderName, msgTimestamp);
        bodyDiv.appendChild(headerDiv);

        // コンテンツ
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // 思考過程コンテナを作成（初期状態では非表示）
        const thinkingContainer = this.#createThinkingContainer();
        contentDiv.appendChild(thinkingContainer);

        // 回答本文コンテナを作成
        const markdownContent = document.createElement('div');
        markdownContent.className = 'markdown-content';

        // 初期状態: Thinking表示
        markdownContent.innerHTML = this.#formatSystemMessage('Thinking', true);

        contentDiv.appendChild(markdownContent);
        bodyDiv.appendChild(contentDiv);
        messageDiv.appendChild(bodyDiv);

        chatMessages.appendChild(messageDiv);
        this.#smoothScrollToBottom(chatMessages);

        return {
            messageDiv: messageDiv,
            contentContainer: markdownContent,
            thinkingContainer: thinkingContainer,
            bodyDiv: bodyDiv
        };
    }

    /**
     * 思考過程コンテナを作成する
     * @returns {HTMLElement} 思考過程コンテナ要素
     */
    #createThinkingContainer() {
        const container = document.createElement('div');
        container.className = 'thinking-process';
        container.dataset.collapsed = 'true'; // 初期状態は折りたたみ
        container.style.display = 'none'; // 思考アイテムがない場合は非表示

        // ヘッダー部分
        const header = document.createElement('div');
        header.className = 'thinking-header';
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('tabindex', '0');

        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'thinking-toggle';
        toggleIcon.textContent = '▶';

        const title = document.createElement('span');
        title.className = 'thinking-title';
        title.textContent = '思考過程';

        header.appendChild(toggleIcon);
        header.appendChild(title);

        // コンテンツ部分
        const content = document.createElement('div');
        content.className = 'thinking-content';

        container.appendChild(header);
        container.appendChild(content);

        // 折りたたみ切り替えイベント
        header.addEventListener('click', () => this.#toggleThinkingCollapse(container));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.#toggleThinkingCollapse(container);
            }
        });

        return container;
    }

    /**
     * 思考過程の折りたたみを切り替える
     * @param {HTMLElement} container - 思考過程コンテナ
     */
    #toggleThinkingCollapse(container) {
        if (!container) return;

        const isCollapsed = container.dataset.collapsed === 'true';
        container.dataset.collapsed = isCollapsed ? 'false' : 'true';

        const header = container.querySelector('.thinking-header');
        if (header) {
            header.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        }

        const toggle = container.querySelector('.thinking-toggle');
        if (toggle) {
            toggle.textContent = isCollapsed ? '▼' : '▶';
        }
    }

    /**
     * 思考過程にアイテムを追加する
     * @param {HTMLElement} thinkingContainer - 思考過程コンテナ
     * @param {string} type - アイテムの種類 ('rag', 'web-search', 'thinking')
     * @param {any} content - アイテムの内容
     */
    addThinkingItem(thinkingContainer, type, content) {
        if (!thinkingContainer) return;

        const thinkingContent = thinkingContainer.querySelector('.thinking-content');
        if (!thinkingContent) return;

        // コンテナを表示
        thinkingContainer.style.display = 'block';

        const item = document.createElement('div');
        item.className = 'thinking-item';
        item.dataset.type = type;

        switch (type) {
            case 'rag':
                item.innerHTML = this.#formatRAGThinkingItem(content);
                break;
            case 'web-search':
                item.innerHTML = this.#formatWebSearchThinkingItem(content);
                break;
            case 'tool':
                item.innerHTML = this.#formatToolThinkingItem(content, 'running');
                break;
            case 'tool-complete':
                item.innerHTML = this.#formatToolThinkingItem(content, 'complete');
                break;
            case 'tool-error':
                item.innerHTML = this.#formatToolThinkingItem(content, 'error');
                break;
            case 'thinking':
            default:
                item.innerHTML = this.#formatGenericThinkingItem(content);
                break;
        }

        thinkingContent.appendChild(item);
    }

    /**
     * RAG参照のフォーマット
     * @param {Array<{docName: string, similarity: number}>} sources - 参照資料
     * @returns {string} フォーマットされたHTML
     */
    #formatRAGThinkingItem(sources) {
        if (!sources || sources.length === 0) {
            return '<span class="thinking-item-icon">📚</span><span class="thinking-item-text">ナレッジベースを参照中...</span>';
        }

        const sourceList = sources.map(s =>
            `<div class="rag-source-item">
                <span class="rag-source-name">${this.#escapeHtml(s.docName)}</span>
                <span class="rag-source-similarity">${s.similarity}%</span>
            </div>`
        ).join('');

        return `<span class="thinking-item-icon">📚</span>
            <div class="thinking-item-content">
                <span class="thinking-item-text">ナレッジベース参照:</span>
                <div class="rag-sources-list">${sourceList}</div>
            </div>`;
    }

    /**
     * Web検索のフォーマット
     * @param {string} query - 検索クエリ
     * @returns {string} フォーマットされたHTML
     */
    #formatWebSearchThinkingItem(query) {
        const queryText = query ? `"${this.#escapeHtml(query)}"` : '';
        return `<span class="thinking-item-icon">🔍</span><span class="thinking-item-text">Web検索を実行: ${queryText}</span>`;
    }

    /**
     * 汎用思考アイテムのフォーマット
     * @param {string} message - メッセージ
     * @returns {string} フォーマットされたHTML
     */
    #formatGenericThinkingItem(message) {
        return `<span class="thinking-item-icon">💭</span><span class="thinking-item-text">${this.#escapeHtml(message || '')}</span>`;
    }

    /**
     * ツール実行アイテムのフォーマット
     * @param {string} content - メッセージ内容
     * @param {string} status - ステータス ('running', 'complete', 'error')
     * @returns {string} フォーマットされたHTML
     */
    #formatToolThinkingItem(content, status) {
        const icons = {
            'running': '🔧',
            'complete': '✅',
            'error': '❌'
        };
        const icon = icons[status] || '🔧';
        const statusClass = status === 'error' ? 'tool-error' : (status === 'complete' ? 'tool-complete' : 'tool-running');
        return `<span class="thinking-item-icon ${statusClass}">${icon}</span><span class="thinking-item-text">${this.#escapeHtml(content || '')}</span>`;
    }

    /**
     * HTMLエスケープ
     * @param {string} text - エスケープするテキスト
     * @returns {string} エスケープされたテキスト
     */
    #escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * ストリーミング中にボットメッセージを更新する
     * ストリーミングAPIから返されるチャンクをリアルタイムに表示します
     * @param {HTMLElement} container - 更新するメッセージコンテナ
     * @param {string} chunk - 新しく受信したテキストチャンク
     * @param {string} currentFullText - これまでに受信したテキスト全体
     * @param {boolean} isFirstChunk - 最初のチャンクかどうかのフラグ
     * @returns {Promise<void>}
     */
    async updateStreamingBotMessage(container, chunk, currentFullText, isFirstChunk = false) {
        if (!container) return;

        try {
            const renderedHTML = await Markdown.getInstance.renderMarkdown(currentFullText);
            const chatMessages = container.closest('.chat-messages');
            if (chatMessages) {
                const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50;
                container.innerHTML = renderedHTML;

                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(container);
                }

                if (isNearBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        } catch (e) {
            console.error('ストリーミング中のMarkdown解析エラー:', e);
            container.textContent = currentFullText;
        }
    }

    /**
     * ストリーミング中のステータス表示を更新します（ツール実行中など）
     * @param {HTMLElement} container - 内容を表示するコンテナ要素（.markdown-content）
     * @param {string} status - ステータスの種類 ('thinking' | 'tool-running' | 'tool-complete')
     * @param {string} [toolName] - ツール名（tool-running時に使用）
     */
    updateStreamingStatus(container, status, toolName = '') {
        if (!container) return;

        // 現在のテキストコンテンツを保持（ツール完了後に復元）
        const existingContent = container.querySelector('.streaming-status-temp');

        let statusHtml = '';
        switch (status) {
            case 'tool-running':
                const displayName = this.#getToolDisplayName(toolName);
                statusHtml = `<p class="streaming-status streaming-status-tool">
                    <span class="tool-status-icon">🔧</span>
                    <span class="tool-status-text">${displayName}を作成中</span>
                    <span class="typing-dots cyber-neon"><span></span><span></span><span></span></span>
                </p>`;
                break;
            case 'tool-complete':
                // ツール完了時はThinkingに戻す（テキストがある場合はそれを表示）
                statusHtml = this.#formatSystemMessage('Thinking', true);
                break;
            case 'thinking':
            default:
                statusHtml = this.#formatSystemMessage('Thinking', true);
                break;
        }

        // 既存のツール結果要素を保存
        const toolResults = container.querySelectorAll('.tool-download-card, .tool-image-preview, .tool-analysis-result');
        const savedToolResults = Array.from(toolResults);

        container.innerHTML = statusHtml;

        // ツール結果要素を再追加
        savedToolResults.forEach(result => {
            container.appendChild(result);
        });
    }

    /**
     * ツール名から表示名を取得
     * @param {string} toolName - ツール内部名
     * @returns {string} 表示名
     */
    #getToolDisplayName(toolName) {
        const displayNames = {
            'generate_powerpoint': 'PowerPoint',
            'process_excel': 'Excel',
            'render_canvas': 'Canvas画像'
        };
        return displayNames[toolName] || toolName;
    }

    /**
     * ストリーミングが完了したらボットメッセージを完成させる
     * マークダウンレンダリングを適用し、アクションボタンを追加して最終的な表示を整えます
     * 思考過程コンテナは保持されます
     * @param {HTMLElement} messageDiv - メッセージの親要素
     * @param {HTMLElement} container - 内容を表示するコンテナ要素（.markdown-content）
     * @param {string} fullText - 完全なレスポンステキスト
     * @param {HTMLElement} [bodyDiv] - メッセージボディ要素（オプション）
     * @returns {Promise<void>}
     */
    async finalizeStreamingBotMessage(messageDiv, container, fullText, bodyDiv = null) {
        if (!messageDiv || !container) return;

        try {
            // ツール結果要素を退避（innerHTML上書き前に保存）
            const toolResults = container.querySelectorAll('.tool-download-card, .tool-image-preview, .tool-analysis-result');
            const savedToolResults = Array.from(toolResults);

            // 回答本文のみを更新（思考過程コンテナは保持される）
            const renderedHTML = await Markdown.getInstance.renderMarkdown(fullText);
            container.innerHTML = renderedHTML;

            // ツール結果要素を再追加
            if (savedToolResults.length > 0) {
                savedToolResults.forEach(el => container.appendChild(el));
            }

            // rawMessageを設定
            messageDiv.dataset.rawMessage = fullText;

            // アクションボタンを追加（新しいDOM構造用）
            const body = bodyDiv || messageDiv.querySelector('.message-body');
            if (body) {
                this.addActionsToStreamingMessage(messageDiv, body, fullText);
            }

            const contentDiv = messageDiv.querySelector('.message-content');
            if (contentDiv) {
                // 既存のコピーボタンを削除（レガシー対応）
                const existingButton = contentDiv.querySelector('.copy-button');
                if (existingButton) {
                    contentDiv.removeChild(existingButton);
                }
            }

            if (typeof Prism !== 'undefined') {
                Prism.highlightAllUnder(messageDiv);
            }

            this.#addCodeBlockCopyButtons(messageDiv);

            // アーティファクト検出と表示
            this.#detectAndDisplayArtifacts(fullText);

        } catch (e) {
            console.error('ストリーミング完了時のMarkdown解析エラー:', e);
            container.textContent = fullText;
        }
    }

    /**
     * アーティファクトを検出して表示する
     * @param {string} fullText - 完全なレスポンステキスト
     */
    #detectAndDisplayArtifacts(fullText) {
        try {
            // アーティファクト検出が有効かチェック
            const artifactConfig = window.CONFIG?.ARTIFACT || {};
            if (artifactConfig.AUTO_PREVIEW === false) {
                return;
            }

            // ArtifactDetectorが利用可能かチェック
            if (typeof ArtifactDetector === 'undefined') {
                return;
            }

            // アーティファクトを検出
            const artifacts = ArtifactDetector.getInstance.detectArtifacts(fullText);

            if (artifacts.length === 0) {
                return;
            }

            // ArtifactManagerが利用可能かチェック
            if (typeof ArtifactManager === 'undefined') {
                return;
            }

            // アーティファクトを登録（最初のアーティファクトのみパネルに表示）
            artifacts.forEach((artifact, index) => {
                ArtifactManager.getInstance.registerArtifact(artifact);
            });

            console.log(`[ChatRenderer] Detected ${artifacts.length} artifact(s)`);

        } catch (error) {
            console.error('[ChatRenderer] アーティファクト検出エラー:', error);
        }
    }

    /**
     * メッセージをフォーマットします（改行やコードブロックを処理）
     * @param {string} message - フォーマットするメッセージ
     * @returns {Promise<string>} フォーマットされたメッセージHTML
     */
    async #formatMessage(message) {
        if (!message) return '';

        try {
            let formattedMessage = await Markdown.getInstance.renderMarkdown(message);

            // 改行を<br>に変換
            formattedMessage = formattedMessage.replace(/\n/g, '<br>');

            // インラインコードを処理
            formattedMessage = formattedMessage.replace(/`([^`]+)`/g, '<code>$1</code>');

            // コードブロックを処理
            formattedMessage = formattedMessage.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                const language = lang ? ` class="language-${lang}"` : '';
                return `<pre><code${language}>${code}</code></pre>`;
            });

            return formattedMessage;
        } catch (error) {
            console.error('メッセージフォーマットエラー:', error);
            return Markdown.getInstance.escapeHtml(message).replace(/\n/g, '<br>');
        }
    }


    /**
     * コードブロックのフォーマットとハイライトを適用する
     * メッセージ内のコードブロックにシンタックスハイライトとコピーボタンを追加します
     * @param {HTMLElement} messageDiv - コードブロックを含むメッセージ要素
     * @returns {void}
     */
    #applyCodeFormatting(messageDiv) {
        if (!messageDiv) return;

        requestAnimationFrame(() => {
            try {
                this.#addCodeBlockCopyButtons(messageDiv);
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(messageDiv);
                }
            } catch (error) {
                console.error('コードハイライト処理中にエラーが発生しました:', error);
            }
        });
    }

    /**
     * タイピングアニメーションを実行する
     * ボットのメッセージを文字単位で徐々に表示するアニメーション効果を適用します
     * @param {string} message - 表示するメッセージ内容
     * @param {HTMLElement} container - メッセージを表示する要素
     * @returns {Promise<void>}
     */
    async #animateTyping(message, container) {
        if (!message || !container) return;

        const typingConfig = window.CONFIG?.UI?.TYPING_EFFECT || {};
        const typingEnabled = typingConfig.ENABLED !== undefined ? typingConfig.ENABLED : true;

        if (!typingEnabled) {
            try {
                const renderedHTML = await Markdown.getInstance.renderMarkdown(message);
                container.innerHTML = renderedHTML;

                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(container);
                }

                this.#addCodeBlockCopyButtons(container.closest('.message'));
                return;
            } catch (e) {
                console.error('メッセージレンダリング中にエラーが発生しました:', e);
                container.textContent = message;
                return;
            }
        }

        let markdownText = '';
        const typingSpeed = typingConfig.SPEED !== undefined ? typingConfig.SPEED : 5;
        const bufferSize = typingConfig.BUFFER_SIZE !== undefined ? typingConfig.BUFFER_SIZE : 5;
        let currentIndex = 0;

        const typeNextCharacters = async () => {
            if (currentIndex < message.length) {
                const charsToAdd = Math.min(bufferSize, message.length - currentIndex);
                markdownText += message.substring(currentIndex, currentIndex + charsToAdd);
                currentIndex += charsToAdd;

                try {
                    const renderedHTML = await Markdown.getInstance.renderMarkdown(markdownText);
                    container.innerHTML = renderedHTML;

                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(container);
                    }

                    this.#addCodeBlockCopyButtons(container.closest('.message'));

                    const chatMessages = container.closest('.chat-messages');
                    if (chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                } catch (e) {
                    console.error('タイピング中のMarkdown解析エラー:', e);
                    container.textContent = markdownText;
                }

                setTimeout(typeNextCharacters, typingSpeed);
            }
        };

        await typeNextCharacters();
    }

    /**
     * コピーボタンを作成する
     * テキストをクリップボードにコピーするためのボタン要素を生成します
     * @param {string} textToCopy - コピー対象のテキスト
     * @returns {HTMLElement} 作成されたコピーボタン要素
     */
    #createCopyButton(textToCopy) {
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';

        copyButton.addEventListener('click', () => {
            if (!textToCopy) {
                console.warn('コピーするテキストが空です');
                return;
            }

            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    this.#showCopySuccess(copyButton);
                })
                .catch(err => {
                    console.error('クリップボードへのコピーに失敗しました:', err);
                    this.#showCopyError(copyButton);
                });
        });

        return copyButton;
    }


    /**
     * コードブロックにコピーボタン、編集ボタン、実行ボタンを追加します
     * @param {HTMLElement} messageElement - コードブロックを含むメッセージ要素
     */
    #addCodeBlockCopyButtons(messageElement) {
        if (!messageElement) return;

        try {
            const codeBlocks = messageElement.querySelectorAll('pre code');
            if (!codeBlocks || codeBlocks.length === 0) return;

            codeBlocks.forEach((codeBlock, index) => {
                const pre = codeBlock.parentElement;
                if (!pre) return;

                // すでにラッパーがある場合はスキップ
                if (pre.parentNode && /** @type {HTMLElement} */ (pre.parentNode).classList.contains('code-block')) {
                    return;
                }

                // 言語クラスからコード言語を特定
                const langClass = Array.from(codeBlock.classList)
                    .find(cls => cls.startsWith('language-'));
                const language = langClass ? langClass.replace('language-', '') : '';

                // ラッパーでコードブロックを囲む
                const wrapper = document.createElement('div');
                wrapper.classList.add('code-block');

                // 言語表示を追加
                if (language && language !== 'plaintext' && language !== 'none') {
                    const langLabel = document.createElement('div');
                    langLabel.classList.add('code-language');
                    langLabel.textContent = this.#getNiceLanguageName(language);
                    wrapper.appendChild(langLabel);
                }

                // ラッパーに元のpreを移動
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);

                // ツールバーを作成
                const toolbar = document.createElement('div');
                toolbar.classList.add('code-block-toolbar');

                // コピーボタンを追加
                const copyButton = this.#createCodeCopyButton(index, /** @type {HTMLElement} */(codeBlock));
                toolbar.appendChild(copyButton);

                // 編集ボタンを追加
                const editButton = this.#createEditButton(index, /** @type {HTMLElement} */(codeBlock), language);
                toolbar.appendChild(editButton);

                // 実行可能言語の場合は実行ボタンを追加
                if (this.#isExecutableLanguage(language)) {
                    const executeButton = this.#createExecuteButton(index, /** @type {HTMLElement} */(codeBlock), language);
                    toolbar.appendChild(executeButton);
                }

                // アーティファクト対応言語の場合はアーティファクトボタンを追加
                if (this.#isArtifactLanguage(language)) {
                    const artifactButton = this.#createArtifactButton(index, /** @type {HTMLElement} */(codeBlock), language);
                    toolbar.appendChild(artifactButton);
                }

                wrapper.appendChild(toolbar);
            });
        } catch (error) {
            console.error('コードブロックボタン追加エラー:', error);
        }
    }

    /**
     * 言語が実行可能かどうかを判定します
     * @param {string} language - 判定する言語
     * @returns {boolean} 実行可能な場合はtrue
     */
    #isExecutableLanguage(language) {
        if (!language) return false;
        return window.CONFIG.EXECUTABLE_LANGUAGES.includes(language.toLowerCase());
    }

    /**
     * コード実行ボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @param {string} language - コードの言語
     * @returns {HTMLElement} 作成された実行ボタン要素
     */
    #createExecuteButton(index, codeBlock, language) {
        if (!codeBlock || !language) return document.createElement('button');

        const executeButton = document.createElement('button');
        executeButton.classList.add('code-execute-button');
        executeButton.innerHTML = '<i class="fas fa-play"></i>';
        executeButton.title = 'コードを実行';
        executeButton.setAttribute('data-code-index', String(index));
        executeButton.setAttribute('data-language', language);
        executeButton.setAttribute('aria-label', 'コードを実行');

        // 実行ボタンのクリックイベント
        executeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.#handleExecuteButtonClick(executeButton, codeBlock, language);
        });

        return executeButton;
    }

    /**
     * 実行ボタンのクリックイベントを処理します
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - 実行対象のコードブロック
     * @param {string} language - コードの言語
     */
    async #handleExecuteButtonClick(button, codeBlock, language) {
        if (!button || !codeBlock || !language || typeof CodeExecutor === 'undefined') {
            console.error('コード実行に必要な要素が見つかりません');
            return;
        }

        // ボタンの元の状態を保存（スコープ問題を防ぐために関数の上部に移動）
        const originalButtonHtml = button.innerHTML || '<i class="fas fa-play"></i>';

        try {
            // ボタンの状態を実行中に変更
            /** @type {HTMLButtonElement} */ (button).disabled = true;
            button.classList.add('code-executing');
            button.innerHTML = '<span class="executing-spinner"></span>';

            // 既存の実行結果を削除
            const parentBlock = codeBlock.closest('.code-block');
            if (parentBlock) {
                const existingResult = parentBlock.querySelector('.code-execution-result');
                if (existingResult) {
                    parentBlock.removeChild(existingResult);
                }
            }

            // リアルタイム出力用の要素を作成
            let resultElement = null;
            if (parentBlock) {
                resultElement = document.createElement('div');
                resultElement.classList.add('code-execution-result');

                // ステータス表示用の要素
                const statusElement = document.createElement('div');
                statusElement.classList.add('execution-status');
                statusElement.textContent = '実行準備中...';
                resultElement.appendChild(statusElement);

                // HTML言語の場合は特別なコンテナを用意
                if (language === 'html') {
                    const htmlContainer = document.createElement('div');
                    htmlContainer.classList.add('html-result-container');
                    resultElement.appendChild(htmlContainer);
                } else {
                    // 通常の言語の場合はリアルタイム出力表示用の要素
                    const outputElement = document.createElement('pre');
                    outputElement.classList.add('realtime-output');
                    resultElement.appendChild(outputElement);
                }

                parentBlock.appendChild(resultElement);
            }

            // コードを取得して実行
            const code = codeBlock.textContent;
            await CodeExecutor.getInstance.executeCode(code, language, resultElement);

        } catch (error) {
            console.error('コード実行中にエラーが発生しました:', error);

            // エラーメッセージを表示
            const errorMsg = {
                error: `実行エラー: ${error.message || '不明なエラー'}`,
                errorDetail: error.stack
            };

            const parentBlock = codeBlock.closest('.code-block');
            if (parentBlock) {
                const errorElement = document.createElement('div');
                errorElement.classList.add('code-execution-result');

                const errorDiv = document.createElement('div');
                errorDiv.classList.add('execution-error');
                errorDiv.textContent = errorMsg.error;

                if (errorMsg.errorDetail) {
                    const errorDetail = document.createElement('pre');
                    errorDetail.classList.add('error-details');
                    errorDetail.textContent = errorMsg.errorDetail;
                    errorDiv.appendChild(errorDetail);
                }

                errorElement.appendChild(errorDiv);
                parentBlock.appendChild(errorElement);
            }
        } finally {
            // ボタンを元の状態に戻す
            /** @type {HTMLButtonElement} */ (button).disabled = false;
            button.classList.remove('code-executing');
            button.innerHTML = originalButtonHtml;
        }
    }

    /**
     * 言語IDから表示用の言語名を取得
     * @param {string} langId - 言語ID
     * @returns {string} 表示用言語名
     */
    #getNiceLanguageName(langId) {
        if (!langId) return '';

        const languageMap = {
            'js': 'JavaScript',
            'javascript': 'JavaScript',
            'ts': 'TypeScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'py': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'java': 'Java',
            'csharp': 'C#',
            'cs': 'C#',
            'c': 'C',
            'cpp': 'C++',
            'php': 'PHP',
            'ruby': 'Ruby',
            'rb': 'Ruby',
            'go': 'Go',
            'rust': 'Rust',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'sql': 'SQL',
            'bash': 'Bash',
            'shell': 'Shell',
            'sh': 'Shell',
            'markdown': 'Markdown',
            'md': 'Markdown',
            'yaml': 'YAML',
            'yml': 'YAML',
            'xml': 'XML',
            'plaintext': 'Text'
        };

        return languageMap[langId.toLowerCase()] || langId;
    }

    /**
     * コードブロック用のコピーボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @returns {HTMLElement} 作成されたコピーボタン要素
     */
    #createCodeCopyButton(index, codeBlock) {
        if (!codeBlock) return document.createElement('button');

        const copyButton = document.createElement('button');
        copyButton.classList.add('code-copy-button');
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'コードをコピー';
        copyButton.setAttribute('data-code-index', String(index));
        copyButton.setAttribute('aria-label', 'コードをクリップボードにコピー');

        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.#handleCopyButtonClick(copyButton, codeBlock);
        });

        return copyButton;
    }

    /**
     * コード編集ボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @param {string} language - コードの言語
     * @returns {HTMLElement} 作成された編集ボタン要素
     */
    #createEditButton(index, codeBlock, language) {
        if (!codeBlock) return document.createElement('button');

        const editButton = document.createElement('button');
        editButton.classList.add('code-edit-button');
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        editButton.title = 'コードを編集';
        editButton.setAttribute('data-code-index', String(index));
        editButton.setAttribute('data-language', language);
        editButton.setAttribute('aria-label', 'コードを編集');

        // 編集ボタンのクリックイベント
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.#handleEditButtonClick(editButton, codeBlock, language);
        });

        return editButton;
    }

    /**
     * 編集ボタンのクリックイベントを処理します
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - 編集対象のコードブロック
     * @param {string} language - コードの言語
     */
    #handleEditButtonClick(button, codeBlock, language) {
        if (!button || !codeBlock) {
            console.error('コード編集に必要な要素が見つかりません');
            return;
        }

        try {
            // コードを取得して前後の空白を整理
            const rawCode = codeBlock.textContent || '';
            const code = rawCode.trim();

            // 実際にコードがあるか確認
            if (!code) {
                console.warn('編集するコードが空です');
            }

            // エディタにきちんとコードが渡るように少し遅延させる
            setTimeout(() => {
                // ChatUIのグローバル参照チェック
                if (typeof ChatUI !== 'undefined' && ChatUI.getInstance) {
                    ChatUI.getInstance.showCodeEditor(codeBlock, code, language);
                } else {
                    console.error('ChatUIが見つかりません。エディタは表示できません。');
                    alert('コードエディタを開けませんでした。ページを再読み込みしてからお試しください。');
                }
            }, 100);

        } catch (error) {
            console.error('コード編集の準備中にエラーが発生しました:', error);
        }
    }

    /**
     * コピーボタンのクリックイベントを処理します
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - コピー対象のコードブロック
     */
    #handleCopyButtonClick(button, codeBlock) {
        if (!button || !codeBlock) return;

        try {
            // トリミングしてコピー（余分な空白行を削除）
            const codeText = this.#cleanCodeForCopy(codeBlock.textContent);

            navigator.clipboard.writeText(codeText)
                .then(() => {
                    this.#showCopySuccess(button);
                })
                .catch(err => {
                    console.error('コードのコピーに失敗しました:', err);
                    this.#showCopyError(button);
                });
        } catch (error) {
            console.error('コピー処理エラー:', error);
            this.#showCopyError(button);
        }
    }

    /**
     * コードをコピー用に整形する
     * @param {string} code - 整形するコード
     * @returns {string} 整形されたコード
     */
    #cleanCodeForCopy(code) {
        if (!code) return '';

        // 前後の空白を削除
        let cleanCode = code.trim();

        // 連続する空行を単一の空行に置換
        cleanCode = cleanCode.replace(/\n\s*\n\s*\n/g, '\n\n');

        return cleanCode;
    }

    /**
     * コピー成功時の表示を更新
     */
    #showCopySuccess(button) {
        if (!button) return;

        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i>';

        setTimeout(() => {
            if (button) {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }
        }, 1500);
    }

    /**
     * コピー失敗時の表示を更新
     */
    #showCopyError(button) {
        if (!button) return;

        button.classList.add('error');
        button.innerHTML = '<i class="fas fa-times"></i>';

        setTimeout(() => {
            if (button) {
                button.classList.remove('error');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }
        }, 1500);
    }

    /**
     * 言語がアーティファクト対応かどうかを判定します
     * @param {string} language - 判定する言語
     * @returns {boolean} アーティファクト対応の場合はtrue
     */
    #isArtifactLanguage(language) {
        if (!language) return false;
        const artifactLanguages = [
            'html', 'svg', 'markdown', 'md', 'mermaid',
            'drawio', 'draw.io', 'mxfile',
            'javascript', 'js', 'typescript', 'ts',
            'python', 'py', 'cpp', 'c++'
        ];
        return artifactLanguages.includes(language.toLowerCase());
    }

    /**
     * アーティファクトボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @param {string} language - コードの言語
     * @returns {HTMLElement} 作成されたアーティファクトボタン要素
     */
    #createArtifactButton(index, codeBlock, language) {
        if (!codeBlock || !language) return document.createElement('button');

        const artifactButton = document.createElement('button');
        artifactButton.classList.add('artifact-open-button');
        artifactButton.innerHTML = '<i class="fas fa-external-link-alt"></i>';
        artifactButton.title = 'アーティファクトとして開く';
        artifactButton.setAttribute('data-code-index', String(index));
        artifactButton.setAttribute('data-language', language);
        artifactButton.setAttribute('aria-label', 'アーティファクトとして開く');

        // アーティファクトボタンのクリックイベント
        artifactButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#handleArtifactButtonClick(codeBlock, language);
        });

        return artifactButton;
    }

    /**
     * アーティファクトボタンのクリックイベントを処理します
     * @param {HTMLElement} codeBlock - 対象のコードブロック
     * @param {string} language - コードの言語
     */
    #handleArtifactButtonClick(codeBlock, language) {
        if (!codeBlock || !language) return;

        try {
            // ArtifactDetectorとArtifactManagerが利用可能かチェック
            if (typeof ArtifactDetector === 'undefined' || typeof ArtifactManager === 'undefined') {
                console.warn('アーティファクト機能が利用できません');
                return;
            }

            const code = codeBlock.textContent || '';
            if (!code.trim()) {
                console.warn('コードが空です');
                return;
            }

            // タイプを正規化
            const typeMap = {
                'html': 'html',
                'svg': 'svg',
                'markdown': 'markdown',
                'md': 'markdown',
                'mermaid': 'mermaid',
                'drawio': 'drawio',
                'draw.io': 'drawio',
                'mxfile': 'drawio',
                'javascript': 'javascript',
                'js': 'javascript',
                'typescript': 'typescript',
                'ts': 'typescript',
                'python': 'python',
                'py': 'python',
                'cpp': 'cpp',
                'c++': 'cpp'
            };
            const type = typeMap[language.toLowerCase()] || language.toLowerCase();

            // アーティファクトを作成
            const artifact = {
                id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: type,
                title: this.#getArtifactTitle(type),
                content: code.trim(),
                language: language,
                timestamp: Date.now()
            };

            // アーティファクトを登録（パネルが自動で開く）
            ArtifactManager.getInstance.registerArtifact(artifact);

            console.log(`[ChatRenderer] Created artifact from code block: ${artifact.id}`);

        } catch (error) {
            console.error('[ChatRenderer] アーティファクト作成エラー:', error);
        }
    }

    /**
     * アーティファクトのタイトルを取得
     * @param {string} type - アーティファクトタイプ
     * @returns {string} タイトル
     */
    #getArtifactTitle(type) {
        const titles = {
            'html': 'HTMLドキュメント',
            'svg': 'SVG画像',
            'markdown': 'Markdownドキュメント',
            'mermaid': 'Mermaid図',
            'javascript': 'JavaScriptコード',
            'typescript': 'TypeScriptコード',
            'python': 'Pythonコード',
            'cpp': 'C++コード'
        };
        return titles[type] || 'アーティファクト';
    }

    /**
     * システムメッセージを表示する
     * @param {HTMLElement} chatMessages - チャットメッセージコンテナ
     * @param {string} message - 表示するメッセージ
     * @param {Object} options - 表示オプション
     * @param {string} options.status - メッセージの状態 ('thinking', 'searching', 'processing', 'error')
     * @param {string} options.animation - アニメーション種類 ('fade', 'slide', 'pulse', 'gradient', 'ripple', 'particles')
     * @param {boolean} options.showDots - タイピングドットを表示するか
     * @returns {Object} メッセージ要素の参照
     */
    addSystemMessage(chatMessages, message, options = { status: 'info', animation: 'fade', showDots: false }) {
        if (!chatMessages) return null;

        const {
            status = 'thinking',
            animation = 'tech-scan',
            showDots = true
        } = options;

        const messageDiv = ChatUI.getInstance.createElement('div', {
            classList: ['message', 'bot', 'system-message', 'cyber-style', `anim-${animation}`],
            attributes: {
                'role': 'status',
                'aria-live': 'polite',
                'data-status': status
            }
        });

        const contentDiv = ChatUI.getInstance.createElement('div', { classList: 'message-content' });

        const messageContent = ChatUI.getInstance.createElement('div', {
            classList: 'markdown-content',
            innerHTML: this.#formatSystemMessage(message, showDots)
        });

        contentDiv.appendChild(messageContent);
        messageDiv.appendChild(contentDiv);

        // DOMに追加
        chatMessages.appendChild(messageDiv);

        console.log(`📝 messageDiv classes: ${messageDiv.className}`);

        // アニメーション開始（次フレームで実行してCSSが確実に適用されるようにする）
        setTimeout(() => {
            messageDiv.classList.add('animate');
        }, 50);

        // スクロール調整
        this.#smoothScrollToBottom(chatMessages);

        return {
            messageDiv: messageDiv,
            contentContainer: messageContent
        };
    }

    /**
     * システムメッセージを更新する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {string} message - 新しいメッセージ
     * @param {Object} options - 更新オプション
     * @param {string} options.status - メッセージの新しい状態
     * @param {boolean} options.animate - 変更アニメーションを使用するか
     * @param {boolean} options.showDots - タイピングドットを表示するか
     */
    updateSystemMessage(messageDiv, message, options = { status: 'info', animate: true, showDots: false }) {
        if (!messageDiv) return;

        const {
            status = null,
            animate = true,
            showDots = true
        } = options;

        const messageContent = messageDiv.querySelector('.markdown-content');
        if (!messageContent) return;

        // ステータスを更新
        if (status && messageDiv.getAttribute('data-status') !== status) {
            // ステータス変更のアニメーション
            if (animate) {
                messageDiv.classList.add('system-message-pulse');
                setTimeout(() => {
                    messageDiv.classList.remove('system-message-pulse');
                }, 1200); // より長いパルスアニメーション時間
            }
            messageDiv.setAttribute('data-status', status);
        }

        if (animate && messageContent.innerHTML !== this.#formatSystemMessage(message, showDots)) {
            // より滑らかなコンテンツ変更アニメーション
            // CSS transitionsを設定
            messageContent.style.transition = 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out';
            messageContent.style.transform = 'scale(0.95)';
            messageContent.style.opacity = '0.2';

            setTimeout(() => {
                messageContent.innerHTML = this.#formatSystemMessage(message, showDots);
                // 復帰アニメーション
                messageContent.style.transform = 'scale(1.02)'; // 少しオーバーシュート
                messageContent.style.opacity = '1';

                // オーバーシュート後の最終調整
                setTimeout(() => {
                    messageContent.style.transform = 'scale(1)';

                    // トランジション完了後にスタイルをクリア
                    setTimeout(() => {
                        messageContent.style.transition = '';
                        messageContent.style.transform = '';
                        messageContent.style.opacity = '';
                    }, 200);
                }, 150);
            }, 300); // より長いフェードアウト時間
        } else if (!animate) {
            messageContent.innerHTML = this.#formatSystemMessage(message, showDots);
        }
    }

    /**
     * システムメッセージを削除する
     * @param {HTMLElement} messageDiv - 削除するメッセージ要素
     * @param {Object} options - 削除オプション
     * @param {string} options.animation - 削除アニメーション ('fade', 'slide')
     * @param {number} options.delay - 削除前の遅延時間（ミリ秒）
     */
    removeSystemMessage(messageDiv, options = { animation: 'fade', delay: 0 }) {
        if (!messageDiv || !messageDiv.parentNode) return;

        const {
            animation = 'fade',
            delay = 0
        } = options;

        const performRemoval = () => {
            // 削除アニメーションクラスを追加
            if (animation === 'slide') {
                messageDiv.classList.add('system-message-slide-out');
            } else {
                messageDiv.classList.add('system-message-fade-out');
            }

            // アニメーション完了後に要素を削除
            const animationDuration = animation === 'slide' ? 300 : 200;
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, animationDuration);
        };

        if (delay > 0) {
            setTimeout(performRemoval, delay);
        } else {
            performRemoval();
        }
    }

    /**
     * コードブロックからコードを取得します
     * @param {HTMLElement} codeBlock - コードブロック要素
     * @returns {string} 取得したコード
     */
    #getCodeFromBlock(codeBlock) {
        if (!codeBlock) return '';

        try {
            // preタグ内のcodeタグを検出
            const codeElement = codeBlock.tagName.toLowerCase() === 'code' ?
                codeBlock : codeBlock.querySelector('code');

            if (codeElement) {
                // HTMLエンティティをデコード
                const text = codeElement.textContent || '';
                return this.#decodeHtmlEntities(text.trim());
            }

            // 直接テキストを取得
            return this.#decodeHtmlEntities((codeBlock.textContent || '').trim());
        } catch (error) {
            console.error('コードの取得に失敗:', error);
            return '';
        }
    }

    /**
     * HTMLエンティティをデコードします
     * @param {string} text - デコードするテキスト
     * @returns {string} デコードされたテキスト
     */
    #decodeHtmlEntities(text) {
        const element = document.createElement('div');
        element.innerHTML = text;
        return element.textContent || text;
    }

    /**
     * システムメッセージをフォーマットします
     * @param {string} message - メッセージ
     * @param {boolean} showDots - タイピングドットを表示するか
     * @returns {string} フォーマット済みメッセージHTML
     */
    #formatSystemMessage(message, showDots) {
        const dotsHtml = showDots ?
            '<span class="typing-dots"><span></span><span></span><span></span></span>' : '';
        return `<p>${message}${dotsHtml}</p>`;
    }

    /**
     * スムーズにスクロールして最下部に移動します
     * @param {HTMLElement} container - スクロール対象のコンテナ
     */
    #smoothScrollToBottom(container) {
        if (!container) return;

        // スムーズスクロールをサポートしている場合は使用
        if ('scrollBehavior' in document.documentElement.style) {
            setTimeout(() => {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }, 50);
        } else {
            // フォールバック：通常のスクロール
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    }

    // ========== 新規追加: ChatGPT風UI用ヘルパーメソッド ==========

    /**
     * 現在のAIプロバイダを取得する
     * @returns {string} プロバイダ名 ('openai', 'claude', 'gemini')
     */
    #getCurrentProvider() {
        const model = window.AppState?.getCurrentModel?.() || '';
        if (model.includes('claude')) return 'claude';
        if (model.includes('gemini')) return 'gemini';
        return 'openai';
    }

    /**
     * プロバイダの表示名を取得する
     * @param {string} provider - プロバイダ名
     * @returns {string} 表示名
     */
    #getProviderDisplayName(provider) {
        const names = {
            'openai': 'ChatGPT',
            'claude': 'Claude',
            'gemini': 'Gemini'
        };
        return names[provider] || 'AI';
    }

    /**
     * アバター要素を作成する
     * @param {string} role - 'user' または 'bot'
     * @param {string} [provider] - AIプロバイダ名（botの場合）
     * @returns {HTMLElement} アバター要素
     */
    #createAvatar(role, provider = 'openai') {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';

        if (role === 'user') {
            avatar.textContent = 'U';
            avatar.classList.add('avatar-user');
        } else {
            avatar.dataset.provider = provider;
            // プロバイダー別の文字アイコン（著作権対応）
            switch (provider) {
                case 'openai':
                    avatar.textContent = 'G';
                    avatar.classList.add('avatar-openai');
                    break;
                case 'claude':
                    avatar.textContent = 'C';
                    avatar.classList.add('avatar-claude');
                    break;
                case 'gemini':
                    avatar.textContent = 'G';
                    avatar.classList.add('avatar-gemini');
                    break;
                default:
                    avatar.textContent = 'A';
                    avatar.classList.add('avatar-default');
            }
        }

        return avatar;
    }

    /**
     * メッセージヘッダーを作成する
     * @param {string} senderName - 送信者名
     * @param {number} timestamp - タイムスタンプ
     * @returns {HTMLElement} ヘッダー要素
     */
    #createMessageHeader(senderName, timestamp) {
        const header = document.createElement('div');
        header.className = 'message-header';

        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = senderName;

        const time = document.createElement('span');
        time.className = 'message-timestamp';
        time.textContent = this.#formatTimestamp(timestamp);
        time.title = this.#formatFullTimestamp(timestamp);

        header.appendChild(sender);
        header.appendChild(time);

        return header;
    }

    /**
     * タイムスタンプをフォーマットする（短縮形式）
     * @param {number} timestamp - タイムスタンプ
     * @returns {string} フォーマットされた時刻
     */
    #formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * タイムスタンプをフォーマットする（完全形式）
     * @param {number} timestamp - タイムスタンプ
     * @returns {string} フォーマットされた日時
     */
    #formatFullTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('ja-JP');
    }

    /**
     * ユーザーメッセージ用のアクションボタンを作成する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {string} messageText - メッセージテキスト
     * @returns {HTMLElement} アクション要素
     */
    #createUserMessageActions(messageDiv, messageText) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';

        // 編集ボタン
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = '編集';
        editBtn.addEventListener('click', () => this.#handleEditMessage(messageDiv));
        actions.appendChild(editBtn);

        // コピーボタン
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'コピー';
        copyBtn.addEventListener('click', () => this.#handleCopyMessage(copyBtn, messageText));
        actions.appendChild(copyBtn);

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = '削除';
        deleteBtn.addEventListener('click', () => this.#handleDeleteMessage(messageDiv));
        actions.appendChild(deleteBtn);

        return actions;
    }

    /**
     * ボットメッセージ用のアクションボタンを作成する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {string} messageText - メッセージテキスト
     * @returns {HTMLElement} アクション要素
     */
    #createBotMessageActions(messageDiv, messageText) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';

        // コピーボタン
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'コピー';
        copyBtn.addEventListener('click', () => this.#handleCopyMessage(copyBtn, messageText));
        actions.appendChild(copyBtn);

        // 再生成ボタン
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'action-btn regenerate-btn';
        regenerateBtn.innerHTML = '<i class="fas fa-redo"></i>';
        regenerateBtn.title = '再生成';
        regenerateBtn.addEventListener('click', () => this.#handleRegenerateMessage(messageDiv));
        actions.appendChild(regenerateBtn);

        // 👍 ボタン
        const likeBtn = document.createElement('button');
        likeBtn.className = 'action-btn reaction-btn like-btn';
        likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i>';
        likeBtn.title = '役に立った';
        likeBtn.addEventListener('click', () => this.#handleReaction(messageDiv, likeBtn, 'like'));
        actions.appendChild(likeBtn);

        // 👎 ボタン
        const dislikeBtn = document.createElement('button');
        dislikeBtn.className = 'action-btn reaction-btn dislike-btn';
        dislikeBtn.innerHTML = '<i class="fas fa-thumbs-down"></i>';
        dislikeBtn.title = '改善が必要';
        dislikeBtn.addEventListener('click', () => this.#handleReaction(messageDiv, dislikeBtn, 'dislike'));
        actions.appendChild(dislikeBtn);

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = '削除';
        deleteBtn.addEventListener('click', () => this.#handleDeleteMessage(messageDiv));
        actions.appendChild(deleteBtn);

        return actions;
    }

    /**
     * メッセージ編集を処理する
     * @param {HTMLElement} messageDiv - メッセージ要素
     */
    #handleEditMessage(messageDiv) {
        if (!messageDiv || messageDiv.classList.contains('editing')) return;

        const rawMessage = messageDiv.dataset.rawMessage || '';
        const bodyDiv = messageDiv.querySelector('.message-body');
        if (!bodyDiv) return;

        messageDiv.classList.add('editing');

        // 編集コンテナを作成
        const editContainer = document.createElement('div');
        editContainer.className = 'message-edit-container';

        const textarea = document.createElement('textarea');
        textarea.className = 'message-edit-textarea';
        textarea.value = rawMessage;

        const editActions = document.createElement('div');
        editActions.className = 'message-edit-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'edit-cancel-btn';
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.addEventListener('click', () => {
            messageDiv.classList.remove('editing');
            editContainer.remove();
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'edit-save-btn';
        saveBtn.textContent = '保存して送信';
        saveBtn.addEventListener('click', () => {
            const newMessage = textarea.value.trim();
            if (newMessage) {
                this.#submitEditedMessage(messageDiv, newMessage);
            }
        });

        editActions.appendChild(cancelBtn);
        editActions.appendChild(saveBtn);
        editContainer.appendChild(textarea);
        editContainer.appendChild(editActions);
        bodyDiv.appendChild(editContainer);

        textarea.focus();
    }

    /**
     * 編集したメッセージを送信する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {string} newMessage - 新しいメッセージ
     */
    async #submitEditedMessage(messageDiv, newMessage) {
        const timestamp = parseInt(messageDiv.dataset.timestamp, 10);
        const chatMessages = messageDiv.closest('.chat-messages');

        // 該当メッセージ以降を削除
        let sibling = messageDiv.nextElementSibling;
        while (sibling) {
            const next = sibling.nextElementSibling;
            sibling.remove();
            sibling = next;
        }
        messageDiv.remove();

        // AppStateの会話から該当メッセージ以降を削除
        if (window.AppState?.currentConversationId) {
            const conversation = window.AppState.getConversationById(window.AppState.currentConversationId);
            if (conversation) {
                const msgIndex = conversation.messages.findIndex(m =>
                    m.timestamp === timestamp ||
                    (m.role === 'user' && !m.timestamp)
                );
                if (msgIndex > 0) {
                    conversation.messages = conversation.messages.slice(0, msgIndex);
                }
            }
        }

        // 新しいメッセージを送信
        if (window.Elements?.userInput) {
            window.Elements.userInput.value = newMessage;
            if (typeof ChatActions !== 'undefined') {
                await ChatActions.getInstance.sendMessage();
            }
        }
    }

    /**
     * メッセージをコピーする
     * @param {HTMLElement} button - ボタン要素
     * @param {string} text - コピーするテキスト
     */
    async #handleCopyMessage(button, text) {
        try {
            await navigator.clipboard.writeText(text);
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('active');
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy"></i>';
                button.classList.remove('active');
            }, 2000);
        } catch (err) {
            console.error('コピーに失敗しました:', err);
        }
    }

    /**
     * メッセージを再生成する
     * @param {HTMLElement} messageDiv - メッセージ要素
     */
    async #handleRegenerateMessage(messageDiv) {
        const chatMessages = messageDiv.closest('.chat-messages');
        if (!chatMessages) return;

        // 直前のユーザーメッセージを探す
        let prevMessage = messageDiv.previousElementSibling;
        while (prevMessage && !prevMessage.classList.contains('user')) {
            prevMessage = prevMessage.previousElementSibling;
        }

        if (!prevMessage) {
            console.warn('直前のユーザーメッセージが見つかりません');
            return;
        }

        const userMessage = prevMessage.dataset.rawMessage || '';
        const userTimestamp = parseInt(prevMessage.dataset.timestamp, 10);

        // ユーザーメッセージも含めて削除する（sendMessageで再追加されるため）
        let sibling = prevMessage;
        while (sibling) {
            const next = sibling.nextElementSibling;
            sibling.remove();
            sibling = next;
        }

        // AppStateの会話から該当メッセージ以降を削除
        if (window.AppState?.currentConversationId) {
            const conversation = window.AppState.getConversationById(window.AppState.currentConversationId);
            if (conversation) {
                // ユーザーメッセージも含めて削除（sendMessageで再追加されるため）
                const msgIndex = conversation.messages.findIndex(m =>
                    m.timestamp === userTimestamp ||
                    (m.role === 'user' && m.content === userMessage)
                );
                if (msgIndex >= 0) {
                    conversation.messages = conversation.messages.slice(0, msgIndex);
                }
            }
        }

        // メッセージを再送信
        if (window.Elements?.userInput) {
            window.Elements.userInput.value = userMessage;
            if (typeof ChatActions !== 'undefined') {
                await ChatActions.getInstance.sendMessage();
            }
        }
    }

    /**
     * メッセージを削除する
     * @param {HTMLElement} messageDiv - メッセージ要素
     */
    #handleDeleteMessage(messageDiv) {
        if (!confirm('このメッセージを削除しますか？')) return;

        const timestamp = parseInt(messageDiv.dataset.timestamp, 10);
        const isUserMessage = messageDiv.classList.contains('user');

        // DOM から削除
        messageDiv.remove();

        // AppStateの会話から削除
        if (window.AppState?.currentConversationId) {
            const conversation = window.AppState.getConversationById(window.AppState.currentConversationId);
            if (conversation) {
                const msgIndex = conversation.messages.findIndex(m => m.timestamp === timestamp);
                if (msgIndex >= 0) {
                    conversation.messages.splice(msgIndex, 1);
                    // ストレージに保存
                    if (typeof Storage !== 'undefined') {
                        Storage.getInstance.saveConversations(window.AppState.conversations);
                    }
                }
            }
        }
    }

    /**
     * リアクションを処理する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {HTMLElement} button - ボタン要素
     * @param {string} type - 'like' または 'dislike'
     */
    #handleReaction(messageDiv, button, type) {
        const timestamp = messageDiv.dataset.timestamp;
        const conversationId = window.AppState?.currentConversationId;

        if (!timestamp || !conversationId) return;

        const reactionKey = `reaction_${conversationId}_${timestamp}`;
        const currentReaction = localStorage.getItem(reactionKey);

        // 同じボタンをクリックした場合はトグル
        if (currentReaction === type) {
            localStorage.removeItem(reactionKey);
            button.classList.remove(type === 'like' ? 'liked' : 'disliked');
        } else {
            localStorage.setItem(reactionKey, type);

            // 他のリアクションボタンのクラスを削除
            const actions = messageDiv.querySelector('.message-actions');
            if (actions) {
                const likeBtn = actions.querySelector('.like-btn');
                const dislikeBtn = actions.querySelector('.dislike-btn');
                if (likeBtn) likeBtn.classList.remove('liked');
                if (dislikeBtn) dislikeBtn.classList.remove('disliked');
            }

            button.classList.add(type === 'like' ? 'liked' : 'disliked');
        }
    }

    /**
     * ストリーミング完了後にアクションボタンを追加する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {HTMLElement} bodyDiv - メッセージボディ要素
     * @param {string} fullText - 完全なメッセージテキスト
     */
    addActionsToStreamingMessage(messageDiv, bodyDiv, fullText) {
        if (!messageDiv || !bodyDiv) return;

        // rawMessageを設定
        messageDiv.dataset.rawMessage = fullText;

        // 既存のアクションがあれば削除
        const existingActions = bodyDiv.querySelector('.message-actions');
        if (existingActions) {
            existingActions.remove();
        }

        // アクションボタンを追加
        const actionsDiv = this.#createBotMessageActions(messageDiv, fullText);
        bodyDiv.appendChild(actionsDiv);
    }
}