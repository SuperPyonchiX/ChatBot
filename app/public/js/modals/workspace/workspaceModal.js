/**
 * workspaceModal.js
 * Codex 作業ディレクトリ（サーバー側 app/workspace）のファイル一覧・内容表示・ダウンロードを行うモーダル
 */

class WorkspaceModal {
    static #instance = null;

    /** @type {boolean} */
    #initialized = false;

    /** @type {string|null} */
    #selectedPath = null;

    /** @type {Array<{path: string, isDir: boolean, size: number, mtime: string|null}>} */
    #files = [];

    constructor() {
        if (WorkspaceModal.#instance) {
            return WorkspaceModal.#instance;
        }
        WorkspaceModal.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {WorkspaceModal}
     */
    static get getInstance() {
        if (!WorkspaceModal.#instance) {
            WorkspaceModal.#instance = new WorkspaceModal();
        }
        return WorkspaceModal.#instance;
    }

    /**
     * イベントを結線する（初回のみ）
     */
    initialize() {
        if (this.#initialized) return;
        const modal = document.getElementById('workspaceModal');
        if (!modal) {
            console.warn('[WorkspaceModal] #workspaceModal が見つかりません');
            return;
        }

        modal.querySelector('#workspaceRefresh')?.addEventListener('click', () => this.refresh());
        modal.querySelector('#workspaceClose')?.addEventListener('click', () => this.hide());
        modal.querySelector('#workspaceDownload')?.addEventListener('click', () => this.#downloadSelected());

        document.addEventListener('codex:completed', () => {
            if (window.CONFIG?.CODEX?.WORKSPACE?.REFRESH_ON_COMPLETE !== false && this.isVisible()) {
                this.refresh();
            }
        });

        this.#initialized = true;
        console.log('[WorkspaceModal] 初期化完了');
    }

    /**
     * モーダルを表示して一覧を取得する
     */
    show() {
        this.initialize();
        UIUtils.getInstance.toggleModal('workspaceModal', true);
        this.refresh();
    }

    /**
     * モーダルを閉じる
     */
    hide() {
        UIUtils.getInstance.toggleModal('workspaceModal', false);
    }

    /**
     * @returns {boolean}
     */
    isVisible() {
        return document.getElementById('workspaceModal')?.classList.contains('show') === true;
    }

    /**
     * ファイル一覧を取り直す
     * @returns {Promise<void>}
     */
    async refresh() {
        const list = document.getElementById('workspaceFileList');
        const rootEl = document.getElementById('workspaceRoot');
        if (!list) return;

        try {
            const response = await fetch(window.CONFIG?.CODEX?.ENDPOINTS?.WORKSPACE_FILES || '/api/workspace/files');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.#files = data.files || [];
            if (rootEl) rootEl.textContent = data.root || '';
            this.#renderList(list);
            if (this.#selectedPath && this.#files.some(f => f.path === this.#selectedPath && !f.isDir)) {
                await this.#openFile(this.#selectedPath);
            }
        } catch (error) {
            console.error('[WorkspaceModal] 一覧取得エラー:', error);
            list.innerHTML = '';
            const li = document.createElement('li');
            li.className = 'workspace-empty';
            li.textContent = `一覧を取得できませんでした: ${error.message}`;
            list.appendChild(li);
        }
    }

    // ========================================
    // 内部処理
    // ========================================

    /**
     * @param {HTMLElement} list
     */
    #renderList(list) {
        list.innerHTML = '';
        if (this.#files.length === 0) {
            const li = document.createElement('li');
            li.className = 'workspace-empty';
            li.textContent = 'ファイルはまだありません。Codex モードで「hello.txt を作って」などと依頼してください。';
            list.appendChild(li);
            return;
        }
        for (const file of this.#files) {
            const li = document.createElement('li');
            const depth = file.path.split('/').length - 1;
            li.className = `workspace-file ${file.isDir ? 'is-dir' : 'is-file'}`;
            li.style.paddingLeft = `${8 + depth * 14}px`;
            li.dataset.path = file.path;
            const name = file.path.split('/').pop();
            li.innerHTML = `<i class="fas ${file.isDir ? 'fa-folder' : 'fa-file-alt'}"></i> <span class="workspace-file-name"></span><span class="workspace-file-size"></span>`;
            li.querySelector('.workspace-file-name').textContent = name;
            if (!file.isDir) {
                li.querySelector('.workspace-file-size').textContent = this.#formatSize(file.size);
                li.addEventListener('click', () => this.#openFile(file.path));
            }
            if (file.path === this.#selectedPath) li.classList.add('selected');
            list.appendChild(li);
        }
    }

    /**
     * @param {string} relPath
     */
    async #openFile(relPath) {
        this.#selectedPath = relPath;
        const preview = document.getElementById('workspacePreview');
        const title = document.getElementById('workspacePreviewTitle');
        const downloadBtn = document.getElementById('workspaceDownload');
        document.querySelectorAll('#workspaceFileList .workspace-file').forEach(el => {
            el.classList.toggle('selected', el.dataset.path === relPath);
        });
        if (!preview) return;
        if (title) title.textContent = relPath;
        if (downloadBtn) downloadBtn.disabled = false;
        preview.textContent = '読み込み中...';

        try {
            const endpoint = window.CONFIG?.CODEX?.ENDPOINTS?.WORKSPACE_FILE || '/api/workspace/file';
            const response = await fetch(`${endpoint}?path=${encodeURIComponent(relPath)}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error?.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            if (data.binary) {
                preview.textContent = `バイナリファイル (${this.#formatSize(data.size)})。ダウンロードして確認してください。`;
                return;
            }
            this.#renderPreview(preview, data.content || '', relPath);
            if (data.truncated) {
                preview.textContent += `\n\n... (先頭 ${this.#formatSize(window.CONFIG?.CODEX?.WORKSPACE?.MAX_FILE_PREVIEW || 1048576)} のみ表示)`;
            }
        } catch (error) {
            console.error('[WorkspaceModal] ファイル取得エラー:', error);
            preview.textContent = `読み込めませんでした: ${error.message}`;
        }
    }

    /**
     * @param {HTMLElement} preview
     * @param {string} content
     * @param {string} relPath
     */
    #renderPreview(preview, content, relPath) {
        const lang = this.#guessLanguage(relPath);
        if (lang && typeof Prism !== 'undefined' && Prism.languages?.[lang]) {
            try {
                // @ts-ignore - Prism.highlight は実際には存在する
                preview.innerHTML = Prism.highlight(content, Prism.languages[lang], lang);
                preview.className = `workspace-preview language-${lang}`;
                return;
            } catch { /* フォールバック */ }
        }
        preview.className = 'workspace-preview';
        preview.textContent = content;
    }

    /**
     * @param {string} relPath
     * @returns {string|null}
     */
    #guessLanguage(relPath) {
        const ext = (relPath.split('.').pop() || '').toLowerCase();
        const map = {
            js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx',
            py: 'python', json: 'json', html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup',
            css: 'css', md: 'markdown', sh: 'bash', bash: 'bash', yml: 'yaml', yaml: 'yaml',
            c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', java: 'java', go: 'go', rs: 'rust',
            sql: 'sql', toml: 'toml', ini: 'ini', ps1: 'powershell'
        };
        return map[ext] || null;
    }

    #downloadSelected() {
        if (!this.#selectedPath) return;
        const endpoint = window.CONFIG?.CODEX?.ENDPOINTS?.WORKSPACE_FILE || '/api/workspace/file';
        const a = document.createElement('a');
        a.href = `${endpoint}?path=${encodeURIComponent(this.#selectedPath)}&download=1`;
        a.download = this.#selectedPath.split('/').pop() || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    /**
     * @param {number} bytes
     * @returns {string}
     */
    #formatSize(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    }
}

window.WorkspaceModal = WorkspaceModal;
