/**
 * agentUI.js
 * エージェント実行状態の可視化コンポーネント
 */

class AgentUI {
    static #instance = null;

    /** @type {HTMLElement|null} */
    #currentContainer = null;

    /** @type {Object} */
    #phaseIcons;

    /** @type {boolean} */
    #defaultExpanded;

    /**
     * @constructor
     */
    constructor() {
        if (AgentUI.#instance) {
            return AgentUI.#instance;
        }
        AgentUI.#instance = this;

        const uiConfig = window.CONFIG?.AGENT?.UI || {};
        this.#phaseIcons = uiConfig.PHASE_ICONS || {
            observe: '🔍',
            think: '💭',
            act: '⚡',
            result: '✅',
            error: '❌'
        };
        this.#defaultExpanded = uiConfig.DEFAULT_EXPANDED !== false;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentUI}
     */
    static get getInstance() {
        if (!AgentUI.#instance) {
            AgentUI.#instance = new AgentUI();
        }
        return AgentUI.#instance;
    }

    // ========================================
    // コンテナ作成
    // ========================================

    /**
     * エージェントコンテナを作成
     * @param {HTMLElement} parentElement - 親要素
     * @returns {HTMLElement} 作成されたコンテナ
     */
    createAgentContainer(parentElement) {
        const container = document.createElement('div');
        container.className = 'agent-container';
        container.innerHTML = `
            <div class="agent-header">
                <div class="agent-header-left">
                    <span class="agent-icon">🤖</span>
                    <span class="agent-title">Agent Mode</span>
                    <span class="agent-mode-badge">${this.#getModeBadge()}</span>
                </div>
                <div class="agent-header-right">
                    <span class="agent-progress-text">準備中...</span>
                    <button class="agent-toggle-btn" title="展開/折りたたみ">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="agent-content ${this.#defaultExpanded ? '' : 'collapsed'}">
                <div class="agent-iterations"></div>
            </div>
            <div class="agent-controls">
                <div class="agent-progress-bar">
                    <div class="agent-progress-fill"></div>
                </div>
                <div class="agent-control-buttons">
                    <button class="agent-pause-btn" title="一時停止">
                        <i class="fas fa-pause"></i>
                    </button>
                    <button class="agent-stop-btn" title="停止">
                        <i class="fas fa-stop"></i>
                    </button>
                </div>
            </div>
        `;

        // イベントリスナーを設定
        this.#setupContainerEvents(container);

        parentElement.appendChild(container);
        this.#currentContainer = container;

        return container;
    }

    /**
     * モードバッジを取得
     * @returns {string}
     */
    #getModeBadge() {
        const mode = AgentOrchestrator.getInstance?.getMode() || 'react';
        return mode === 'react' ? 'ReAct' : 'FC';
    }

    /**
     * コンテナのイベントを設定
     * @param {HTMLElement} container
     */
    #setupContainerEvents(container) {
        // トグルボタン
        const toggleBtn = container.querySelector('.agent-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const content = container.querySelector('.agent-content');
                const icon = toggleBtn.querySelector('i');
                if (content.classList.contains('collapsed')) {
                    content.classList.remove('collapsed');
                    icon.className = 'fas fa-chevron-down';
                } else {
                    content.classList.add('collapsed');
                    icon.className = 'fas fa-chevron-right';
                }
            });
        }

        // 一時停止ボタン
        const pauseBtn = container.querySelector('.agent-pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                const orchestrator = AgentOrchestrator.getInstance;
                const loop = AgentLoop.getInstance;

                if (loop.isPaused()) {
                    orchestrator.resumeAgent();
                    pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    pauseBtn.title = '一時停止';
                } else {
                    orchestrator.pauseAgent();
                    pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                    pauseBtn.title = '再開';
                }
            });
        }

        // 停止ボタン
        const stopBtn = container.querySelector('.agent-stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                AgentOrchestrator.getInstance.stopAgent();
            });
        }
    }

    // ========================================
    // イテレーション表示
    // ========================================

    /**
     * イテレーションカードを作成
     * @param {number} iteration - イテレーション番号
     * @returns {HTMLElement}
     */
    createIterationCard(iteration) {
        const card = document.createElement('div');
        card.className = 'agent-iteration';
        card.dataset.iteration = iteration;
        card.innerHTML = `
            <div class="iteration-header">
                <span class="iteration-number">Iteration ${iteration}</span>
                <span class="iteration-status">実行中</span>
            </div>
            <div class="iteration-phases"></div>
        `;

        const iterationsContainer = this.#currentContainer?.querySelector('.agent-iterations');
        if (iterationsContainer) {
            iterationsContainer.appendChild(card);
        }

        return card;
    }

    /**
     * フェーズを表示
     * @param {HTMLElement} iterationCard - イテレーションカード
     * @param {string} phase - フェーズ名
     * @param {*} content - 内容
     */
    #showPhase(iterationCard, phase, content) {
        const phasesContainer = iterationCard.querySelector('.iteration-phases');
        if (!phasesContainer) return;

        const phaseElement = document.createElement('div');
        phaseElement.className = `agent-phase agent-phase-${phase}`;
        phaseElement.innerHTML = `
            <div class="phase-header">
                <span class="phase-icon">${this.#phaseIcons[phase] || '📋'}</span>
                <span class="phase-name">${this.#getPhaseName(phase)}</span>
            </div>
            <div class="phase-content">${this.#formatContent(content)}</div>
        `;

        phasesContainer.appendChild(phaseElement);

        // スクロールを最新に
        phaseElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * フェーズ名を取得
     * @param {string} phase
     * @returns {string}
     */
    #getPhaseName(phase) {
        const names = {
            observe: 'Observe',
            think: 'Think',
            act: 'Act',
            result: 'Result',
            error: 'Error'
        };
        return names[phase] || phase;
    }

    /**
     * 内容をフォーマット
     * @param {*} content
     * @returns {string}
     */
    #formatContent(content) {
        if (typeof content === 'string') {
            return this.#escapeHtml(content);
        }

        if (typeof content === 'object') {
            // 特定のプロパティを優先表示
            if (content.reasoning) {
                return `<div class="content-reasoning">${this.#escapeHtml(content.reasoning)}</div>`;
            }
            if (content.response) {
                return `<div class="content-response">${this.#escapeHtml(content.response)}</div>`;
            }
            if (content.output) {
                return `<pre class="content-output">${this.#escapeHtml(
                    typeof content.output === 'string' ? content.output : JSON.stringify(content.output, null, 2)
                )}</pre>`;
            }
            if (content.error) {
                return `<div class="content-error">${this.#escapeHtml(content.error)}</div>`;
            }

            // その他はJSON表示
            return `<pre class="content-json">${this.#escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
        }

        return String(content);
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

    // ========================================
    // リアルタイム更新
    // ========================================

    /**
     * 観察を表示
     * @param {HTMLElement} container - コンテナ
     * @param {Object} observation - 観察データ
     */
    showObservation(container, observation) {
        const { iteration } = observation;
        let iterationCard = container.querySelector(`.agent-iteration[data-iteration="${iteration}"]`);

        if (!iterationCard) {
            iterationCard = this.createIterationCard(iteration);
        }

        this.#showPhase(iterationCard, 'observe', {
            response: `イテレーション ${iteration}: 状態を観察中...`
        });

        this.#updateProgressText(container, `観察中... (${iteration})`);
    }

    /**
     * 思考を表示
     * @param {HTMLElement} container - コンテナ
     * @param {Object} thought - 思考データ
     */
    showThought(container, thought) {
        const { iteration, thought: thoughtData } = thought;
        const iterationCard = container.querySelector(`.agent-iteration[data-iteration="${iteration}"]`);

        if (iterationCard) {
            this.#showPhase(iterationCard, 'think', thoughtData);
        }

        this.#updateProgressText(container, `思考中... (${iteration})`);
    }

    /**
     * アクションを表示
     * @param {HTMLElement} container - コンテナ
     * @param {Object} actionData - アクションデータ
     */
    showAction(container, actionData) {
        const { iteration, action } = actionData;
        const iterationCard = container.querySelector(`.agent-iteration[data-iteration="${iteration}"]`);

        if (iterationCard) {
            let content;
            if (action.type === 'tool_call') {
                content = {
                    response: `ツール呼び出し: ${action.toolName}`,
                    output: action.parameters
                };
            } else if (action.type === 'complete' || action.type === 'respond') {
                content = { response: action.response || '完了' };
            } else {
                content = action;
            }

            this.#showPhase(iterationCard, 'act', content);
        }

        this.#updateProgressText(container, `実行中... (${iteration})`);
    }

    /**
     * 結果を表示
     * @param {HTMLElement} container - コンテナ
     * @param {Object} resultData - 結果データ
     */
    showResult(container, resultData) {
        const { iteration, result } = resultData;
        const iterationCard = container.querySelector(`.agent-iteration[data-iteration="${iteration}"]`);

        if (iterationCard) {
            this.#showPhase(iterationCard, 'result', result);

            // イテレーションステータスを更新
            const status = iterationCard.querySelector('.iteration-status');
            if (status) {
                if (result.success) {
                    status.textContent = '完了';
                    status.classList.add('success');
                } else {
                    status.textContent = 'エラー';
                    status.classList.add('error');
                }
            }
        }
    }

    /**
     * エラーを表示
     * @param {HTMLElement} container - コンテナ
     * @param {Object} error - エラーデータ
     */
    showError(container, error) {
        const errorElement = document.createElement('div');
        errorElement.className = 'agent-error';
        errorElement.innerHTML = `
            <span class="error-icon">${this.#phaseIcons.error}</span>
            <span class="error-message">${this.#escapeHtml(error.message || error)}</span>
        `;

        const content = container.querySelector('.agent-content');
        if (content) {
            content.appendChild(errorElement);
        }

        this.#updateProgressText(container, 'エラーが発生しました');
    }

    // ========================================
    // 進捗更新
    // ========================================

    /**
     * 進捗を更新
     * @param {HTMLElement} container - コンテナ
     * @param {number} current - 現在のイテレーション
     * @param {number} max - 最大イテレーション
     */
    updateProgress(container, current, max) {
        const progressFill = container.querySelector('.agent-progress-fill');
        if (progressFill) {
            const percentage = (current / max) * 100;
            progressFill.style.width = `${percentage}%`;
        }

        this.#updateProgressText(container, `${current}/${max}`);
    }

    /**
     * 進捗テキストを更新
     * @param {HTMLElement} container
     * @param {string} text
     */
    #updateProgressText(container, text) {
        const progressText = container.querySelector('.agent-progress-text');
        if (progressText) {
            progressText.textContent = text;
        }
    }

    // ========================================
    // 完了処理
    // ========================================

    /**
     * エージェント実行を完了
     * @param {HTMLElement} container - コンテナ
     * @param {Object} result - 最終結果
     */
    finalizeAgent(container, result) {
        // コントロールを非表示
        const controls = container.querySelector('.agent-controls');
        if (controls) {
            controls.classList.add('hidden');
        }

        // ヘッダーを更新
        const progressText = container.querySelector('.agent-progress-text');
        if (progressText) {
            if (result.success) {
                progressText.textContent = '✅ 完了';
                progressText.classList.add('success');
            } else {
                progressText.textContent = '❌ 失敗';
                progressText.classList.add('error');
            }
        }

        // 最終結果を表示
        if (result.result?.response) {
            const finalResponse = document.createElement('div');
            finalResponse.className = 'agent-final-response';
            finalResponse.innerHTML = `
                <div class="final-response-header">最終回答</div>
                <div class="final-response-content">${this.#escapeHtml(result.result.response)}</div>
            `;

            const content = container.querySelector('.agent-content');
            if (content) {
                content.appendChild(finalResponse);
            }
        }

        // サマリーを表示
        if (result.summary) {
            this.#showSummary(container, result.summary);
        }

        console.log('[AgentUI] エージェント実行完了');
    }

    /**
     * サマリーを表示
     * @param {HTMLElement} container
     * @param {Object} summary
     */
    #showSummary(container, summary) {
        const summaryElement = document.createElement('div');
        summaryElement.className = 'agent-summary';
        summaryElement.innerHTML = `
            <details class="summary-details">
                <summary>実行サマリー (${summary.totalIterations}回のイテレーション)</summary>
                <div class="summary-content">
                    <div class="summary-item">
                        <span class="summary-label">目標:</span>
                        <span class="summary-value">${this.#escapeHtml(summary.goal || '-')}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">アクション数:</span>
                        <span class="summary-value">${summary.actions?.length || 0}</span>
                    </div>
                </div>
            </details>
        `;

        const content = container.querySelector('.agent-content');
        if (content) {
            content.appendChild(summaryElement);
        }
    }

    // ========================================
    // 改善されたプログレス表示
    // ========================================

    /** @type {number|null} */
    #startTime = null;

    /** @type {Map<number, number>} */
    #iterationStartTimes = new Map();

    /** @type {string[]} */
    #usedTools = [];

    /**
     * エージェント実行開始時の初期化
     * @param {HTMLElement} container
     */
    initializeProgress(container) {
        this.#startTime = Date.now();
        this.#iterationStartTimes.clear();
        this.#usedTools = [];

        // ステップインジケーターを追加
        this.#addStepIndicator(container);

        // 経過時間表示を開始
        this.#startElapsedTimeUpdate(container);
    }

    /**
     * ステップインジケーターを追加
     * @param {HTMLElement} container
     */
    #addStepIndicator(container) {
        const header = container.querySelector('.agent-header');
        if (!header) return;

        // 既存のインジケーターがあれば削除
        const existing = header.querySelector('.agent-step-indicator');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.className = 'agent-step-indicator';
        indicator.innerHTML = `
            <div class="step-item" data-step="observe">
                <span class="step-icon">${this.#phaseIcons.observe}</span>
                <span class="step-label">Observe</span>
            </div>
            <div class="step-connector"></div>
            <div class="step-item" data-step="think">
                <span class="step-icon">${this.#phaseIcons.think}</span>
                <span class="step-label">Think</span>
            </div>
            <div class="step-connector"></div>
            <div class="step-item" data-step="act">
                <span class="step-icon">${this.#phaseIcons.act}</span>
                <span class="step-label">Act</span>
            </div>
            <div class="step-connector"></div>
            <div class="step-item" data-step="result">
                <span class="step-icon">${this.#phaseIcons.result}</span>
                <span class="step-label">Result</span>
            </div>
        `;

        // ヘッダーの左側に挿入
        const headerLeft = header.querySelector('.agent-header-left');
        if (headerLeft) {
            headerLeft.insertAdjacentElement('afterend', indicator);
        }
    }

    /**
     * ステップインジケーターを更新
     * @param {HTMLElement} container
     * @param {string} currentStep
     */
    updateStepIndicator(container, currentStep) {
        const indicator = container.querySelector('.agent-step-indicator');
        if (!indicator) return;

        const steps = ['observe', 'think', 'act', 'result'];
        const currentIndex = steps.indexOf(currentStep);

        indicator.querySelectorAll('.step-item').forEach((item, index) => {
            item.classList.remove('active', 'completed');
            if (index < currentIndex) {
                item.classList.add('completed');
            } else if (index === currentIndex) {
                item.classList.add('active');
            }
        });

        indicator.querySelectorAll('.step-connector').forEach((connector, index) => {
            connector.classList.toggle('completed', index < currentIndex);
        });
    }

    /**
     * 経過時間更新を開始
     * @param {HTMLElement} container
     */
    #startElapsedTimeUpdate(container) {
        // 経過時間表示要素を追加
        const controls = container.querySelector('.agent-controls');
        if (!controls) return;

        let elapsedDisplay = controls.querySelector('.agent-elapsed-time');
        if (!elapsedDisplay) {
            elapsedDisplay = document.createElement('div');
            elapsedDisplay.className = 'agent-elapsed-time';
            controls.insertBefore(elapsedDisplay, controls.firstChild);
        }

        // 更新タイマー
        const updateTimer = setInterval(() => {
            if (!this.#startTime || !document.body.contains(container)) {
                clearInterval(updateTimer);
                return;
            }

            const elapsed = Date.now() - this.#startTime;
            elapsedDisplay.textContent = this.#formatElapsedTime(elapsed);
        }, 100);
    }

    /**
     * 経過時間をフォーマット
     * @param {number} ms
     * @returns {string}
     */
    #formatElapsedTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
    }

    /**
     * イテレーション開始時刻を記録
     * @param {number} iteration
     */
    recordIterationStart(iteration) {
        this.#iterationStartTimes.set(iteration, Date.now());
    }

    /**
     * イテレーション終了時刻を記録し、経過時間を取得
     * @param {number} iteration
     * @returns {number} 経過時間（ミリ秒）
     */
    recordIterationEnd(iteration) {
        const startTime = this.#iterationStartTimes.get(iteration);
        if (!startTime) return 0;
        return Date.now() - startTime;
    }

    /**
     * 使用ツールを記録
     * @param {string} toolName
     */
    recordToolUsage(toolName) {
        if (!this.#usedTools.includes(toolName)) {
            this.#usedTools.push(toolName);
        }
    }

    /**
     * 使用ツール一覧を取得
     * @returns {string[]}
     */
    getUsedTools() {
        return [...this.#usedTools];
    }

    /**
     * ツール使用状況を表示
     * @param {HTMLElement} container
     */
    showToolUsageSummary(container) {
        if (this.#usedTools.length === 0) return;

        const content = container.querySelector('.agent-content');
        if (!content) return;

        const existing = content.querySelector('.agent-tools-used');
        if (existing) existing.remove();

        const toolsElement = document.createElement('div');
        toolsElement.className = 'agent-tools-used';
        toolsElement.innerHTML = `
            <div class="tools-used-header">使用ツール</div>
            <div class="tools-used-list">
                ${this.#usedTools.map(tool => `
                    <span class="tool-badge">${tool}</span>
                `).join('')}
            </div>
        `;

        content.appendChild(toolsElement);
    }

    /**
     * 詳細なイテレーション情報を表示
     * @param {HTMLElement} container
     * @param {Object} iterationData
     */
    showDetailedIteration(container, iterationData) {
        const { iteration, phase, duration, toolName, success } = iterationData;

        const iterationCard = container.querySelector(`.agent-iteration[data-iteration="${iteration}"]`);
        if (!iterationCard) return;

        // 経過時間を表示
        const header = iterationCard.querySelector('.iteration-header');
        if (header && duration) {
            let durationSpan = header.querySelector('.iteration-duration');
            if (!durationSpan) {
                durationSpan = document.createElement('span');
                durationSpan.className = 'iteration-duration';
                header.appendChild(durationSpan);
            }
            durationSpan.textContent = `${(duration / 1000).toFixed(1)}s`;
        }

        // ツール名を記録
        if (toolName) {
            this.recordToolUsage(toolName);
        }
    }

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * 現在のコンテナを取得
     * @returns {HTMLElement|null}
     */
    getCurrentContainer() {
        return this.#currentContainer;
    }

    /**
     * コンテナをクリア
     */
    clearContainer() {
        if (this.#currentContainer) {
            this.#currentContainer.remove();
            this.#currentContainer = null;
        }
        this.#startTime = null;
        this.#iterationStartTimes.clear();
        this.#usedTools = [];
    }

    /**
     * 総経過時間を取得
     * @returns {number} ミリ秒
     */
    getTotalElapsedTime() {
        if (!this.#startTime) return 0;
        return Date.now() - this.#startTime;
    }
}

// グローバルに公開
window.AgentUI = AgentUI;
