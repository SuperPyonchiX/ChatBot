/**
 * propertiesPanel.js
 * ノードプロパティ編集パネル
 */

class PropertiesPanel {
    static #instance = null;

    /** @type {HTMLElement} */
    #container = null;

    /** @type {NodeRegistry} */
    #nodeRegistry = null;

    /** @type {Object|null} */
    #currentNode = null;

    /** @type {Function|null} */
    #onPropertyChange = null;

    /**
     * @constructor
     */
    constructor() {
        if (PropertiesPanel.#instance) {
            return PropertiesPanel.#instance;
        }
        PropertiesPanel.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {PropertiesPanel}
     */
    static get getInstance() {
        if (!PropertiesPanel.#instance) {
            PropertiesPanel.#instance = new PropertiesPanel();
        }
        return PropertiesPanel.#instance;
    }

    /**
     * パネルを初期化
     * @param {HTMLElement} container
     * @param {Function} [onPropertyChange] - プロパティ変更時のコールバック
     */
    initialize(container, onPropertyChange = null) {
        this.#container = container;
        this.#nodeRegistry = window.NodeRegistry?.getInstance || new NodeRegistry();
        this.#onPropertyChange = onPropertyChange;

        this.#renderEmpty();
        console.log('[PropertiesPanel] 初期化完了');
    }

    /**
     * 空の状態を描画
     */
    #renderEmpty() {
        this.#container.innerHTML = '';
        this.#container.classList.add('properties-panel');

        this.#container.innerHTML = `
            <div class="properties-empty">
                <div class="empty-icon">📝</div>
                <div class="empty-text">ノードを選択してください</div>
            </div>
        `;
    }

    /**
     * ノードのプロパティを表示
     * @param {Object} node
     */
    showNode(node) {
        if (!node) {
            this.#renderEmpty();
            return;
        }

        this.#currentNode = node;
        const definition = this.#nodeRegistry.get(node.type);

        if (!definition) {
            this.#renderEmpty();
            return;
        }

        this.#container.innerHTML = '';

        // ヘッダー
        const header = document.createElement('div');
        header.classList.add('properties-header');
        header.innerHTML = `
            <div class="header-icon" style="color: ${definition.color}">${definition.icon}</div>
            <div class="header-info">
                <div class="header-name">${definition.name}</div>
                <div class="header-type">${node.type}</div>
            </div>
        `;
        this.#container.appendChild(header);

        // プロパティフォーム
        const form = document.createElement('div');
        form.classList.add('properties-form');

        for (const [key, propDef] of Object.entries(definition.properties)) {
            const value = node.properties[key] ?? propDef.default;
            const field = this.#createField(key, propDef, value);
            form.appendChild(field);
        }

        this.#container.appendChild(form);

        // 入力/出力ポート情報
        const portsSection = document.createElement('div');
        portsSection.classList.add('properties-ports');

        if (Object.keys(definition.inputs).length > 0) {
            portsSection.innerHTML += `
                <div class="ports-section">
                    <div class="ports-title">入力ポート</div>
                    ${Object.entries(definition.inputs).map(([name, port]) => `
                        <div class="port-item input">
                            <span class="port-dot"></span>
                            <span class="port-name">${port.label}</span>
                            <span class="port-type">${port.type}</span>
                            ${port.optional ? '<span class="port-optional">optional</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (Object.keys(definition.outputs).length > 0) {
            portsSection.innerHTML += `
                <div class="ports-section">
                    <div class="ports-title">出力ポート</div>
                    ${Object.entries(definition.outputs).map(([name, port]) => `
                        <div class="port-item output">
                            <span class="port-name">${port.label}</span>
                            <span class="port-type">${port.type}</span>
                            <span class="port-dot"></span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        this.#container.appendChild(portsSection);

        // ノードID（参考情報）
        const idSection = document.createElement('div');
        idSection.classList.add('properties-id');
        idSection.innerHTML = `
            <span class="id-label">ID:</span>
            <span class="id-value">${node.id}</span>
        `;
        this.#container.appendChild(idSection);
    }

    /**
     * フィールドを作成
     * @param {string} key
     * @param {Object} propDef
     * @param {*} value
     * @returns {HTMLElement}
     */
    #createField(key, propDef, value) {
        const field = document.createElement('div');
        field.classList.add('property-field');

        const label = document.createElement('label');
        label.classList.add('field-label');
        label.textContent = propDef.label || key;
        label.htmlFor = `prop_${key}`;
        field.appendChild(label);

        let input;

        switch (propDef.type) {
            case 'text':
                input = document.createElement('input');
                input.type = 'text';
                input.value = value || '';
                input.placeholder = propDef.placeholder || '';
                break;

            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.value = value ?? propDef.default ?? 0;
                if (propDef.min !== undefined) input.min = propDef.min;
                if (propDef.max !== undefined) input.max = propDef.max;
                if (propDef.step !== undefined) input.step = propDef.step;
                break;

            case 'textarea':
                input = document.createElement('textarea');
                input.value = value || '';
                input.placeholder = propDef.placeholder || '';
                input.rows = 4;
                break;

            case 'code':
                input = document.createElement('textarea');
                input.classList.add('code-input');
                input.value = value || '';
                input.rows = 8;
                input.spellcheck = false;
                break;

            case 'select':
                input = document.createElement('select');
                let options = propDef.options || [];

                // モデル選択の場合は動的にオプションを取得
                if (key === 'model') {
                    options = this.#getAvailableModels();
                }

                for (const opt of options) {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (opt === value) option.selected = true;
                    input.appendChild(option);
                }
                break;

            case 'checkbox':
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.classList.add('checkbox-wrapper');
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!value;
                checkboxWrapper.appendChild(input);
                field.appendChild(checkboxWrapper);
                break;

            case 'object':
                input = document.createElement('textarea');
                input.classList.add('json-input');
                input.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : '{}';
                input.rows = 4;
                break;

            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = value || '';
        }

        input.id = `prop_${key}`;
        input.classList.add('field-input');
        input.dataset.propKey = key;

        // 変更イベント
        input.addEventListener('change', (e) => this.#handlePropertyChange(key, e));
        input.addEventListener('input', (e) => this.#handlePropertyInput(key, e));

        if (propDef.type !== 'checkbox') {
            field.appendChild(input);
        }

        // 説明文
        if (propDef.description) {
            const desc = document.createElement('div');
            desc.classList.add('field-description');
            desc.textContent = propDef.description;
            field.appendChild(desc);
        }

        return field;
    }

    /**
     * 利用可能なモデル一覧を取得
     * @returns {string[]}
     */
    #getAvailableModels() {
        const models = [];

        if (window.CONFIG?.MODELS) {
            if (window.CONFIG.MODELS.OPENAI) {
                models.push(...window.CONFIG.MODELS.OPENAI);
            }
            if (window.CONFIG.MODELS.CLAUDE) {
                models.push(...window.CONFIG.MODELS.CLAUDE);
            }
            if (window.CONFIG.MODELS.GEMINI) {
                models.push(...window.CONFIG.MODELS.GEMINI);
            }
        }

        return models.length > 0 ? models : ['gpt-4o', 'gpt-5', 'claude-4.5-sonnet', 'gemini-2.5-pro'];
    }

    /**
     * プロパティ変更ハンドラ（確定時）
     * @param {string} key
     * @param {Event} e
     */
    #handlePropertyChange(key, e) {
        if (!this.#currentNode) return;

        let value;
        const input = e.target;
        const propDef = this.#nodeRegistry.get(this.#currentNode.type)?.properties[key];

        switch (propDef?.type) {
            case 'number':
                value = parseFloat(input.value);
                break;
            case 'checkbox':
                value = input.checked;
                break;
            case 'object':
                try {
                    value = JSON.parse(input.value);
                } catch {
                    value = {};
                    input.classList.add('invalid');
                    return;
                }
                input.classList.remove('invalid');
                break;
            default:
                value = input.value;
        }

        this.#currentNode.properties[key] = value;

        if (this.#onPropertyChange) {
            this.#onPropertyChange(this.#currentNode.id, { [key]: value });
        }
    }

    /**
     * プロパティ入力ハンドラ（リアルタイム）
     * @param {string} key
     * @param {Event} e
     */
    #handlePropertyInput(key, e) {
        // テキストエリアの場合は高さを自動調整
        const input = e.target;
        if (input.tagName === 'TEXTAREA') {
            input.style.height = 'auto';
            input.style.height = `${input.scrollHeight}px`;
        }
    }

    /**
     * 現在のノードを取得
     * @returns {Object|null}
     */
    getCurrentNode() {
        return this.#currentNode;
    }

    /**
     * パネルをクリア
     */
    clear() {
        this.#currentNode = null;
        this.#renderEmpty();
    }

    /**
     * プロパティを更新
     * @param {string} key
     * @param {*} value
     */
    updateProperty(key, value) {
        if (!this.#currentNode) return;

        this.#currentNode.properties[key] = value;

        const input = this.#container.querySelector(`#prop_${key}`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = !!value;
            } else if (input.tagName === 'SELECT') {
                input.value = value;
            } else {
                input.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
            }
        }
    }

    /**
     * プロパティ変更コールバックを設定
     * @param {Function} callback
     */
    setOnPropertyChange(callback) {
        this.#onPropertyChange = callback;
    }
}

// グローバルに公開
window.PropertiesPanel = PropertiesPanel;
