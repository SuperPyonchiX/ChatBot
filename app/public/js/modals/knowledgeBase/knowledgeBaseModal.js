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

    /** @type {'file' | 'confluence'} 現在のデータソースタイプ */
    #currentDataSource = 'file';

    /** @type {Set<string>} サポートされるファイル拡張子 */
    static #SUPPORTED_EXTENSIONS = new Set([
        '.pdf', '.txt', '.md',
        '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
        '.csv', '.json', '.js', '.html', '.css',
        '.py', '.java', '.cpp', '.c'
    ]);

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

        // フォルダアップロード
        const uploadFolderBtn = document.getElementById('kbUploadFolderBtn');
        const folderInput = document.getElementById('kbFolderInput');

        if (uploadFolderBtn && folderInput) {
            uploadFolderBtn.addEventListener('click', () => folderInput.click());
            folderInput.addEventListener('change', (e) => this.#handleFolderUpload(e));
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

        // ========================================
        // Confluence関連イベントリスナー
        // ========================================

        // データソースタブ
        const fileTab = document.getElementById('kbFileTab');
        const confluenceTab = document.getElementById('kbConfluenceTab');

        if (fileTab) {
            fileTab.addEventListener('click', () => this.#switchDataSource('file'));
        }
        if (confluenceTab) {
            confluenceTab.addEventListener('click', () => this.#switchDataSource('confluence'));
        }

        // 認証方式切り替え
        const authBasic = document.getElementById('authBasic');
        const authPat = document.getElementById('authPat');

        if (authBasic) {
            authBasic.addEventListener('change', () => this.#toggleAuthFields());
        }
        if (authPat) {
            authPat.addEventListener('change', () => this.#toggleAuthFields());
        }

        // Confluence接続テスト
        const testBtn = document.getElementById('testConfluenceConnection');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.#testConfluenceConnection());
        }

        // Confluence設定保存
        const saveBtn = document.getElementById('saveConfluenceSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.#saveConfluenceSettings());
        }

        // スペースインポート
        const importBtn = document.getElementById('importConfluenceSpace');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.#importConfluenceSpace());
        }

        // 設定変更ボタン
        const editBtn = document.getElementById('editConfluenceSettings');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.#showConfluenceSettingsForm());
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
     * ドキュメント一覧を描画（グループ化表示）
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

            // ファイルとConfluenceを分離
            const fileDocuments = documents.filter(d => d.source !== 'confluence');
            const confluenceDocuments = documents.filter(d => d.source === 'confluence');

            // Confluenceドキュメントをスペースごとにグループ化
            const spaceGroups = this.#groupBySpace(confluenceDocuments);

            let html = '';

            // ファイルセクション
            if (fileDocuments.length > 0) {
                html += this.#renderFileSection(fileDocuments);
            }

            // Confluenceスペースセクション
            for (const [spaceKey, group] of spaceGroups) {
                html += this.#renderSpaceSection(spaceKey, group);
            }

            listContainer.innerHTML = html;

            // イベントリスナーを設定
            this.#attachGroupEventListeners(listContainer);

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
     * Confluenceドキュメントをスペースごとにグループ化
     * @param {Array} documents - Confluenceドキュメント配列
     * @returns {Map} スペースキー -> グループ情報
     */
    #groupBySpace(documents) {
        const groups = new Map();

        for (const doc of documents) {
            const key = doc.spaceKey || this.#extractSpaceKey(doc.sourceUrl) || 'unknown';

            if (!groups.has(key)) {
                groups.set(key, {
                    spaceKey: key,
                    spaceName: doc.spaceName || key,
                    documents: []
                });
            }
            groups.get(key).documents.push(doc);
        }

        return groups;
    }

    /**
     * sourceUrlからスペースキーを抽出
     * @param {string} sourceUrl - ソースURL
     * @returns {string|null}
     */
    #extractSpaceKey(sourceUrl) {
        if (!sourceUrl) return null;
        const urlSpaceMatch = sourceUrl.match(/\/spaces\/([^\/]+)\//);
        const querySpaceMatch = sourceUrl.match(/[?&]spaceKey=([^&]+)/);
        return urlSpaceMatch ? urlSpaceMatch[1] : (querySpaceMatch ? querySpaceMatch[1] : null);
    }

    /**
     * ファイルセクションのHTMLを生成
     * @param {Array} documents - ファイルドキュメント配列
     * @returns {string}
     */
    #renderFileSection(documents) {
        const docsHtml = documents.map(doc => this.#renderDocumentItem(doc)).join('');

        return `
            <div class="kb-group" data-group-type="file">
                <div class="kb-group-header">
                    <i class="fas fa-chevron-down kb-group-toggle"></i>
                    <i class="fas fa-folder kb-group-icon file"></i>
                    <span class="kb-group-title">ファイル</span>
                    <span class="kb-group-count">${documents.length}</span>
                </div>
                <div class="kb-group-content">
                    ${docsHtml}
                </div>
            </div>
        `;
    }

    /**
     * ConfluenceスペースセクションのHTMLを生成
     * @param {string} spaceKey - スペースキー
     * @param {Object} group - グループ情報
     * @returns {string}
     */
    #renderSpaceSection(spaceKey, group) {
        const docsHtml = group.documents.map(doc => this.#renderDocumentItem(doc, true)).join('');
        const displayName = group.spaceName !== spaceKey
            ? `${group.spaceName} (${spaceKey})`
            : spaceKey;

        return `
            <div class="kb-group" data-group-type="confluence" data-space-key="${spaceKey}">
                <div class="kb-group-header">
                    <i class="fas fa-chevron-down kb-group-toggle"></i>
                    <i class="fas fa-atlas kb-group-icon confluence"></i>
                    <span class="kb-group-title">${displayName}</span>
                    <span class="kb-group-count">${group.documents.length}</span>
                    <button class="kb-group-delete" title="このスペースの全ページを削除" data-space-key="${spaceKey}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="kb-group-content">
                    ${docsHtml}
                </div>
            </div>
        `;
    }

    /**
     * 個別ドキュメントアイテムのHTMLを生成
     * @param {Object} doc - ドキュメント
     * @param {boolean} [isConfluence=false] - Confluenceドキュメントかどうか
     * @returns {string}
     */
    #renderDocumentItem(doc, isConfluence = false) {
        const linkHtml = isConfluence && doc.sourceUrl
            ? `<a href="${doc.sourceUrl}" target="_blank" rel="noopener noreferrer" class="kb-doc-link" title="Confluenceで開く"><i class="fas fa-external-link-alt"></i></a>`
            : '';

        return `
            <div class="kb-document-item" data-doc-id="${doc.id}">
                <div class="kb-doc-icon">
                    <i class="${this.#getFileIcon(doc.type, doc.source)}"></i>
                </div>
                <div class="kb-doc-info">
                    <div class="kb-doc-name" title="${doc.name}">
                        ${doc.name}
                        ${linkHtml}
                    </div>
                    <div class="kb-doc-meta">
                        ${doc.chunkCount} チャンク • ${RAGManager.getInstance.formatFileSize(doc.size)} • ${this.#formatDate(doc.createdAt)}
                    </div>
                </div>
                <button class="kb-doc-delete" title="削除" data-doc-id="${doc.id}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }

    /**
     * グループ関連のイベントリスナーを設定
     * @param {HTMLElement} container - コンテナ要素
     */
    #attachGroupEventListeners(container) {
        // グループヘッダーのクリック（折りたたみ/展開）
        container.querySelectorAll('.kb-group-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // 削除ボタンのクリックは除外
                if (e.target.closest('.kb-group-delete')) return;

                header.classList.toggle('collapsed');
                const content = header.nextElementSibling;
                if (content) {
                    content.classList.toggle('collapsed');
                }
            });
        });

        // スペース削除ボタン
        container.querySelectorAll('.kb-group-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const spaceKey = btn.dataset.spaceKey;
                await this.#handleDeleteSpace(spaceKey);
            });
        });

        // 個別ドキュメント削除ボタン
        container.querySelectorAll('.kb-doc-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const docId = btn.dataset.docId;
                this.#handleDeleteDocument(docId);
            });
        });
    }

    /**
     * スペース内の全ドキュメントを削除
     * @param {string} spaceKey - スペースキー
     */
    async #handleDeleteSpace(spaceKey) {
        const documents = await RAGManager.getInstance.getDocuments();
        const spaceDocs = documents.filter(doc => {
            if (doc.spaceKey) return doc.spaceKey === spaceKey;
            return this.#extractSpaceKey(doc.sourceUrl) === spaceKey;
        });

        if (spaceDocs.length === 0) {
            alert('削除するドキュメントがありません');
            return;
        }

        if (!confirm(`このスペースの ${spaceDocs.length} ページをすべて削除しますか？`)) {
            return;
        }

        try {
            for (const doc of spaceDocs) {
                await RAGManager.getInstance.removeDocument(doc.id);
            }
            await this.#refreshUI();
        } catch (error) {
            console.error('Failed to delete space documents:', error);
            alert('スペースドキュメントの削除に失敗しました');
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
     * フォルダアップロードハンドラ
     * @param {Event} event
     */
    async #handleFolderUpload(event) {
        const allFiles = Array.from(event.target.files);
        event.target.value = ''; // リセット

        const supportedFiles = this.#filterSupportedFiles(allFiles);

        if (supportedFiles.length === 0) {
            alert('サポートされているファイル形式が見つかりませんでした。');
            return;
        }

        // 大量ファイル時の確認
        if (supportedFiles.length > 20) {
            const proceed = confirm(
                `${supportedFiles.length}件のファイルを処理します。続行しますか？`
            );
            if (!proceed) return;
        }

        await this.#processFiles(supportedFiles);
    }

    /**
     * サポートされている形式のファイルのみフィルタリング
     * @param {File[]} files
     * @returns {File[]}
     */
    #filterSupportedFiles(files) {
        return files.filter(file => {
            // 隠しファイル・フォルダを除外
            const pathParts = file.webkitRelativePath.split('/');
            if (pathParts.some(part => part.startsWith('.'))) {
                return false;
            }
            const ext = this.#getFileExtension(file.name);
            return KnowledgeBaseModal.#SUPPORTED_EXTENSIONS.has(ext);
        });
    }

    /**
     * ファイル名から拡張子を取得
     * @param {string} fileName
     * @returns {string}
     */
    #getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1) return '';
        return fileName.substring(lastDot).toLowerCase();
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
                // ファイル名の表示用短縮
                const displayName = file.name.length > 25
                    ? file.name.substring(0, 22) + '...'
                    : file.name;

                // 初期進捗表示
                if (progressText) {
                    progressText.innerHTML = `${displayName} を処理中<br><small>全体: ${i + 1} / ${files.length} ファイル</small>`;
                }

                await RAGManager.getInstance.addDocument(file, (stage, current, total) => {
                    // 各ファイル内の進捗（0-1）
                    let fileProgress = 0;
                    switch (stage) {
                        case 'chunking':
                            fileProgress = 0.1;
                            break;
                        case 'embedding':
                            fileProgress = 0.1 + (current / total) * 0.8;
                            break;
                        case 'saving':
                            fileProgress = 0.9;
                            break;
                        case 'complete':
                            fileProgress = 1;
                            break;
                    }

                    // 全体進捗 = (完了ファイル数 + 現在ファイル進捗) / 全ファイル数
                    if (progressBar) {
                        const overallProgress = ((i + fileProgress) / files.length) * 100;
                        progressBar.style.width = `${overallProgress}%`;
                    }

                    // ステージ名をテキストに反映
                    if (progressText) {
                        const stageNames = {
                            'chunking': 'テキスト抽出中',
                            'embedding': '埋め込み生成中',
                            'saving': '保存中',
                            'complete': '完了'
                        };
                        const stageName = stageNames[stage] || '処理中';
                        progressText.innerHTML = `${displayName}（${stageName}）<br><small>全体: ${i + 1} / ${files.length} ファイル</small>`;
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
     * @param {string} mimeType - MIMEタイプ
     * @param {string} [source] - データソース ('file' | 'confluence')
     */
    #getFileIcon(mimeType, source) {
        // Confluenceソースの場合は専用アイコン
        if (source === 'confluence') {
            return 'fas fa-atlas';
        }

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

    // ========================================
    // Confluence関連メソッド
    // ========================================

    /**
     * データソースを切り替え
     * @param {'file' | 'confluence'} source
     */
    #switchDataSource(source) {
        if (this.#isProcessing) return;

        this.#currentDataSource = source;

        // タブのアクティブ状態を切り替え
        const fileTab = document.getElementById('kbFileTab');
        const confluenceTab = document.getElementById('kbConfluenceTab');

        if (fileTab) fileTab.classList.toggle('active', source === 'file');
        if (confluenceTab) confluenceTab.classList.toggle('active', source === 'confluence');

        // コンテンツエリアの表示切り替え
        const fileSection = document.getElementById('kbFileSection');
        const confluenceSection = document.getElementById('kbConfluenceSection');

        if (fileSection) fileSection.classList.toggle('hidden', source !== 'file');
        if (confluenceSection) confluenceSection.classList.toggle('hidden', source !== 'confluence');

        // Confluenceタブ選択時は設定状態をチェック
        if (source === 'confluence') {
            this.#refreshConfluenceUI();
        }
    }

    /**
     * Confluence UI状態を更新
     */
    async #refreshConfluenceUI() {
        // ConfluenceDataSourceが利用可能か確認
        if (typeof ConfluenceDataSource === 'undefined') {
            console.warn('ConfluenceDataSource is not available');
            return;
        }

        const confluence = ConfluenceDataSource.getInstance;
        const isConfigured = confluence.isConfigured();

        const settingsForm = document.getElementById('confluenceSettingsForm');
        const spaceSection = document.getElementById('confluenceSpaceSection');

        // 設定済みの場合はスペース選択を表示
        if (settingsForm) settingsForm.classList.toggle('hidden', isConfigured);
        if (spaceSection) spaceSection.classList.toggle('hidden', !isConfigured);

        if (isConfigured) {
            // 接続状態表示を更新
            const statusText = document.getElementById('confluenceStatusText');
            if (statusText) {
                const baseUrl = confluence.getBaseUrl();
                statusText.textContent = `接続済み: ${baseUrl}`;
            }

            // スペース一覧を読み込み
            await this.#loadSpaces();
        }
    }

    /**
     * 認証フィールドの表示を切り替え
     */
    #toggleAuthFields() {
        const authType = document.querySelector('input[name="confluenceAuthType"]:checked')?.value;
        const basicFields = document.getElementById('basicAuthFields');
        const patFields = document.getElementById('patAuthFields');

        if (basicFields) basicFields.classList.toggle('hidden', authType !== 'basic');
        if (patFields) patFields.classList.toggle('hidden', authType !== 'pat');
    }

    /**
     * スペース一覧を読み込み
     */
    async #loadSpaces() {
        const spaceSelect = document.getElementById('confluenceSpaceSelect');
        if (!spaceSelect) return;

        try {
            spaceSelect.innerHTML = '<option value="">読み込み中...</option>';
            spaceSelect.disabled = true;

            const spaces = await ConfluenceDataSource.getInstance.getSpaces();

            if (spaces.length === 0) {
                spaceSelect.innerHTML = '<option value="">スペースがありません</option>';
            } else {
                spaceSelect.innerHTML = '<option value="">スペースを選択</option>' +
                    spaces.map(s => `<option value="${s.key}">${s.name} (${s.key})</option>`).join('');
            }
            spaceSelect.disabled = false;

        } catch (error) {
            console.error('Failed to load spaces:', error);
            spaceSelect.innerHTML = '<option value="">取得に失敗しました</option>';
            spaceSelect.disabled = false;
        }
    }

    /**
     * Confluence接続テスト
     */
    async #testConfluenceConnection() {
        const btn = document.getElementById('testConfluenceConnection');
        if (!btn) return;

        // 入力値を一時的に保存してテスト
        const baseUrl = document.getElementById('confluenceBaseUrl')?.value?.trim();
        const authType = document.querySelector('input[name="confluenceAuthType"]:checked')?.value;
        const username = document.getElementById('confluenceUsername')?.value;
        const password = document.getElementById('confluencePassword')?.value;
        const token = document.getElementById('confluenceToken')?.value;

        if (!baseUrl) {
            alert('Confluence URLを入力してください');
            return;
        }

        if (authType === 'basic' && (!username || !password)) {
            alert('ユーザー名とパスワードを入力してください');
            return;
        }

        if (authType === 'pat' && !token) {
            alert('Personal Access Tokenを入力してください');
            return;
        }

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> テスト中...';

        try {
            // 一時的に設定を保存してテスト
            ConfluenceDataSource.getInstance.saveSettings({
                baseUrl,
                authType,
                username,
                password,
                token
            });

            const result = await ConfluenceDataSource.getInstance.testConnection();

            if (result.success) {
                alert(result.message);
            } else {
                alert('接続失敗: ' + result.message);
                // 失敗時は設定をクリア
                ConfluenceDataSource.getInstance.clearSettings();
            }
        } catch (error) {
            alert('接続エラー: ' + error.message);
            ConfluenceDataSource.getInstance.clearSettings();
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    /**
     * Confluence設定を保存
     */
    async #saveConfluenceSettings() {
        const baseUrl = document.getElementById('confluenceBaseUrl')?.value?.trim();
        const authType = document.querySelector('input[name="confluenceAuthType"]:checked')?.value;
        const username = document.getElementById('confluenceUsername')?.value;
        const password = document.getElementById('confluencePassword')?.value;
        const token = document.getElementById('confluenceToken')?.value;

        if (!baseUrl) {
            alert('Confluence URLを入力してください');
            return;
        }

        if (authType === 'basic' && (!username || !password)) {
            alert('ユーザー名とパスワードを入力してください');
            return;
        }

        if (authType === 'pat' && !token) {
            alert('Personal Access Tokenを入力してください');
            return;
        }

        try {
            ConfluenceDataSource.getInstance.saveSettings({
                baseUrl,
                authType,
                username,
                password,
                token
            });

            // 接続テスト
            const result = await ConfluenceDataSource.getInstance.testConnection();

            if (result.success) {
                alert('設定を保存しました。' + result.message);
                await this.#refreshConfluenceUI();
            } else {
                alert('接続に失敗しました: ' + result.message);
                ConfluenceDataSource.getInstance.clearSettings();
            }
        } catch (error) {
            alert('設定の保存に失敗しました: ' + error.message);
        }
    }

    /**
     * Confluence設定フォームを表示
     */
    #showConfluenceSettingsForm() {
        const settingsForm = document.getElementById('confluenceSettingsForm');
        const spaceSection = document.getElementById('confluenceSpaceSection');

        if (settingsForm) settingsForm.classList.remove('hidden');
        if (spaceSection) spaceSection.classList.add('hidden');

        // 現在の設定値をフォームに反映
        const confluence = ConfluenceDataSource.getInstance;
        const baseUrlInput = document.getElementById('confluenceBaseUrl');
        if (baseUrlInput) {
            baseUrlInput.value = confluence.getBaseUrl();
        }

        // 認証タイプを反映
        const authType = confluence.getAuthType();
        if (authType === 'basic') {
            document.getElementById('authBasic')?.click();
        } else {
            document.getElementById('authPat')?.click();
        }
    }

    /**
     * Confluenceスペースをインポート（差分更新対応）
     */
    async #importConfluenceSpace() {
        const spaceSelect = document.getElementById('confluenceSpaceSelect');
        const spaceKey = spaceSelect?.value;

        if (!spaceKey) {
            alert('スペースを選択してください');
            return;
        }

        if (this.#isProcessing) {
            return;
        }

        // ドロップダウンのテキストからスペース名を抽出（"SpaceName (KEY)" 形式から名前部分を取得）
        const optionText = spaceSelect.options[spaceSelect.selectedIndex].text;
        const spaceNameMatch = optionText.match(/^(.+?)\s*\([^)]+\)$/);
        const spaceName = spaceNameMatch ? spaceNameMatch[1].trim() : optionText;

        if (!confirm(`スペース「${spaceName}」をインポートします。\n\n新規・更新されたページのみ処理されます。続行しますか？`)) {
            return;
        }

        this.#isProcessing = true;
        const progressContainer = document.getElementById('kbProgress');
        const progressBar = document.getElementById('kbProgressBar');
        const progressText = document.getElementById('kbProgressText');

        if (progressContainer) progressContainer.style.display = 'block';

        try {
            const result = await RAGManager.getInstance.addConfluenceSpace(spaceKey, spaceName,
                (progress) => {
                    // 進捗表示を更新
                    this.#updateConfluenceProgress(progress, progressBar, progressText);
                }
            );

            // 結果メッセージ
            let resultMessage = `インポート完了\n\n`;
            resultMessage += `📊 処理結果:\n`;
            resultMessage += `  - 新規: ${result.newCount} ページ\n`;
            resultMessage += `  - 更新: ${result.updateCount} ページ\n`;
            resultMessage += `  - スキップ: ${result.skipCount} ページ\n`;
            resultMessage += `  - 合計チャンク: ${result.chunkCount}`;

            if (result.failedPages && result.failedPages.length > 0) {
                resultMessage += `\n\n⚠️ ${result.failedPages.length} ページが失敗しました`;
            }

            alert(resultMessage);
            await this.#refreshUI();

        } catch (error) {
            console.error('Confluence import error:', error);
            alert('インポートに失敗しました: ' + error.message);
        } finally {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            this.#isProcessing = false;
        }
    }

    /**
     * Confluence進捗表示を更新
     * @param {Object} progress - 進捗情報
     * @param {HTMLElement} progressBar - プログレスバー要素
     * @param {HTMLElement} progressText - プログレステキスト要素
     */
    #updateConfluenceProgress(progress, progressBar, progressText) {
        if (!progressText) return;

        const { stage, current, total, newCount, updateCount, skipCount, emptyCount, pageTitle, action, message } = progress;

        switch (stage) {
            case 'fetching':
                progressText.innerHTML = `
                    <div class="confluence-loading">
                        <div class="spinner"></div>
                        <span>${message || 'ページを取得中...'}</span>
                    </div>
                `;
                if (progressBar) progressBar.style.width = '0%';
                break;

            case 'analyzing':
                progressText.innerHTML = `
                    <div class="confluence-loading">
                        <div class="spinner"></div>
                        <span>${message || '既存ドキュメントを分析中...'}</span>
                    </div>
                `;
                break;

            case 'analyzed':
                progressText.innerHTML = `
                    <div style="margin-bottom: 0.5rem;">${message || '分析完了'}</div>
                    <div class="confluence-progress-stats">
                        <span class="confluence-progress-stat new">
                            <i class="fas fa-plus-circle"></i> 新規: ${newCount || 0}
                        </span>
                        <span class="confluence-progress-stat update">
                            <i class="fas fa-sync-alt"></i> 更新: ${updateCount || 0}
                        </span>
                        <span class="confluence-progress-stat skip">
                            <i class="fas fa-forward"></i> 未変更: ${skipCount || 0}
                        </span>
                        <span class="confluence-progress-stat empty">
                            <i class="fas fa-file"></i> 空: ${emptyCount || 0}
                        </span>
                    </div>
                `;
                break;

            case 'embedding':
                if (progressBar && total > 0) {
                    const percent = (current / total) * 100;
                    progressBar.style.width = `${percent}%`;
                }

                const actionClass = action === 'new' ? 'new' : 'update';
                const actionLabel = action === 'new' ? '新規' : '更新';

                progressText.innerHTML = `
                    <div class="confluence-progress-stats">
                        <span class="confluence-progress-stat new">
                            <i class="fas fa-plus-circle"></i> 新規: ${newCount || 0}
                        </span>
                        <span class="confluence-progress-stat update">
                            <i class="fas fa-sync-alt"></i> 更新: ${updateCount || 0}
                        </span>
                        <span class="confluence-progress-stat skip">
                            <i class="fas fa-forward"></i> 未変更: ${skipCount || 0}
                        </span>
                        <span class="confluence-progress-stat empty">
                            <i class="fas fa-file"></i> 空: ${emptyCount || 0}
                        </span>
                    </div>
                    <div class="confluence-progress-current">
                        <span class="action-badge ${actionClass}">${actionLabel}</span>
                        <span class="page-title" title="${pageTitle || ''}">${pageTitle || ''}</span>
                        <span class="page-count">${current || 0} / ${total || 0}</span>
                    </div>
                `;
                break;

            case 'complete':
                if (progressBar) progressBar.style.width = '100%';
                progressText.innerHTML = `
                    <div class="confluence-progress-stats">
                        <span class="confluence-progress-stat new">
                            <i class="fas fa-plus-circle"></i> 新規: ${newCount || 0}
                        </span>
                        <span class="confluence-progress-stat update">
                            <i class="fas fa-sync-alt"></i> 更新: ${updateCount || 0}
                        </span>
                        <span class="confluence-progress-stat skip">
                            <i class="fas fa-forward"></i> 未変更: ${skipCount || 0}
                        </span>
                        <span class="confluence-progress-stat empty">
                            <i class="fas fa-file"></i> 空: ${emptyCount || 0}
                        </span>
                    </div>
                    <div class="confluence-progress-detail">
                        <i class="fas fa-check-circle" style="color: #4CAF50;"></i>
                        ${message || '完了'}
                    </div>
                `;
                break;

            default:
                progressText.textContent = message || '';
        }
    }
}

// グローバルに公開
window.KnowledgeBaseModal = KnowledgeBaseModal;
