/**
 * fileDownloader.js
 * 生成ファイルのダウンロードUIを提供するコンポーネント
 */
class FileDownloader {
    static #instance = null;

    // ファイルタイプとアイコンのマッピング
    #fileIcons = {
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fa-file-powerpoint',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fa-file-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa-file-word',
        'application/pdf': 'fa-file-pdf',
        'image/png': 'fa-image',
        'image/jpeg': 'fa-image',
        'image/gif': 'fa-image',
        'text/plain': 'fa-file-alt',
        'text/csv': 'fa-file-csv',
        'application/json': 'fa-file-code'
    };

    // ファイルタイプとカラーのマッピング
    #fileColors = {
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '#D24726',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '#217346',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '#2B579A',
        'application/pdf': '#FF0000',
        'image/png': '#4A90D9',
        'image/jpeg': '#4A90D9'
    };

    constructor() {
        if (FileDownloader.#instance) {
            return FileDownloader.#instance;
        }
        FileDownloader.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!FileDownloader.#instance) {
            FileDownloader.#instance = new FileDownloader();
        }
        return FileDownloader.#instance;
    }

    /**
     * ダウンロードカードを作成（外部から呼び出し可能）
     * @param {Object} result - ファイル結果
     * @returns {HTMLElement} ダウンロードカード要素
     */
    createDownloadCard(result) {
        return this.#createDownloadCard(result);
    }

    /**
     * ダウンロードボタンを表示
     * @param {Object} result - ファイル結果
     * @param {Object} toolCall - ツール呼び出し情報（オプション）
     */
    showDownloadButton(result, toolCall = null) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const downloadCard = this.#createDownloadCard(result);
        chatMessages.appendChild(downloadCard);

        // スクロールを最下部に
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * ダウンロードカードを作成
     * @param {Object} result - ファイル結果
     * @returns {HTMLElement} ダウンロードカード要素
     */
    #createDownloadCard(result) {
        const card = document.createElement('div');
        card.className = 'tool-download-card';

        const iconClass = this.#getFileIcon(result.mimeType);
        const iconColor = this.#getFileColor(result.mimeType);
        const fileSize = this.#formatFileSize(result.size);

        card.innerHTML = `
            <div class="download-card-content">
                <div class="file-icon" style="color: ${iconColor}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${this.#escapeHtml(result.filename)}</div>
                    <div class="file-meta">
                        <span class="file-size">${fileSize}</span>
                        ${result.createdAt ? `<span class="file-date">${this.#formatDate(result.createdAt)}</span>` : ''}
                    </div>
                </div>
                <button class="download-btn" title="ダウンロード">
                    <i class="fas fa-download"></i>
                    <span>ダウンロード</span>
                </button>
            </div>
        `;

        // ダウンロードボタンのイベント
        const downloadBtn = card.querySelector('.download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.#downloadFile(result);
        });

        return card;
    }

    /**
     * ファイルをダウンロード
     * @param {Object} result - ファイル結果
     */
    #downloadFile(result) {
        if (!result.blob) {
            console.error('ダウンロードするBlobがありません');
            return;
        }

        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // メモリリーク防止
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);

        console.log(`ファイルダウンロード: ${result.filename}`);
    }

    /**
     * ファイルアイコンを取得
     * @param {string} mimeType - MIMEタイプ
     * @returns {string} アイコンクラス
     */
    #getFileIcon(mimeType) {
        return this.#fileIcons[mimeType] || 'fa-file';
    }

    /**
     * ファイルカラーを取得
     * @param {string} mimeType - MIMEタイプ
     * @returns {string} 色
     */
    #getFileColor(mimeType) {
        return this.#fileColors[mimeType] || '#666666';
    }

    /**
     * ファイルサイズをフォーマット
     * @param {number} bytes - バイト数
     * @returns {string} フォーマットされたサイズ
     */
    #formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB'];
        let unitIndex = 0;
        let size = bytes;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
    }

    /**
     * 日付をフォーマット
     * @param {string} dateStr - ISO形式の日付文字列
     * @returns {string} フォーマットされた日付
     */
    #formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
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

    /**
     * 複数ファイルのダウンロードリストを表示
     * @param {Array} results - ファイル結果の配列
     */
    showDownloadList(results) {
        if (!results || results.length === 0) return;

        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const container = document.createElement('div');
        container.className = 'tool-download-list';

        for (const result of results) {
            const card = this.#createDownloadCard(result);
            container.appendChild(card);
        }

        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
