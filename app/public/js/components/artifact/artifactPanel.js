/**
 * ArtifactPanel
 * アーティファクトサイドパネルのUIを管理するクラス
 */
class ArtifactPanel {
    static #instance = null;

    // DOM要素
    #panelElement = null;
    #previewContainer = null;
    #codeContainer = null;
    #titleElement = null;
    #typeBadge = null;
    #historyContainer = null;
    #resizeHandle = null;

    // 状態
    #isOpen = false;
    #currentTab = 'preview'; // 'preview' | 'code'
    #currentArtifact = null;
    #isResizing = false;

    constructor() {
        if (ArtifactPanel.#instance) {
            return ArtifactPanel.#instance;
        }
        ArtifactPanel.#instance = this;
        this.#initialize();
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ArtifactPanel.#instance) {
            ArtifactPanel.#instance = new ArtifactPanel();
        }
        return ArtifactPanel.#instance;
    }

    /**
     * 初期化
     */
    #initialize() {
        // DOM要素を取得
        this.#panelElement = document.getElementById('artifactPanel');
        this.#previewContainer = document.getElementById('artifactPreview');
        this.#codeContainer = document.getElementById('artifactCode');
        this.#titleElement = document.getElementById('artifactTitleText');
        this.#typeBadge = document.getElementById('artifactTypeBadge');
        this.#historyContainer = document.getElementById('artifactHistory');
        this.#resizeHandle = document.getElementById('artifactResizeHandle');

        if (!this.#panelElement) {
            console.warn('[ArtifactPanel] Panel element not found');
            return;
        }

        // イベントリスナーを設定
        this.#setupEventListeners();

        // ArtifactManagerのイベントを購読
        this.#subscribeToManager();

        console.log('[ArtifactPanel] Initialized');
    }

    /**
     * イベントリスナーを設定
     */
    #setupEventListeners() {
        // タブ切り替え
        const previewTab = document.getElementById('artifactPreviewTab');
        const codeTab = document.getElementById('artifactCodeTab');

        if (previewTab) {
            previewTab.addEventListener('click', () => this.switchTab('preview'));
        }
        if (codeTab) {
            codeTab.addEventListener('click', () => this.switchTab('code'));
        }

        // アクションボタン
        const editBtn = document.getElementById('artifactEditBtn');
        const downloadBtn = document.getElementById('artifactDownloadBtn');
        const closeBtn = document.getElementById('artifactCloseBtn');

        if (editBtn) {
            editBtn.addEventListener('click', () => this.#handleEdit());
        }
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.#handleDownload());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // リサイズハンドル
        if (this.#resizeHandle) {
            this.#setupResize();
        }

        // ESCキーでパネルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.#isOpen) {
                this.close();
            }
        });
    }

    /**
     * リサイズ機能を設定
     */
    #setupResize() {
        let startX = 0;
        let startWidth = 0;

        const onMouseDown = (e) => {
            e.preventDefault();
            this.#isResizing = true;
            startX = e.clientX;
            startWidth = this.#panelElement.offsetWidth;
            this.#resizeHandle.classList.add('dragging');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this.#isResizing) return;

            const diff = startX - e.clientX;
            const newWidth = Math.min(
                Math.max(startWidth + diff, 400),
                window.innerWidth * 0.7
            );

            this.#panelElement.style.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
            this.#isResizing = false;
            this.#resizeHandle.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.#resizeHandle.addEventListener('mousedown', onMouseDown);
    }

    /**
     * ArtifactManagerのイベントを購読
     */
    #subscribeToManager() {
        if (typeof ArtifactManager !== 'undefined') {
            ArtifactManager.getInstance.on('register', (artifact) => {
                this.displayArtifact(artifact);
                this.open();
            });

            ArtifactManager.getInstance.on('select', (artifact) => {
                this.displayArtifact(artifact);
            });

            ArtifactManager.getInstance.on('update', (artifact) => {
                if (this.#currentArtifact && this.#currentArtifact.id === artifact.id) {
                    this.displayArtifact(artifact);
                }
            });
        }
    }

    /**
     * パネルを開く
     */
    open() {
        if (this.#isOpen) return;

        this.#isOpen = true;
        this.#panelElement.classList.add('open');

        // app-containerにクラスを追加してレイアウトを調整
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.add('with-artifact-panel');
        }

        console.log('[ArtifactPanel] Opened');
    }

    /**
     * パネルを閉じる
     */
    close() {
        if (!this.#isOpen) return;

        this.#isOpen = false;
        this.#panelElement.classList.remove('open');

        // app-containerからクラスを削除
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.remove('with-artifact-panel');
        }

        console.log('[ArtifactPanel] Closed');
    }

    /**
     * パネルの開閉をトグル
     */
    toggle() {
        if (this.#isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * アーティファクトを表示
     * @param {Object} artifact - アーティファクトオブジェクト
     */
    async displayArtifact(artifact) {
        if (!artifact) return;

        this.#currentArtifact = artifact;

        // タイトルを更新
        if (this.#titleElement) {
            this.#titleElement.textContent = artifact.title || 'アーティファクト';
        }

        // タイプバッジを更新
        if (this.#typeBadge) {
            this.#typeBadge.textContent = artifact.type.toUpperCase();
        }

        // プレビューをレンダリング
        if (this.#previewContainer && typeof ArtifactRenderer !== 'undefined') {
            await ArtifactRenderer.getInstance.render(artifact, this.#previewContainer);
        }

        // コードタブを更新
        if (this.#codeContainer && typeof ArtifactRenderer !== 'undefined') {
            ArtifactRenderer.getInstance.renderCode(artifact, this.#codeContainer);
        }

        // 履歴を更新
        this.#updateHistory();

        console.log(`[ArtifactPanel] Displaying artifact: ${artifact.id}`);
    }

    /**
     * タブを切り替え
     * @param {string} tab - 'preview' | 'code'
     */
    switchTab(tab) {
        if (tab !== 'preview' && tab !== 'code') return;

        this.#currentTab = tab;

        // タブボタンのアクティブ状態を更新
        const previewTab = document.getElementById('artifactPreviewTab');
        const codeTab = document.getElementById('artifactCodeTab');

        if (previewTab && codeTab) {
            previewTab.classList.toggle('active', tab === 'preview');
            codeTab.classList.toggle('active', tab === 'code');
        }

        // コンテナの表示を切り替え
        if (this.#previewContainer && this.#codeContainer) {
            this.#previewContainer.classList.toggle('hidden', tab !== 'preview');
            this.#codeContainer.classList.toggle('hidden', tab !== 'code');
        }
    }

    /**
     * 履歴を更新
     */
    #updateHistory() {
        if (!this.#historyContainer || typeof ArtifactManager === 'undefined') return;

        const artifacts = ArtifactManager.getInstance.getAllArtifacts();
        this.#historyContainer.innerHTML = '';

        artifacts.slice(0, 10).forEach((artifact) => {
            const item = document.createElement('button');
            item.classList.add('artifact-history-item');
            if (this.#currentArtifact && this.#currentArtifact.id === artifact.id) {
                item.classList.add('active');
            }

            item.textContent = artifact.title || artifact.type;
            item.title = artifact.title;

            item.addEventListener('click', () => {
                ArtifactManager.getInstance.selectArtifact(artifact.id);
            });

            this.#historyContainer.appendChild(item);
        });
    }

    /**
     * 編集ハンドラ
     */
    #handleEdit() {
        if (!this.#currentArtifact) return;

        // ChatUIのshowCodeEditor経由でモーダルを開く
        if (typeof ChatUI !== 'undefined') {
            const language = this.#getLanguageForType(this.#currentArtifact.type);

            // showCodeEditorでモーダルを正しく開く
            // codeBlockはnull（アーティファクト編集用）
            ChatUI.getInstance.showCodeEditor(
                null,
                this.#currentArtifact.content,
                language
            );

            // 保存時の処理を設定（少し遅延させてエディタの初期化を待つ）
            setTimeout(() => {
                this.#setupEditSaveHandler();
            }, 100);
        }

        console.log('[ArtifactPanel] Opening editor for artifact:', this.#currentArtifact.id);
    }

    /**
     * アーティファクトタイプから言語を取得
     * @param {string} type - アーティファクトタイプ
     * @returns {string} 言語
     */
    #getLanguageForType(type) {
        const languageMap = {
            'html': 'html',
            'svg': 'html',
            'markdown': 'markdown',
            'mermaid': 'markdown'
        };
        return languageMap[type] || 'html';
    }

    /**
     * 編集保存ハンドラを設定
     */
    #setupEditSaveHandler() {
        const runButton = document.getElementById('runCodeButton');

        if (runButton && this.#currentArtifact) {
            const artifactId = this.#currentArtifact.id;
            const originalHandler = runButton.onclick;

            runButton.onclick = async () => {
                // コードを取得
                const newContent = MonacoEditorController.getInstance.getValue();

                // アーティファクトを更新
                if (typeof ArtifactManager !== 'undefined') {
                    ArtifactManager.getInstance.updateArtifact(artifactId, newContent);
                }

                // 元のハンドラがあれば実行
                if (originalHandler) {
                    originalHandler();
                }
            };
        }
    }

    /**
     * ダウンロードハンドラ
     */
    #handleDownload() {
        if (!this.#currentArtifact) return;

        if (typeof ArtifactManager !== 'undefined') {
            ArtifactManager.getInstance.downloadArtifact(this.#currentArtifact.id);
        }
    }

    /**
     * パネルが開いているかどうか
     * @returns {boolean}
     */
    get isOpen() {
        return this.#isOpen;
    }

    /**
     * 現在のタブ
     * @returns {string}
     */
    get currentTab() {
        return this.#currentTab;
    }

    /**
     * 現在のアーティファクト
     * @returns {Object|null}
     */
    get currentArtifact() {
        return this.#currentArtifact;
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    // ArtifactPanelを初期化してイベント購読を開始
    ArtifactPanel.getInstance;
});
