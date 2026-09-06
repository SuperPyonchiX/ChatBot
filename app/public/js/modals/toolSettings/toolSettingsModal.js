/**
 * toolSettingsModal.js
 * ツール設定モーダル
 * モデルが自分で呼び出せるツールの有効/無効、往復回数、カスタムツールの管理
 */

class ToolSettingsModal {
    static #instance = null;

    /** @type {HTMLElement|null} */
    #modalElement = null;

    /** @type {HTMLElement|null} */
    #overlayElement = null;

    constructor() {
        if (ToolSettingsModal.#instance) {
            return ToolSettingsModal.#instance;
        }
        ToolSettingsModal.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {ToolSettingsModal}
     */
    static get getInstance() {
        if (!ToolSettingsModal.#instance) {
            ToolSettingsModal.#instance = new ToolSettingsModal();
        }
        return ToolSettingsModal.#instance;
    }

    /**
     * モーダルを表示
     * @returns {Promise<void>}
     */
    async show() {
        if (this.#modalElement) {
            this.#modalElement.classList.add('visible');
            this.#overlayElement?.classList.add('visible');
            return;
        }
        if (typeof ToolManager !== 'undefined') {
            await ToolManager.getInstance.waitForInitialization();
        }
        this.#createModal();
        await this.#renderBody();
        requestAnimationFrame(() => {
            this.#modalElement?.classList.add('visible');
            this.#overlayElement?.classList.add('visible');
        });
        console.log('[ToolSettingsModal] モーダルを表示');
    }

    /**
     * モーダルを閉じる
     */
    hide() {
        this.#modalElement?.classList.remove('visible');
        this.#overlayElement?.classList.remove('visible');
        setTimeout(() => {
            this.#modalElement?.remove();
            this.#overlayElement?.remove();
            this.#modalElement = null;
            this.#overlayElement = null;
        }, 300);
    }

    // ========================================
    // 内部処理
    // ========================================

    #createModal() {
        this.#overlayElement = document.createElement('div');
        this.#overlayElement.className = 'tool-settings-overlay';
        this.#overlayElement.addEventListener('click', () => this.hide());

        this.#modalElement = document.createElement('div');
        this.#modalElement.className = 'tool-settings-modal';
        this.#modalElement.innerHTML = `
            <div class="tool-settings-header">
                <h2 class="tool-settings-title"><span class="tool-settings-icon">🧰</span> ツール設定</h2>
                <button class="tool-settings-close" title="閉じる"><i class="fas fa-times"></i></button>
            </div>
            <div class="tool-settings-content">
                <p class="tool-settings-description">
                    ここで有効にしたツールは、対応モデルとの通常のチャットでモデルが必要に応じて自分で呼び出します。
                    ホスト OS に触るツールは既定で無効です。
                </p>
                <div class="tool-settings-body"></div>
            </div>
            <div class="tool-settings-footer">
                <div class="tool-settings-footer-right">
                    <button class="tool-settings-btn tool-settings-btn-secondary" data-action="cancel">キャンセル</button>
                    <button class="tool-settings-btn tool-settings-btn-primary" data-action="save">保存</button>
                </div>
            </div>
        `;
        this.#modalElement.querySelector('.tool-settings-close').addEventListener('click', () => this.hide());
        this.#modalElement.querySelector('[data-action="cancel"]').addEventListener('click', () => this.hide());
        this.#modalElement.querySelector('[data-action="save"]').addEventListener('click', () => this.#save());

        document.body.appendChild(this.#overlayElement);
        document.body.appendChild(this.#modalElement);
    }

    async #renderBody() {
        const body = this.#modalElement?.querySelector('.tool-settings-body');
        if (!body) return;

        const config = window.CONFIG?.TOOLS || {};
        const labels = config.CATEGORY_LABELS || {};
        const displayNames = config.DISPLAY_NAMES || {};
        const tools = typeof ToolManager !== 'undefined' ? ToolManager.getInstance.getAllTools() : [];
        const maxRounds = typeof ToolManager !== 'undefined' ? ToolManager.getInstance.getMaxRounds() : (config.MAX_ROUNDS || 8);

        const order = ['generate', 'info', 'exec', 'workspace', 'custom', 'other'];
        const groups = new Map();
        for (const tool of tools) {
            const cat = order.includes(tool.category) ? tool.category : 'other';
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(tool);
        }

        const sections = order
            .filter(cat => groups.has(cat) || cat === 'custom')
            .map(cat => {
                const items = groups.get(cat) || [];
                const list = items.map(tool => `
                    <label class="tool-settings-tool-item">
                        <input type="checkbox" data-tool="${this.#escape(tool.name)}" ${tool.enabled ? 'checked' : ''}>
                        <span class="tool-settings-tool-info">
                            <span class="tool-settings-tool-name">${this.#escape(displayNames[tool.name] || tool.name)} <code>${this.#escape(tool.name)}</code></span>
                            <span class="tool-settings-tool-desc">${this.#escape(tool.description || '')}</span>
                        </span>
                        ${tool.isCustom ? `<span class="tool-settings-tool-actions">
                            <button class="tool-settings-btn tool-settings-btn-secondary" data-edit="${this.#escape(tool.name)}" type="button">編集</button>
                        </span>` : ''}
                    </label>`).join('');
                const empty = cat === 'custom' && items.length === 0
                    ? '<p class="tool-settings-hint">カスタムツールはまだありません。</p>' : '';
                const custom = cat === 'custom'
                    ? `<div class="tool-settings-form-group">
                        <button class="tool-settings-btn tool-settings-btn-secondary" data-action="new-custom" type="button">＋ カスタムツールを作成</button>
                       </div>` : '';
                return `
                    <div class="tool-settings-section${cat === 'workspace' ? ' tool-settings-section-warning' : ''}">
                        <h3 class="tool-settings-section-title">${this.#escape(labels[cat] || cat)}</h3>
                        <div class="tool-settings-tool-list">${list}</div>
                        ${empty}${custom}
                    </div>`;
            }).join('');

        body.innerHTML = `
            ${sections}
            <div class="tool-settings-section">
                <h3 class="tool-settings-section-title">実行回数</h3>
                <div class="tool-settings-form-group">
                    <label class="tool-settings-label" for="tool-max-rounds">1 回の送信でツールを往復させる最大回数</label>
                    <input type="number" class="tool-settings-input" id="tool-max-rounds" min="1" max="30" value="${maxRounds}">
                    <span class="tool-settings-hint">モデルがツールを呼び、結果を受け取って続きを生成する、を繰り返す上限。無限ループ防止用</span>
                </div>
            </div>
        `;

        body.querySelector('[data-action="new-custom"]')?.addEventListener('click', () => {
            if (typeof CustomToolEditor !== 'undefined') CustomToolEditor.getInstance.show();
        });
        body.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const name = btn.dataset.edit;
                if (typeof CustomToolStorage === 'undefined' || typeof CustomToolEditor === 'undefined') return;
                const all = await CustomToolStorage.getInstance.getAll();
                const def = all.find(t => t.name === name);
                if (def) CustomToolEditor.getInstance.show(def);
            });
        });

        // カスタムツールの保存・削除で一覧を描き直す
        const rerender = () => { if (this.#modalElement) this.#renderBody(); };
        window.addEventListener('customToolSaved', rerender, { once: true });
        window.addEventListener('customToolDeleted', rerender, { once: true });
    }

    #save() {
        if (!this.#modalElement || typeof ToolManager === 'undefined') return;
        const enabledTools = [...this.#modalElement.querySelectorAll('input[data-tool]')]
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.tool);
        const maxRounds = Number(this.#modalElement.querySelector('#tool-max-rounds')?.value) || undefined;
        ToolManager.getInstance.saveSettings({ enabledTools, maxRounds });
        this.hide();
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    #escape(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }
}

window.ToolSettingsModal = ToolSettingsModal;
