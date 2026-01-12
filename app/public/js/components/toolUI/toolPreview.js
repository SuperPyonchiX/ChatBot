/**
 * toolPreview.js
 * ツール実行結果のプレビューを表示するコンポーネント
 */
class ToolPreview {
    static #instance = null;

    constructor() {
        if (ToolPreview.#instance) {
            return ToolPreview.#instance;
        }
        ToolPreview.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ToolPreview.#instance) {
            ToolPreview.#instance = new ToolPreview();
        }
        return ToolPreview.#instance;
    }

    /**
     * 画像プレビュー要素を作成（外部から呼び出し可能）
     * @param {Object} result - 画像結果
     * @returns {HTMLElement} プレビュー要素
     */
    createImagePreview(result) {
        return this.#createImagePreviewCard(result);
    }

    /**
     * 画像プレビューを表示
     * @param {Object} result - 画像結果
     * @param {Object} toolCall - ツール呼び出し情報（オプション）
     */
    showImagePreview(result, toolCall = null) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const previewCard = this.#createImagePreviewCard(result);
        chatMessages.appendChild(previewCard);

        // スクロールを最下部に
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 画像プレビューカードを作成
     * @param {Object} result - 画像結果
     * @returns {HTMLElement} プレビューカード要素
     */
    #createImagePreviewCard(result) {
        const card = document.createElement('div');
        card.className = 'tool-image-preview';

        const imageUrl = result.dataUrl || (result.blob ? URL.createObjectURL(result.blob) : '');

        card.innerHTML = `
            <div class="image-preview-container">
                <img src="${imageUrl}" alt="${this.#escapeHtml(result.filename || 'Generated Image')}" class="preview-image"/>
                <div class="image-overlay">
                    <button class="preview-btn expand-btn" title="拡大表示">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button class="preview-btn download-btn" title="ダウンロード">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
            <div class="image-info">
                <span class="image-name">${this.#escapeHtml(result.filename || 'image.png')}</span>
                <span class="image-size">${result.width || 0} x ${result.height || 0} px</span>
            </div>
        `;

        // 拡大ボタン
        const expandBtn = card.querySelector('.expand-btn');
        expandBtn.addEventListener('click', () => {
            this.#showFullscreen(result);
        });

        // ダウンロードボタン
        const downloadBtn = card.querySelector('.download-btn');
        downloadBtn.addEventListener('click', () => {
            this.#downloadImage(result);
        });

        // 画像クリックで拡大
        const img = card.querySelector('.preview-image');
        img.addEventListener('click', () => {
            this.#showFullscreen(result);
        });

        return card;
    }

    /**
     * フルスクリーン表示
     * @param {Object} result - 画像結果
     */
    #showFullscreen(result) {
        const imageUrl = result.dataUrl || (result.blob ? URL.createObjectURL(result.blob) : '');

        // オーバーレイを作成
        const overlay = document.createElement('div');
        overlay.className = 'image-fullscreen-overlay';
        overlay.innerHTML = `
            <div class="fullscreen-container">
                <img src="${imageUrl}" alt="Full size image" class="fullscreen-image"/>
                <div class="fullscreen-controls">
                    <button class="fullscreen-btn download-btn" title="ダウンロード">
                        <i class="fas fa-download"></i>
                        <span>ダウンロード</span>
                    </button>
                    <button class="fullscreen-btn close-btn" title="閉じる">
                        <i class="fas fa-times"></i>
                        <span>閉じる</span>
                    </button>
                </div>
            </div>
        `;

        // イベントリスナー
        const closeBtn = overlay.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        const downloadBtnFullscreen = overlay.querySelector('.fullscreen-controls .download-btn');
        downloadBtnFullscreen.addEventListener('click', () => {
            this.#downloadImage(result);
        });

        // オーバーレイクリックで閉じる
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // ESCキーで閉じる
        const handleEsc = (e) => {
            if (e.key === 'Escape' && document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        document.body.appendChild(overlay);
    }

    /**
     * 画像をダウンロード
     * @param {Object} result - 画像結果
     */
    #downloadImage(result) {
        let url;
        let shouldRevoke = false;

        if (result.dataUrl) {
            url = result.dataUrl;
        } else if (result.blob) {
            url = URL.createObjectURL(result.blob);
            shouldRevoke = true;
        } else {
            console.error('ダウンロードする画像がありません');
            return;
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (shouldRevoke) {
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);
        }

        console.log(`画像ダウンロード: ${result.filename || 'image.png'}`);
    }

    /**
     * アーティファクトパネルに画像を表示（既存のartifact機能と統合）
     * @param {Object} result - 画像結果
     */
    showInArtifactPanel(result) {
        // ArtifactManagerが存在する場合は連携
        if (typeof ArtifactManager !== 'undefined') {
            const artifact = {
                type: 'image',
                content: result.dataUrl,
                title: result.filename || 'Generated Image',
                metadata: {
                    width: result.width,
                    height: result.height,
                    createdAt: result.createdAt
                }
            };

            try {
                ArtifactManager.getInstance.addArtifact(artifact);
            } catch (e) {
                console.warn('Artifact追加に失敗:', e);
                // フォールバック: 通常のプレビューを表示
                this.showImagePreview(result);
            }
        } else {
            this.showImagePreview(result);
        }
    }

    /**
     * コードプレビューを表示
     * @param {Object} result - コード結果
     */
    showCodePreview(result) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const card = document.createElement('div');
        card.className = 'tool-code-preview';
        card.innerHTML = `
            <div class="code-preview-header">
                <span class="code-filename">${this.#escapeHtml(result.filename || 'code')}</span>
                <button class="copy-btn" title="コピー">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <pre class="code-content"><code>${this.#escapeHtml(result.content || '')}</code></pre>
        `;

        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(result.content || '');
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            } catch (e) {
                console.error('コピーに失敗:', e);
            }
        });

        chatMessages.appendChild(card);
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
