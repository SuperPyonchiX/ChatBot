/**
 * toolProgress.js
 * ツール実行中の進捗をUIに表示するコンポーネント
 */
class ToolProgress {
    static #instance = null;

    // ツール名の日本語マッピング
    #toolNames = {
        'generate_powerpoint': 'PowerPointスライド生成',
        'process_excel': 'Excel処理',
        'render_canvas': 'Canvas描画'
    };

    // ステータスアイコン
    #statusIcons = {
        'start': 'fa-spinner fa-spin',
        'progress': 'fa-spinner fa-spin',
        'complete': 'fa-check-circle',
        'error': 'fa-times-circle'
    };

    constructor() {
        if (ToolProgress.#instance) {
            return ToolProgress.#instance;
        }
        ToolProgress.#instance = this;
        this.#setupEventListeners();
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ToolProgress.#instance) {
            ToolProgress.#instance = new ToolProgress();
        }
        return ToolProgress.#instance;
    }

    /**
     * イベントリスナーを設定
     */
    #setupEventListeners() {
        // ToolExecutorのイベントを購読
        if (typeof ToolExecutor !== 'undefined') {
            ToolExecutor.getInstance.on('tool:start', (data) => {
                this.#showProgress(data.toolCall, 'start');
            });

            ToolExecutor.getInstance.on('tool:progress', (data) => {
                this.#updateProgress(data.toolCall, data.message);
            });

            ToolExecutor.getInstance.on('tool:complete', (data) => {
                this.#showProgress(data.toolCall, 'complete');
                this.#handleResult(data.toolCall, data.result);
            });

            ToolExecutor.getInstance.on('tool:error', (data) => {
                this.#showProgress(data.toolCall, 'error');
                this.#showError(data.toolCall, data.error);
            });
        }
    }

    /**
     * 進捗を表示
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {string} status - ステータス
     */
    #showProgress(toolCall, status) {
        const thinkingContainer = document.querySelector('.thinking-container');
        if (!thinkingContainer) {
            // thinking containerがない場合は作成を試みる
            this.#createThinkingItem(toolCall, status);
            return;
        }

        const toolName = this.#getToolDisplayName(toolCall.name);
        const icon = this.#statusIcons[status] || 'fa-cog';
        const statusClass = status === 'error' ? 'error' : (status === 'complete' ? 'complete' : 'running');

        // 既存のツール進捗要素を探す
        const existingItem = thinkingContainer.querySelector(`[data-tool-id="${toolCall.id}"]`);

        if (existingItem) {
            // 既存要素を更新
            const iconEl = existingItem.querySelector('i');
            if (iconEl) {
                iconEl.className = `fas ${icon}`;
            }
            existingItem.className = `thinking-item tool-progress ${statusClass}`;
        } else {
            // 新規要素を追加
            const item = document.createElement('div');
            item.className = `thinking-item tool-progress ${statusClass}`;
            item.setAttribute('data-tool-id', toolCall.id);
            item.innerHTML = `
                <i class="fas ${icon}"></i>
                <span class="tool-name">${toolName}</span>
                <span class="tool-status">${this.#getStatusText(status)}</span>
            `;
            thinkingContainer.appendChild(item);
        }
    }

    /**
     * thinking containerがない場合の代替表示
     */
    #createThinkingItem(toolCall, status) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const lastMessage = chatMessages.querySelector('.message.assistant:last-child');
        if (!lastMessage) return;

        let container = lastMessage.querySelector('.tool-progress-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'tool-progress-container';
            lastMessage.appendChild(container);
        }

        const toolName = this.#getToolDisplayName(toolCall.name);
        const icon = this.#statusIcons[status] || 'fa-cog';

        const item = document.createElement('div');
        item.className = `tool-progress-item ${status}`;
        item.setAttribute('data-tool-id', toolCall.id);
        item.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${toolName}</span>
        `;
        container.appendChild(item);
    }

    /**
     * 進捗を更新
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {string} message - メッセージ
     */
    #updateProgress(toolCall, message) {
        const item = document.querySelector(`[data-tool-id="${toolCall.id}"]`);
        if (item) {
            const statusEl = item.querySelector('.tool-status');
            if (statusEl) {
                statusEl.textContent = message;
            }
        }
    }

    /**
     * 結果を処理
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {Object} result - 実行結果
     */
    #handleResult(toolCall, result) {
        if (!result) return;

        switch (result.type) {
            case 'file':
                FileDownloader.getInstance.showDownloadButton(result, toolCall);
                break;
            case 'image':
                ToolPreview.getInstance.showImagePreview(result, toolCall);
                break;
            case 'json':
                // JSON結果は特別な表示は不要（AIが説明する）
                console.log('ツール結果 (JSON):', result.data);
                break;
            case 'text':
                console.log('ツール結果 (テキスト):', result.content);
                break;
        }
    }

    /**
     * エラーを表示
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {Error} error - エラー
     */
    #showError(toolCall, error) {
        const toolName = this.#getToolDisplayName(toolCall.name);
        const message = `${toolName}の実行に失敗しました: ${error.message || 'Unknown error'}`;

        // エラーメッセージをチャットに表示
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'tool-error-message';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <span>${this.#escapeHtml(message)}</span>
            `;
            chatMessages.appendChild(errorDiv);
        }
    }

    /**
     * ツール名の表示名を取得
     * @param {string} name - ツール名
     * @returns {string} 表示名
     */
    #getToolDisplayName(name) {
        return this.#toolNames[name] || name;
    }

    /**
     * ステータステキストを取得
     * @param {string} status - ステータス
     * @returns {string} テキスト
     */
    #getStatusText(status) {
        const texts = {
            'start': '実行中...',
            'progress': '処理中...',
            'complete': '完了',
            'error': 'エラー'
        };
        return texts[status] || '';
    }

    /**
     * HTMLエスケープ
     * @param {string} str - 文字列
     * @returns {string} エスケープされた文字列
     */
    #escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
