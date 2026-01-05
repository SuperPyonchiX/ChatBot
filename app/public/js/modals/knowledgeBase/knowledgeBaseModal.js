/**
 * knowledgeBaseModal.js
 * RAGナレッジベース管理モーダルのUIを管理するクラス
 */

class KnowledgeBaseModal {
    static #instance = null;

    /** @type {boolean} */
    #isProcessing = false;

    /** @type {boolean} モデル初期化中フラグ */
    #isModelInitializing = false;

    /**
     * シングルトンインスタンスを取得
     * @returns {KnowledgeBaseModal}
     */
    static get getInstance() {
        if (!KnowledgeBaseModal.#instance) {
            KnowledgeBaseModal.#instance = new KnowledgeBaseModal();
        }
        return KnowledgeBaseModal.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (KnowledgeBaseModal.#instance) {
            throw new Error('KnowledgeBaseModal is a singleton. Use KnowledgeBaseModal.getInstance instead.');
        }
    }

    /**
     * イベントリスナーを初期化
     */
    initializeEventListeners() {
        // モーダル閉じるボタン
        const closeBtn = document.getElementById('closeKnowledgeBaseModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }

        // RAGトグル
        const ragToggle = document.getElementById('ragToggle');
        if (ragToggle) {
            ragToggle.addEventListener('change', (e) => this.#handleRagToggle(e));
        }

        // ファイルアップロード
        const uploadBtn = document.getElementById('kbUploadBtn');
        const fileInput = document.getElementById('kbFileInput');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.#handleFileUpload(e));
        }

        // ドラッグ&ドロップ
        const dropZone = document.getElementById('kbDropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = Array.from(e.dataTransfer.files);
                this.#processFiles(files);
            });
        }

        // 全削除ボタン
        const clearAllBtn = document.getElementById('kbClearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.#handleClearAll());
        }

        // モーダル外クリックで閉じる
        const modal = document.getElementById('knowledgeBaseModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
    }

    /**
     * モーダルを表示
     */
    async showModal() {
        UIUtils.getInstance.toggleModal('knowledgeBaseModal', true);
        await this.#refreshUI();
    }

    /**
     * モーダルを非表示
     */
    hideModal() {
        UIUtils.getInstance.toggleModal('knowledgeBaseModal', false);
    }

    /**
     * UIを更新
     */
    async #refreshUI() {
        await this.#updateToggleState();
        await this.#updateStats();
        await this.#renderDocumentList();
        await this.#checkEmbeddingAvailability();
    }

    /**
     * RAGトグル状態を更新
     */
    async #updateToggleState() {
        const toggle = document.getElementById('ragToggle');
        if (toggle) {
            toggle.checked = RAGManager.getInstance.isEnabled;
        }
    }

    /**
     * 統計情報を更新
     */
    async #updateStats() {
        const statsContainer = document.getElementById('kbStats');
        if (!statsContainer) return;

        try {
            const stats = await RAGManager.getInstance.getStats();

            statsContainer.innerHTML = `
                <div class="kb-stat-item">
                    <span class="kb-stat-value">${stats.documentCount}</span>
                    <span class="kb-stat-label">ドキュメント</span>
                </div>
                <div class="kb-stat-item">
                    <span class="kb-stat-value">${stats.chunkCount}</span>
                    <span class="kb-stat-label">チャンク</span>
                </div>
                <div class="kb-stat-item">
                    <span class="kb-stat-value">${RAGManager.getInstance.formatFileSize(stats.totalSize)}</span>
                    <span class="kb-stat-label">合計サイズ</span>
                </div>
            `;
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    /**
     * ドキュメント一覧を描画
     */
    async #renderDocumentList() {
        const listContainer = document.getElementById('kbDocumentList');
        if (!listContainer) return;

        try {
            const documents = await RAGManager.getInstance.getDocuments();

            if (documents.length === 0) {
                listContainer.innerHTML = `
                    <div class="kb-empty-state">
                        <i class="fas fa-folder-open"></i>
                        <p>ナレッジベースは空です</p>
                        <p class="kb-empty-hint">ドキュメントをアップロードして開始してください</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = documents.map(doc => `
                <div class="kb-document-item" data-doc-id="${doc.id}">
                    <div class="kb-doc-icon">
                        <i class="${this.#getFileIcon(doc.type)}"></i>
                    </div>
                    <div class="kb-doc-info">
                        <div class="kb-doc-name" title="${doc.name}">${doc.name}</div>
                        <div class="kb-doc-meta">
                            ${doc.chunkCount} チャンク • ${RAGManager.getInstance.formatFileSize(doc.size)} • ${this.#formatDate(doc.createdAt)}
                        </div>
                    </div>
                    <button class="kb-doc-delete" title="削除" data-doc-id="${doc.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('');

            // 削除ボタンのイベントリスナー
            listContainer.querySelectorAll('.kb-doc-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const docId = btn.dataset.docId;
                    this.#handleDeleteDocument(docId);
                });
            });
        } catch (error) {
            console.error('Failed to render document list:', error);
            listContainer.innerHTML = `
                <div class="kb-error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>ドキュメント一覧の取得に失敗しました</p>
                </div>
            `;
        }
    }

    /**
     * 埋め込みAPI利用可能性をチェックし、現在のモードを表示
     */
    async #checkEmbeddingAvailability() {
        const warningContainer = document.getElementById('kbApiWarning');
        if (!warningContainer) return;

        if (typeof EmbeddingAPI !== 'undefined') {
            if (EmbeddingAPI.getInstance.isInitializing) {
                warningContainer.style.display = 'block';
                warningContainer.className = 'kb-api-info';
                warningContainer.innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>モデルを準備中...</span>
                `;
            } else {
                // 現在の埋め込みモードを表示
                const mode = EmbeddingAPI.getInstance.getMode();
                const modeName = EmbeddingAPI.getInstance.getModeDisplayName();
                const dimensions = EmbeddingAPI.getInstance.getDimensions();
                const modeIcon = mode === 'local' ? 'fa-microchip' : 'fa-cloud';
                const modeClass = mode === 'local' ? 'kb-mode-local' : 'kb-mode-api';

                warningContainer.style.display = 'block';
                warningContainer.className = `kb-api-info ${modeClass}`;
                warningContainer.innerHTML = `
                    <i class="fas ${modeIcon}"></i>
                    <span>埋め込み: ${modeName} (${dimensions}次元)</span>
                `;
            }
        } else {
            warningContainer.style.display = 'block';
            warningContainer.className = 'kb-api-warning';
            warningContainer.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>埋め込みAPIが利用できません</span>
            `;
        }
    }

    /**
     * RAGトグル変更ハンドラ
     */
    #handleRagToggle(event) {
        RAGManager.getInstance.isEnabled = event.target.checked;
    }

    /**
     * ファイルアップロードハンドラ
     */
    async #handleFileUpload(event) {
        const files = Array.from(event.target.files);
        event.target.value = ''; // リセット
        await this.#processFiles(files);
    }

    /**
     * ファイルを処理
     */
    async #processFiles(files) {
        if (this.#isProcessing || files.length === 0) return;

        this.#isProcessing = true;
        const progressContainer = document.getElementById('kbProgress');
        const progressBar = document.getElementById('kbProgressBar');
        const progressText = document.getElementById('kbProgressText');

        // モデル未初期化なら先に初期化
        if (typeof EmbeddingAPI !== 'undefined' && !EmbeddingAPI.getInstance.isInitialized) {
            try {
                if (progressContainer) {
                    progressContainer.style.display = 'block';
                }
                if (progressText) {
                    progressText.textContent = 'モデルをダウンロード中...';
                }

                await EmbeddingAPI.getInstance.initialize((progress) => {
                    if (progressBar && progress.status === 'progress' && progress.progress) {
                        progressBar.style.width = `${progress.progress}%`;
                    }
                    if (progressText && progress.status === 'progress') {
                        const fileName = progress.file?.split('/').pop() || 'モデル';
                        const percent = progress.progress ? Math.round(progress.progress) : 0;
                        progressText.textContent = `${fileName} をダウンロード中... ${percent}%`;
                    }
                });

                if (progressBar) {
                    progressBar.style.width = '0%';
                }
                if (progressText) {
                    progressText.textContent = 'モデル準備完了';
                }

            } catch (error) {
                console.error('Model initialization failed:', error);
                alert('モデルの初期化に失敗しました: ' + error.message);
                this.#isProcessing = false;
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                return;
            }
        }

        if (progressContainer) {
            progressContainer.style.display = 'block';
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                // 進捗表示
                if (progressText) {
                    progressText.textContent = `${file.name} を処理中... (${i + 1}/${files.length})`;
                }

                await RAGManager.getInstance.addDocument(file, (stage, current, total) => {
                    if (progressBar) {
                        let progress = 0;
                        switch (stage) {
                            case 'chunking':
                                progress = 10;
                                break;
                            case 'embedding':
                                progress = 10 + (current / total) * 80;
                                break;
                            case 'saving':
                                progress = 90;
                                break;
                            case 'complete':
                                progress = 100;
                                break;
                        }
                        progressBar.style.width = `${progress}%`;
                    }

                    if (progressText) {
                        switch (stage) {
                            case 'chunking':
                                progressText.textContent = `${file.name}: テキスト抽出中...`;
                                break;
                            case 'embedding':
                                progressText.textContent = `${file.name}: 埋め込み生成中... (${current}/${total})`;
                                break;
                            case 'saving':
                                progressText.textContent = `${file.name}: 保存中...`;
                                break;
                            case 'complete':
                                progressText.textContent = `${file.name}: 完了`;
                                break;
                        }
                    }
                });

            } catch (error) {
                console.error(`Failed to process file: ${file.name}`, error);
                alert(`${file.name} の処理に失敗しました: ${error.message}`);
            }
        }

        // 完了後にUI更新
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }

        await this.#refreshUI();
        this.#isProcessing = false;
    }

    /**
     * ドキュメント削除ハンドラ
     */
    async #handleDeleteDocument(docId) {
        if (!confirm('このドキュメントを削除しますか？')) {
            return;
        }

        try {
            await RAGManager.getInstance.removeDocument(docId);
            await this.#refreshUI();
        } catch (error) {
            console.error('Failed to delete document:', error);
            alert('ドキュメントの削除に失敗しました');
        }
    }

    /**
     * 全削除ハンドラ
     */
    async #handleClearAll() {
        if (!confirm('すべてのドキュメントを削除しますか？この操作は取り消せません。')) {
            return;
        }

        try {
            await RAGManager.getInstance.clearAll();
            await this.#refreshUI();
        } catch (error) {
            console.error('Failed to clear all:', error);
            alert('ナレッジベースのクリアに失敗しました');
        }
    }

    /**
     * ファイルタイプに応じたアイコンクラスを取得
     */
    #getFileIcon(mimeType) {
        if (!mimeType) return 'fas fa-file';

        if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'fas fa-file-excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
        if (mimeType.includes('text')) return 'fas fa-file-alt';
        if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('code')) return 'fas fa-file-code';

        return 'fas fa-file';
    }

    /**
     * 日付をフォーマット
     */
    #formatDate(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // 24時間以内
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            if (hours === 0) {
                const minutes = Math.floor(diff / (60 * 1000));
                return `${minutes}分前`;
            }
            return `${hours}時間前`;
        }

        // 7日以内
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `${days}日前`;
        }

        // それ以外
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// グローバルに公開
window.KnowledgeBaseModal = KnowledgeBaseModal;
