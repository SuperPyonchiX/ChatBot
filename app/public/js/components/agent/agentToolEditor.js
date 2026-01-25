/**
 * agentToolEditor.js
 * カスタムツール編集UI
 * ツールの追加、編集、テスト、インポート/エクスポート
 */

class AgentToolEditor {
    static #instance = null;

    /** @type {HTMLElement|null} */
    #modalElement = null;

    /** @type {HTMLElement|null} */
    #overlayElement = null;

    /** @type {Object|null} */
    #currentTool = null;

    /** @type {boolean} */
    #isEditMode = false;

    /** @type {Function[]} */
    #eventListeners = [];

    /**
     * @constructor
     */
    constructor() {
        if (AgentToolEditor.#instance) {
            return AgentToolEditor.#instance;
        }
        AgentToolEditor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentToolEditor}
     */
    static get getInstance() {
        if (!AgentToolEditor.#instance) {
            AgentToolEditor.#instance = new AgentToolEditor();
        }
        return AgentToolEditor.#instance;
    }

    // ========================================
    // 表示/非表示
    // ========================================

    /**
     * エディタを表示
     * @param {Object} [tool] - 編集するツール（省略時は新規作成）
     */
    async show(tool = null) {
        this.#currentTool = tool;
        this.#isEditMode = !!tool;

        if (this.#modalElement) {
            this.#updateForm();
            this.#modalElement.classList.add('visible');
            this.#overlayElement?.classList.add('visible');
            return;
        }

        await this.#createModal();

        requestAnimationFrame(() => {
            this.#modalElement?.classList.add('visible');
            this.#overlayElement?.classList.add('visible');
        });

        console.log('[AgentToolEditor] エディタを表示');
    }

    /**
     * エディタを非表示
     */
    hide() {
        this.#modalElement?.classList.remove('visible');
        this.#overlayElement?.classList.remove('visible');

        setTimeout(() => {
            this.#cleanup();
        }, 300);
    }

    /**
     * クリーンアップ
     */
    #cleanup() {
        this.#eventListeners.forEach(({ element, event, handler }) => {
            element?.removeEventListener(event, handler);
        });
        this.#eventListeners = [];

        this.#modalElement?.remove();
        this.#overlayElement?.remove();
        this.#modalElement = null;
        this.#overlayElement = null;
        this.#currentTool = null;
    }

    // ========================================
    // モーダル構築
    // ========================================

    /**
     * モーダルを作成
     */
    async #createModal() {
        // オーバーレイ
        this.#overlayElement = document.createElement('div');
        this.#overlayElement.className = 'agent-tool-editor-overlay';
        this.#addEventHandler(this.#overlayElement, 'click', () => this.hide());

        // モーダル本体
        this.#modalElement = document.createElement('div');
        this.#modalElement.className = 'agent-tool-editor-modal';
        this.#modalElement.innerHTML = `
            <div class="agent-tool-editor-header">
                <h2 class="agent-tool-editor-title">
                    ${this.#isEditMode ? 'ツールを編集' : '新しいツールを作成'}
                </h2>
                <button class="agent-tool-editor-close" title="閉じる">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="agent-tool-editor-content">
                <div class="agent-tool-editor-form">
                    <div class="agent-tool-editor-section">
                        <label class="agent-tool-editor-label">ツール名 <span class="required">*</span></label>
                        <input type="text" class="agent-tool-editor-input" id="tool-name"
                            placeholder="例: weather_api" pattern="^[a-z_][a-z0-9_]*$">
                        <span class="agent-tool-editor-hint">英小文字とアンダースコアのみ（例: my_tool）</span>
                    </div>

                    <div class="agent-tool-editor-section">
                        <label class="agent-tool-editor-label">説明 <span class="required">*</span></label>
                        <textarea class="agent-tool-editor-textarea" id="tool-description" rows="2"
                            placeholder="このツールが何をするか説明してください"></textarea>
                    </div>

                    <div class="agent-tool-editor-section">
                        <label class="agent-tool-editor-label">キーワード</label>
                        <input type="text" class="agent-tool-editor-input" id="tool-keywords"
                            placeholder="カンマ区切り（例: 天気, weather, 気象）">
                        <span class="agent-tool-editor-hint">ツール選択時のマッチングに使用</span>
                    </div>

                    <div class="agent-tool-editor-section">
                        <label class="agent-tool-editor-label">パラメータ（JSON Schema）</label>
                        <textarea class="agent-tool-editor-textarea agent-tool-editor-code" id="tool-parameters" rows="8"
                            placeholder='{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "都市名"
    }
  },
  "required": ["city"]
}'></textarea>
                    </div>

                    <div class="agent-tool-editor-section">
                        <label class="agent-tool-editor-label">実行コード <span class="required">*</span></label>
                        <textarea class="agent-tool-editor-textarea agent-tool-editor-code" id="tool-code" rows="12"
                            placeholder="// paramsにパラメータが渡されます
// fetch, JSON, Math, Date などが使用可能
// 結果をreturnで返してください

const response = await fetch(\`https://api.example.com/data?q=\${params.query}\`);
return response;"></textarea>
                        <span class="agent-tool-editor-hint">
                            利用可能: params, fetch, JSON, Math, Date, console.log
                        </span>
                    </div>
                </div>

                <div class="agent-tool-editor-test">
                    <div class="agent-tool-editor-test-header">
                        <h3>テスト実行</h3>
                        <button class="agent-tool-editor-btn agent-tool-editor-btn-secondary" id="tool-test-btn">
                            <i class="fas fa-play"></i> テスト
                        </button>
                    </div>
                    <div class="agent-tool-editor-section">
                        <label class="agent-tool-editor-label">テストパラメータ（JSON）</label>
                        <textarea class="agent-tool-editor-textarea agent-tool-editor-code" id="tool-test-params" rows="4"
                            placeholder='{ "city": "Tokyo" }'></textarea>
                    </div>
                    <div class="agent-tool-editor-test-result" id="tool-test-result">
                        <div class="test-result-placeholder">テスト結果がここに表示されます</div>
                    </div>
                </div>
            </div>
            <div class="agent-tool-editor-footer">
                <div class="agent-tool-editor-footer-left">
                    <button class="agent-tool-editor-btn agent-tool-editor-btn-secondary" id="tool-validate-btn">
                        <i class="fas fa-check-circle"></i> 検証
                    </button>
                </div>
                <div class="agent-tool-editor-footer-right">
                    <button class="agent-tool-editor-btn agent-tool-editor-btn-secondary" id="tool-cancel-btn">
                        キャンセル
                    </button>
                    <button class="agent-tool-editor-btn agent-tool-editor-btn-primary" id="tool-save-btn">
                        <i class="fas fa-save"></i> 保存
                    </button>
                </div>
            </div>
        `;

        this.#setupEventHandlers();
        this.#updateForm();

        document.body.appendChild(this.#overlayElement);
        document.body.appendChild(this.#modalElement);
    }

    /**
     * イベントハンドラを設定
     */
    #setupEventHandlers() {
        // 閉じるボタン
        const closeBtn = this.#modalElement.querySelector('.agent-tool-editor-close');
        this.#addEventHandler(closeBtn, 'click', () => this.hide());

        // キャンセルボタン
        const cancelBtn = this.#modalElement.querySelector('#tool-cancel-btn');
        this.#addEventHandler(cancelBtn, 'click', () => this.hide());

        // 保存ボタン
        const saveBtn = this.#modalElement.querySelector('#tool-save-btn');
        this.#addEventHandler(saveBtn, 'click', () => this.#handleSave());

        // 検証ボタン
        const validateBtn = this.#modalElement.querySelector('#tool-validate-btn');
        this.#addEventHandler(validateBtn, 'click', () => this.#handleValidate());

        // テストボタン
        const testBtn = this.#modalElement.querySelector('#tool-test-btn');
        this.#addEventHandler(testBtn, 'click', () => this.#handleTest());

        // ESCキーで閉じる
        this.#addEventHandler(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.#modalElement?.classList.contains('visible')) {
                this.hide();
            }
        });
    }

    /**
     * イベントハンドラを追加
     */
    #addEventHandler(element, event, handler) {
        element?.addEventListener(event, handler);
        this.#eventListeners.push({ element, event, handler });
    }

    // ========================================
    // フォーム操作
    // ========================================

    /**
     * フォームを更新
     */
    #updateForm() {
        if (!this.#modalElement) return;

        const nameInput = this.#modalElement.querySelector('#tool-name');
        const descInput = this.#modalElement.querySelector('#tool-description');
        const keywordsInput = this.#modalElement.querySelector('#tool-keywords');
        const paramsInput = this.#modalElement.querySelector('#tool-parameters');
        const codeInput = this.#modalElement.querySelector('#tool-code');

        if (this.#currentTool) {
            nameInput.value = this.#currentTool.name || '';
            descInput.value = this.#currentTool.description || '';
            keywordsInput.value = (this.#currentTool.keywords || []).join(', ');
            paramsInput.value = this.#currentTool.parameters
                ? JSON.stringify(this.#currentTool.parameters, null, 2)
                : '';
            codeInput.value = this.#currentTool.executeCode || '';

            // 編集モードではツール名を変更不可
            nameInput.disabled = true;
        } else {
            nameInput.value = '';
            descInput.value = '';
            keywordsInput.value = '';
            paramsInput.value = '';
            codeInput.value = '';
            nameInput.disabled = false;
        }

        // タイトルを更新
        const title = this.#modalElement.querySelector('.agent-tool-editor-title');
        if (title) {
            title.textContent = this.#isEditMode ? 'ツールを編集' : '新しいツールを作成';
        }
    }

    /**
     * フォームからツール定義を取得
     * @returns {Object|null}
     */
    #getFormData() {
        const nameInput = this.#modalElement.querySelector('#tool-name');
        const descInput = this.#modalElement.querySelector('#tool-description');
        const keywordsInput = this.#modalElement.querySelector('#tool-keywords');
        const paramsInput = this.#modalElement.querySelector('#tool-parameters');
        const codeInput = this.#modalElement.querySelector('#tool-code');

        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        const keywords = keywordsInput.value.split(',').map(k => k.trim()).filter(Boolean);
        const code = codeInput.value.trim();

        // バリデーション
        if (!name) {
            this.#showError('ツール名を入力してください');
            return null;
        }

        if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
            this.#showError('ツール名は英小文字とアンダースコアのみ使用できます');
            return null;
        }

        if (!description) {
            this.#showError('説明を入力してください');
            return null;
        }

        if (!code) {
            this.#showError('実行コードを入力してください');
            return null;
        }

        // パラメータのパース
        let parameters = null;
        const paramsText = paramsInput.value.trim();
        if (paramsText) {
            try {
                parameters = JSON.parse(paramsText);
            } catch (error) {
                this.#showError(`パラメータのJSON形式が不正です: ${error.message}`);
                return null;
            }
        }

        return {
            id: this.#currentTool?.id || null,
            name,
            description,
            keywords,
            parameters: parameters || {
                type: 'object',
                properties: {},
                required: []
            },
            executeCode: code,
            enabled: this.#currentTool?.enabled ?? true
        };
    }

    // ========================================
    // アクション
    // ========================================

    /**
     * 保存処理
     */
    async #handleSave() {
        const toolData = this.#getFormData();
        if (!toolData) return;

        try {
            // ストレージ初期化
            await CustomToolStorage.getInstance.initialize();

            // 重複チェック（新規の場合）
            if (!this.#isEditMode) {
                const existing = await CustomToolStorage.getInstance.getByName(toolData.name);
                if (existing) {
                    this.#showError(`ツール名 "${toolData.name}" は既に使用されています`);
                    return;
                }
            }

            // 保存
            const saved = await CustomToolStorage.getInstance.save(toolData);

            // ツールマネージャーに登録
            await this.#registerToToolManager(saved);

            this.#showSuccess('ツールを保存しました');
            this.hide();

            // イベントを発火
            window.dispatchEvent(new CustomEvent('customToolSaved', { detail: saved }));

        } catch (error) {
            console.error('[AgentToolEditor] 保存エラー:', error);
            this.#showError(`保存に失敗しました: ${error.message}`);
        }
    }

    /**
     * ツールマネージャーに登録
     * @param {Object} tool
     */
    async #registerToToolManager(tool) {
        const toolManager = window.AgentToolManager?.getInstance;
        if (!toolManager) return;

        // カスタムツールインスタンスを作成
        const toolInstance = {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            keywords: tool.keywords,
            isCustom: true,
            execute: async (params) => {
                return await CustomToolExecutor.getInstance.execute(tool, params);
            },
            getToolDefinition: function() {
                return {
                    name: this.name,
                    description: this.description,
                    parameters: this.parameters
                };
            }
        };

        toolManager.registerTool(toolInstance);
    }

    /**
     * 検証処理
     */
    #handleValidate() {
        const codeInput = this.#modalElement.querySelector('#tool-code');
        const code = codeInput.value.trim();

        if (!code) {
            this.#showError('実行コードを入力してください');
            return;
        }

        const result = CustomToolExecutor.getInstance.validate(code);

        const resultDiv = this.#modalElement.querySelector('#tool-test-result');
        if (result.valid) {
            resultDiv.innerHTML = `
                <div class="test-result-success">
                    <i class="fas fa-check-circle"></i>
                    検証OK - コードは有効です
                    ${result.errors.length > 0 ? `<div class="test-result-warnings">${result.errors.join('<br>')}</div>` : ''}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="test-result-error">
                    <i class="fas fa-exclamation-circle"></i>
                    検証エラー
                    <div class="test-result-errors">${result.errors.join('<br>')}</div>
                </div>
            `;
        }
    }

    /**
     * テスト実行
     */
    async #handleTest() {
        const codeInput = this.#modalElement.querySelector('#tool-code');
        const testParamsInput = this.#modalElement.querySelector('#tool-test-params');
        const resultDiv = this.#modalElement.querySelector('#tool-test-result');

        const code = codeInput.value.trim();

        if (!code) {
            this.#showError('実行コードを入力してください');
            return;
        }

        // テストパラメータをパース
        let testParams = {};
        const testParamsText = testParamsInput.value.trim();
        if (testParamsText) {
            try {
                testParams = JSON.parse(testParamsText);
            } catch (error) {
                this.#showError(`テストパラメータのJSON形式が不正です: ${error.message}`);
                return;
            }
        }

        // ローディング表示
        resultDiv.innerHTML = `
            <div class="test-result-loading">
                <i class="fas fa-spinner fa-spin"></i>
                実行中...
            </div>
        `;

        // テスト実行
        const result = await CustomToolExecutor.getInstance.testExecute(code, testParams);

        if (result.success) {
            resultDiv.innerHTML = `
                <div class="test-result-success">
                    <i class="fas fa-check-circle"></i>
                    実行成功 (${result.duration}ms)
                    <pre class="test-result-output">${this.#escapeHtml(
                        typeof result.result === 'string'
                            ? result.result
                            : JSON.stringify(result.result, null, 2)
                    )}</pre>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="test-result-error">
                    <i class="fas fa-exclamation-circle"></i>
                    実行エラー (${result.duration}ms)
                    <div class="test-result-errors">${this.#escapeHtml(result.error)}</div>
                </div>
            `;
        }
    }

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * エラーメッセージを表示
     * @param {string} message
     */
    #showError(message) {
        if (window.UI?.getInstance?.Core?.Notification) {
            window.UI.getInstance.Core.Notification.show(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * 成功メッセージを表示
     * @param {string} message
     */
    #showSuccess(message) {
        if (window.UI?.getInstance?.Core?.Notification) {
            window.UI.getInstance.Core.Notification.show(message, 'success');
        }
    }

    /**
     * HTMLをエスケープ
     * @param {string} text
     * @returns {string}
     */
    #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// グローバルに公開
window.AgentToolEditor = AgentToolEditor;
