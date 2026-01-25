/**
 * agentSettingsModal.js
 * エージェント設定モーダル
 * 推論モード、ツール、プロンプトの設定を管理
 */

class AgentSettingsModal {
    static #instance = null;

    /** @type {HTMLElement|null} */
    #modalElement = null;

    /** @type {HTMLElement|null} */
    #overlayElement = null;

    /** @type {string} */
    #activeTab = 'basic';

    /** @type {Object} */
    #settings = {};

    /** @type {Object} */
    #originalSettings = {};

    /** @type {Function[]} */
    #eventListeners = [];

    /**
     * @constructor
     */
    constructor() {
        if (AgentSettingsModal.#instance) {
            return AgentSettingsModal.#instance;
        }
        AgentSettingsModal.#instance = this;
        this.#loadSettings();
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentSettingsModal}
     */
    static get getInstance() {
        if (!AgentSettingsModal.#instance) {
            AgentSettingsModal.#instance = new AgentSettingsModal();
        }
        return AgentSettingsModal.#instance;
    }

    // ========================================
    // 設定の読み込み/保存
    // ========================================

    /**
     * 設定を読み込む
     */
    #loadSettings() {
        const config = window.CONFIG?.AGENT || {};
        const stored = this.#getStoredSettings();

        this.#settings = {
            // 基本設定
            mode: stored.mode || config.DEFAULT_MODE || 'react',
            maxIterations: stored.maxIterations || config.MAX_ITERATIONS || 10,
            timeoutPerIteration: stored.timeoutPerIteration || config.TIMEOUT_PER_ITERATION || 30000,
            autoSelectTools: stored.autoSelectTools !== undefined ? stored.autoSelectTools : (config.TOOLS?.AUTO_SELECT !== false),
            maxToolsPerCall: stored.maxToolsPerCall || config.TOOLS?.MAX_TOOLS_PER_CALL || 5,

            // ツール設定
            enabledBuiltinTools: stored.enabledBuiltinTools || config.TOOLS?.BUILTIN || [],
            customToolsEnabled: stored.customToolsEnabled !== undefined ? stored.customToolsEnabled : (config.CUSTOM_TOOLS?.ENABLED !== false),

            // プロンプト設定
            reactSystemPrompt: stored.reactSystemPrompt || config.PROMPTS?.REACT_SYSTEM || '',
            fcSystemPrompt: stored.fcSystemPrompt || config.PROMPTS?.FC_SYSTEM || '',

            // 可視化設定
            showThoughtTree: stored.showThoughtTree !== undefined ? stored.showThoughtTree : (config.VISUALIZATION?.SHOW_THOUGHT_TREE !== false),
            showTimeline: stored.showTimeline !== undefined ? stored.showTimeline : (config.VISUALIZATION?.SHOW_TIMELINE !== false),
            debugMode: stored.debugMode || config.VISUALIZATION?.DEBUG_MODE || false
        };

        // オリジナル設定を保存（変更検出用）
        this.#originalSettings = JSON.parse(JSON.stringify(this.#settings));
    }

    /**
     * ストレージから設定を取得
     * @returns {Object}
     */
    #getStoredSettings() {
        try {
            const stored = localStorage.getItem('agent_settings');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('[AgentSettingsModal] 設定読み込みエラー:', error);
            return {};
        }
    }

    /**
     * 設定を保存
     */
    #saveSettings() {
        try {
            localStorage.setItem('agent_settings', JSON.stringify(this.#settings));
            this.#originalSettings = JSON.parse(JSON.stringify(this.#settings));
            console.log('[AgentSettingsModal] 設定を保存しました');
        } catch (error) {
            console.error('[AgentSettingsModal] 設定保存エラー:', error);
        }
    }

    /**
     * 設定が変更されたか確認
     * @returns {boolean}
     */
    #hasChanges() {
        return JSON.stringify(this.#settings) !== JSON.stringify(this.#originalSettings);
    }

    /**
     * 現在の設定を取得
     * @returns {Object}
     */
    getSettings() {
        return { ...this.#settings };
    }

    // ========================================
    // モーダル表示/非表示
    // ========================================

    /**
     * モーダルを表示
     */
    show() {
        if (this.#modalElement) {
            this.#modalElement.classList.add('visible');
            this.#overlayElement?.classList.add('visible');
            return;
        }

        this.#createModal();
        this.#loadSettings();
        this.#renderActiveTab();

        // 少し遅延してからvisibleクラスを追加（アニメーション用）
        requestAnimationFrame(() => {
            this.#modalElement?.classList.add('visible');
            this.#overlayElement?.classList.add('visible');

            // 初期フォーカスを設定
            const firstFocusable = this.#modalElement?.querySelector(
                'button.agent-settings-tab.active, input:not([disabled]), button:not([disabled])'
            );
            firstFocusable?.focus();
        });

        console.log('[AgentSettingsModal] モーダルを表示');
    }

    /**
     * モーダルを非表示
     * @param {boolean} [force=false] - 変更確認をスキップ
     */
    hide(force = false) {
        if (!force && this.#hasChanges()) {
            if (!confirm('変更が保存されていません。閉じてもよろしいですか？')) {
                return;
            }
        }

        this.#modalElement?.classList.remove('visible');
        this.#overlayElement?.classList.remove('visible');

        // アニメーション完了後に削除
        setTimeout(() => {
            this.#cleanup();
        }, 300);

        console.log('[AgentSettingsModal] モーダルを非表示');
    }

    /**
     * クリーンアップ
     */
    #cleanup() {
        // イベントリスナーを削除
        this.#eventListeners.forEach(({ element, event, handler }) => {
            element?.removeEventListener(event, handler);
        });
        this.#eventListeners = [];

        // DOM要素を削除
        this.#modalElement?.remove();
        this.#overlayElement?.remove();
        this.#modalElement = null;
        this.#overlayElement = null;
    }

    // ========================================
    // モーダル構築
    // ========================================

    /**
     * モーダルを作成
     */
    #createModal() {
        // オーバーレイ
        this.#overlayElement = document.createElement('div');
        this.#overlayElement.className = 'agent-settings-overlay';
        this.#addEventHandler(this.#overlayElement, 'click', () => this.hide());

        // モーダル本体
        this.#modalElement = document.createElement('div');
        this.#modalElement.className = 'agent-settings-modal';
        this.#modalElement.innerHTML = `
            <div class="agent-settings-header">
                <h2 class="agent-settings-title">
                    <span class="agent-settings-icon">🤖</span>
                    Agent Settings
                </h2>
                <button class="agent-settings-close" title="閉じる">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="agent-settings-tabs">
                <button class="agent-settings-tab active" data-tab="basic">
                    <i class="fas fa-cog"></i>
                    基本設定
                </button>
                <button class="agent-settings-tab" data-tab="tools">
                    <i class="fas fa-tools"></i>
                    ツール
                </button>
                <button class="agent-settings-tab" data-tab="prompts">
                    <i class="fas fa-comment-alt"></i>
                    プロンプト
                </button>
                <button class="agent-settings-tab" data-tab="visualization">
                    <i class="fas fa-chart-line"></i>
                    可視化
                </button>
            </div>
            <div class="agent-settings-content">
                <div class="agent-settings-tab-content" id="agent-tab-basic"></div>
                <div class="agent-settings-tab-content" id="agent-tab-tools" style="display:none"></div>
                <div class="agent-settings-tab-content" id="agent-tab-prompts" style="display:none"></div>
                <div class="agent-settings-tab-content" id="agent-tab-visualization" style="display:none"></div>
            </div>
            <div class="agent-settings-footer">
                <button class="agent-settings-btn agent-settings-btn-secondary" id="agent-settings-reset">
                    <i class="fas fa-undo"></i>
                    リセット
                </button>
                <div class="agent-settings-footer-right">
                    <button class="agent-settings-btn agent-settings-btn-secondary" id="agent-settings-cancel">
                        キャンセル
                    </button>
                    <button class="agent-settings-btn agent-settings-btn-primary" id="agent-settings-save">
                        <i class="fas fa-save"></i>
                        保存
                    </button>
                </div>
            </div>
        `;

        // イベントハンドラを設定
        this.#setupEventHandlers();

        // DOMに追加
        document.body.appendChild(this.#overlayElement);
        document.body.appendChild(this.#modalElement);
    }

    /**
     * イベントハンドラを設定
     */
    #setupEventHandlers() {
        // 閉じるボタン
        const closeBtn = this.#modalElement.querySelector('.agent-settings-close');
        this.#addEventHandler(closeBtn, 'click', () => this.hide());

        // タブ切り替え
        const tabs = this.#modalElement.querySelectorAll('.agent-settings-tab');
        tabs.forEach(tab => {
            this.#addEventHandler(tab, 'click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.#switchTab(tabName);
            });
        });

        // リセットボタン
        const resetBtn = this.#modalElement.querySelector('#agent-settings-reset');
        this.#addEventHandler(resetBtn, 'click', () => this.#resetSettings());

        // キャンセルボタン
        const cancelBtn = this.#modalElement.querySelector('#agent-settings-cancel');
        this.#addEventHandler(cancelBtn, 'click', () => this.hide());

        // 保存ボタン
        const saveBtn = this.#modalElement.querySelector('#agent-settings-save');
        this.#addEventHandler(saveBtn, 'click', () => this.#handleSave());

        // ESCキーで閉じる
        this.#addEventHandler(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.#modalElement?.classList.contains('visible')) {
                this.hide();
            }
        });

        // フォーカストラップ
        this.#setupFocusTrap();
    }

    /**
     * フォーカストラップを設定
     * モーダル内でTabキーを循環させる
     */
    #setupFocusTrap() {
        this.#addEventHandler(this.#modalElement, 'keydown', (e) => {
            if (e.key !== 'Tab') return;

            const focusable = this.#modalElement.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    /**
     * イベントハンドラを追加（クリーンアップ用に記録）
     * @param {HTMLElement} element
     * @param {string} event
     * @param {Function} handler
     */
    #addEventHandler(element, event, handler) {
        element?.addEventListener(event, handler);
        this.#eventListeners.push({ element, event, handler });
    }

    // ========================================
    // タブ切り替え
    // ========================================

    /**
     * タブを切り替え
     * @param {string} tabName
     */
    #switchTab(tabName) {
        this.#activeTab = tabName;

        // タブボタンのアクティブ状態を更新
        this.#modalElement.querySelectorAll('.agent-settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // タブコンテンツの表示を切り替え
        this.#modalElement.querySelectorAll('.agent-settings-tab-content').forEach(content => {
            content.style.display = 'none';
        });

        const activeContent = this.#modalElement.querySelector(`#agent-tab-${tabName}`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        this.#renderActiveTab();
    }

    /**
     * アクティブタブをレンダリング
     */
    async #renderActiveTab() {
        switch (this.#activeTab) {
            case 'basic':
                this.#renderBasicTab();
                break;
            case 'tools':
                await this.#renderToolsTab();
                break;
            case 'prompts':
                this.#renderPromptsTab();
                break;
            case 'visualization':
                this.#renderVisualizationTab();
                break;
        }
    }

    // ========================================
    // 基本設定タブ
    // ========================================

    /**
     * 基本設定タブをレンダリング
     */
    #renderBasicTab() {
        const container = this.#modalElement.querySelector('#agent-tab-basic');
        if (!container) return;

        container.innerHTML = `
            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">推論モード</h3>
                <div class="agent-settings-radio-group">
                    <label class="agent-settings-radio">
                        <input type="radio" name="agent-mode" value="react"
                            ${this.#settings.mode === 'react' ? 'checked' : ''}>
                        <span class="agent-settings-radio-mark"></span>
                        <span class="agent-settings-radio-label">
                            <strong>ReAct</strong>
                            <small>Observe → Think → Act → Result サイクルで推論</small>
                        </span>
                    </label>
                    <label class="agent-settings-radio">
                        <input type="radio" name="agent-mode" value="function_calling"
                            ${this.#settings.mode === 'function_calling' ? 'checked' : ''}>
                        <span class="agent-settings-radio-mark"></span>
                        <span class="agent-settings-radio-label">
                            <strong>Function Calling</strong>
                            <small>AIがツールを直接呼び出し（OpenAI/Claude対応）</small>
                        </span>
                    </label>
                </div>
            </div>

            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">実行制限</h3>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-label">
                        最大イテレーション数
                        <span class="agent-settings-hint">無限ループ防止のため</span>
                    </label>
                    <input type="number" class="agent-settings-input" id="agent-max-iterations"
                        value="${this.#settings.maxIterations}" min="1" max="50">
                </div>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-label">
                        イテレーションごとのタイムアウト（秒）
                    </label>
                    <input type="number" class="agent-settings-input" id="agent-timeout"
                        value="${this.#settings.timeoutPerIteration / 1000}" min="5" max="300">
                </div>
            </div>

            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">ツール選択</h3>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-checkbox">
                        <input type="checkbox" id="agent-auto-select-tools"
                            ${this.#settings.autoSelectTools ? 'checked' : ''}>
                        <span class="agent-settings-checkbox-mark"></span>
                        <span class="agent-settings-checkbox-label">
                            タスクに応じてツールを自動選択
                        </span>
                    </label>
                </div>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-label">
                        1回の呼び出しで使用する最大ツール数
                    </label>
                    <input type="number" class="agent-settings-input" id="agent-max-tools"
                        value="${this.#settings.maxToolsPerCall}" min="1" max="20">
                </div>
            </div>
        `;

        // イベントハンドラ
        container.querySelectorAll('input[name="agent-mode"]').forEach(input => {
            this.#addEventHandler(input, 'change', (e) => {
                this.#settings.mode = e.target.value;
            });
        });

        const maxIterInput = container.querySelector('#agent-max-iterations');
        this.#addEventHandler(maxIterInput, 'change', (e) => {
            this.#settings.maxIterations = parseInt(e.target.value) || 10;
        });

        const timeoutInput = container.querySelector('#agent-timeout');
        this.#addEventHandler(timeoutInput, 'change', (e) => {
            this.#settings.timeoutPerIteration = (parseInt(e.target.value) || 30) * 1000;
        });

        const autoSelectInput = container.querySelector('#agent-auto-select-tools');
        this.#addEventHandler(autoSelectInput, 'change', (e) => {
            this.#settings.autoSelectTools = e.target.checked;
        });

        const maxToolsInput = container.querySelector('#agent-max-tools');
        this.#addEventHandler(maxToolsInput, 'change', (e) => {
            this.#settings.maxToolsPerCall = parseInt(e.target.value) || 5;
        });
    }

    // ========================================
    // ツール設定タブ
    // ========================================

    /**
     * ツール設定タブをレンダリング
     */
    async #renderToolsTab() {
        const container = this.#modalElement.querySelector('#agent-tab-tools');
        if (!container) return;

        // ビルトインツール一覧を取得
        const toolManager = window.AgentToolManager?.getInstance;

        // ツールマネージャーが初期化されていない場合は初期化
        if (toolManager) {
            await toolManager.initialize();
        }

        const allTools = toolManager?.getAllTools() || [];

        container.innerHTML = `
            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">ビルトインツール</h3>
                <p class="agent-settings-description">
                    エージェントが使用できるツールを選択してください
                </p>
                <div class="agent-settings-tool-list" id="agent-builtin-tools">
                    ${allTools.map(tool => `
                        <label class="agent-settings-tool-item">
                            <input type="checkbox" value="${tool.name}"
                                ${this.#settings.enabledBuiltinTools.includes(tool.name) ? 'checked' : ''}>
                            <span class="agent-settings-tool-info">
                                <span class="agent-settings-tool-name">${tool.name}</span>
                                <span class="agent-settings-tool-desc">${tool.description || ''}</span>
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">カスタムツール</h3>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-checkbox">
                        <input type="checkbox" id="agent-custom-tools-enabled"
                            ${this.#settings.customToolsEnabled ? 'checked' : ''}>
                        <span class="agent-settings-checkbox-mark"></span>
                        <span class="agent-settings-checkbox-label">
                            カスタムツールを有効にする
                        </span>
                    </label>
                </div>
                <div class="agent-settings-tool-actions">
                    <button class="agent-settings-btn agent-settings-btn-secondary" id="agent-manage-custom-tools">
                        <i class="fas fa-wrench"></i>
                        カスタムツールを管理
                    </button>
                </div>
            </div>
        `;

        // イベントハンドラ
        const toolCheckboxes = container.querySelectorAll('#agent-builtin-tools input[type="checkbox"]');
        toolCheckboxes.forEach(checkbox => {
            this.#addEventHandler(checkbox, 'change', () => {
                this.#settings.enabledBuiltinTools = Array.from(toolCheckboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);
            });
        });

        const customToolsEnabledInput = container.querySelector('#agent-custom-tools-enabled');
        this.#addEventHandler(customToolsEnabledInput, 'change', (e) => {
            this.#settings.customToolsEnabled = e.target.checked;
        });

        const manageBtn = container.querySelector('#agent-manage-custom-tools');
        this.#addEventHandler(manageBtn, 'click', () => {
            // カスタムツール管理モーダルを開く（後で実装）
            if (window.AgentToolEditor?.getInstance) {
                window.AgentToolEditor.getInstance.show();
            } else {
                alert('カスタムツール管理機能は準備中です');
            }
        });
    }

    // ========================================
    // プロンプト設定タブ
    // ========================================

    /**
     * プロンプト設定タブをレンダリング
     */
    #renderPromptsTab() {
        const container = this.#modalElement.querySelector('#agent-tab-prompts');
        if (!container) return;

        container.innerHTML = `
            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">ReActモード システムプロンプト</h3>
                <p class="agent-settings-description">
                    ReActモードで使用するシステムプロンプト。
                    <code>{{tools}}</code> はツール一覧に、<code>{{max_iterations}}</code> は最大イテレーション数に置換されます。
                </p>
                <textarea class="agent-settings-textarea" id="agent-react-prompt"
                    rows="10" placeholder="ReActシステムプロンプト...">${this.#escapeHtml(this.#settings.reactSystemPrompt)}</textarea>
            </div>

            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">Function Callingモード システムプロンプト</h3>
                <p class="agent-settings-description">
                    Function Callingモードで使用するシステムプロンプト。
                    <code>{{tools}}</code> はツール一覧に置換されます。
                </p>
                <textarea class="agent-settings-textarea" id="agent-fc-prompt"
                    rows="10" placeholder="FCシステムプロンプト...">${this.#escapeHtml(this.#settings.fcSystemPrompt)}</textarea>
            </div>

            <div class="agent-settings-prompt-actions">
                <button class="agent-settings-btn agent-settings-btn-secondary" id="agent-reset-prompts">
                    <i class="fas fa-undo"></i>
                    デフォルトに戻す
                </button>
            </div>
        `;

        // イベントハンドラ
        const reactPromptInput = container.querySelector('#agent-react-prompt');
        this.#addEventHandler(reactPromptInput, 'input', (e) => {
            this.#settings.reactSystemPrompt = e.target.value;
        });

        const fcPromptInput = container.querySelector('#agent-fc-prompt');
        this.#addEventHandler(fcPromptInput, 'input', (e) => {
            this.#settings.fcSystemPrompt = e.target.value;
        });

        const resetBtn = container.querySelector('#agent-reset-prompts');
        this.#addEventHandler(resetBtn, 'click', () => {
            const config = window.CONFIG?.AGENT?.PROMPTS || {};
            this.#settings.reactSystemPrompt = config.REACT_SYSTEM || '';
            this.#settings.fcSystemPrompt = config.FC_SYSTEM || '';
            this.#renderPromptsTab();
        });
    }

    // ========================================
    // 可視化設定タブ
    // ========================================

    /**
     * 可視化設定タブをレンダリング
     */
    #renderVisualizationTab() {
        const container = this.#modalElement.querySelector('#agent-tab-visualization');
        if (!container) return;

        container.innerHTML = `
            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">表示オプション</h3>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-checkbox">
                        <input type="checkbox" id="agent-show-thought-tree"
                            ${this.#settings.showThoughtTree ? 'checked' : ''}>
                        <span class="agent-settings-checkbox-mark"></span>
                        <span class="agent-settings-checkbox-label">
                            <strong>思考ツリーを表示</strong>
                            <small>推論過程を階層的に表示</small>
                        </span>
                    </label>
                </div>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-checkbox">
                        <input type="checkbox" id="agent-show-timeline"
                            ${this.#settings.showTimeline ? 'checked' : ''}>
                        <span class="agent-settings-checkbox-mark"></span>
                        <span class="agent-settings-checkbox-label">
                            <strong>タイムラインを表示</strong>
                            <small>各フェーズの所要時間をグラフ化</small>
                        </span>
                    </label>
                </div>
            </div>

            <div class="agent-settings-section">
                <h3 class="agent-settings-section-title">デバッグ</h3>
                <div class="agent-settings-form-group">
                    <label class="agent-settings-checkbox">
                        <input type="checkbox" id="agent-debug-mode"
                            ${this.#settings.debugMode ? 'checked' : ''}>
                        <span class="agent-settings-checkbox-mark"></span>
                        <span class="agent-settings-checkbox-label">
                            <strong>デバッグモード</strong>
                            <small>詳細なログと内部状態を表示</small>
                        </span>
                    </label>
                </div>
            </div>
        `;

        // イベントハンドラ
        const thoughtTreeInput = container.querySelector('#agent-show-thought-tree');
        this.#addEventHandler(thoughtTreeInput, 'change', (e) => {
            this.#settings.showThoughtTree = e.target.checked;
        });

        const timelineInput = container.querySelector('#agent-show-timeline');
        this.#addEventHandler(timelineInput, 'change', (e) => {
            this.#settings.showTimeline = e.target.checked;
        });

        const debugInput = container.querySelector('#agent-debug-mode');
        this.#addEventHandler(debugInput, 'change', (e) => {
            this.#settings.debugMode = e.target.checked;
        });
    }

    // ========================================
    // アクション
    // ========================================

    /**
     * 設定をリセット
     */
    #resetSettings() {
        if (!confirm('設定をデフォルトに戻しますか？')) {
            return;
        }

        localStorage.removeItem('agent_settings');
        this.#loadSettings();
        this.#renderActiveTab();
        console.log('[AgentSettingsModal] 設定をリセットしました');
    }

    /**
     * 保存処理
     */
    #handleSave() {
        this.#saveSettings();
        this.#applySettings();
        window.UI?.getInstance?.Core?.Notification?.show('設定を保存しました', 'success');
        this.hide(true);
    }

    /**
     * 設定を適用
     */
    #applySettings() {
        // AgentOrchestratorに設定を反映
        const orchestrator = window.AgentOrchestrator?.getInstance;
        if (orchestrator) {
            orchestrator.setMode(this.#settings.mode);
            orchestrator.setMaxIterations(this.#settings.maxIterations);
            orchestrator.setTimeoutPerIteration(this.#settings.timeoutPerIteration);
        }

        // AgentToolManagerに有効ツールを反映
        const toolManager = window.AgentToolManager?.getInstance;
        if (toolManager) {
            toolManager.setEnabledTools?.(this.#settings.enabledBuiltinTools);
        }

        console.log('[AgentSettingsModal] 設定を適用しました');
    }

    // ========================================
    // ユーティリティ
    // ========================================

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
window.AgentSettingsModal = AgentSettingsModal;
