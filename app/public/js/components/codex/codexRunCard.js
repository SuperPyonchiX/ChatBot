/**
 * codexRunCard.js
 * チャット内に Codex 実行の進捗（reasoning / command / file_change / message）を逐次描画するカード
 */

/**
 * 履歴復元用の要約データ
 * @typedef {Object} CodexSummaryData
 * @property {string|null} threadId
 * @property {Array<{type: string, title: string, status?: string}>} items
 * @property {Array<{path: string, kind: string}>} fileChanges
 * @property {Object|null} usage
 * @property {boolean} [success]
 * @property {string} [error]
 */

class CodexRunCard {
    static #instance = null;

    constructor() {
        if (CodexRunCard.#instance) {
            return CodexRunCard.#instance;
        }
        CodexRunCard.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CodexRunCard}
     */
    static get getInstance() {
        if (!CodexRunCard.#instance) {
            CodexRunCard.#instance = new CodexRunCard();
        }
        return CodexRunCard.#instance;
    }

    /**
     * 実行中カードを作成して親要素に追加する
     * @param {HTMLElement} parentElement
     * @param {Object} [options]
     * @param {string} [options.title='Codex']
     * @param {() => void} [options.onStop] - 停止ボタン押下時
     * @param {boolean} [options.collapsed=false]
     * @returns {HTMLElement} カード要素
     */
    create(parentElement, options = {}) {
        const { title = 'Codex', onStop, collapsed = false } = options;
        const card = document.createElement('div');
        card.className = 'codex-run-container';
        card.innerHTML = `
            <div class="codex-header">
                <div class="codex-header-left">
                    <span class="codex-icon">🧑‍💻</span>
                    <span class="codex-title"></span>
                    <span class="codex-thread-badge" title="thread id"></span>
                </div>
                <div class="codex-header-right">
                    <span class="codex-status">起動中...</span>
                    <button class="codex-stop-btn" title="停止"><i class="fas fa-stop"></i></button>
                    <button class="codex-toggle-btn" title="展開/折りたたみ">
                        <i class="fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
                    </button>
                </div>
            </div>
            <div class="codex-content ${collapsed ? 'collapsed' : ''}">
                <div class="codex-items"></div>
                <details class="codex-stderr" hidden>
                    <summary>ログ (stderr)</summary>
                    <pre class="codex-stderr-body"></pre>
                </details>
            </div>
            <div class="codex-footer" hidden></div>
        `;
        card.querySelector('.codex-title').textContent = title;

        card.querySelector('.codex-toggle-btn').addEventListener('click', () => {
            const content = card.querySelector('.codex-content');
            const icon = card.querySelector('.codex-toggle-btn i');
            content.classList.toggle('collapsed');
            icon.className = content.classList.contains('collapsed') ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
        });

        const stopBtn = card.querySelector('.codex-stop-btn');
        if (onStop) {
            stopBtn.addEventListener('click', () => {
                stopBtn.disabled = true;
                this.setStatus(card, '停止中...', 'stopping');
                onStop();
            });
        } else {
            stopBtn.hidden = true;
        }

        parentElement.appendChild(card);
        this.#scrollIntoView(card);
        return card;
    }

    /**
     * Codex イベントをカードに反映する
     * @param {HTMLElement} card
     * @param {Object} event - CodexClient の onEvent に渡されるイベント
     */
    appendEvent(card, event) {
        if (!card || !event) return;
        switch (event.type) {
            case 'thread.started':
                this.#setThread(card, event.thread_id);
                this.setStatus(card, '実行中', 'running');
                break;
            case 'turn.started':
                this.setStatus(card, '実行中', 'running');
                break;
            case 'item.started':
            case 'item.completed':
                this.#renderItem(card, event.item, event.type === 'item.completed');
                break;
            case 'turn.completed':
                if (event.usage) this.#renderUsage(card, event.usage);
                break;
            case 'turn.failed':
                this.showError(card, event.error?.message || 'ターンが失敗しました');
                break;
            case 'error':
                this.showError(card, event.message || 'エラーが発生しました');
                break;
            default:
                break;
        }
    }

    /**
     * stderr の行を追記する
     * @param {HTMLElement} card
     * @param {string} line
     */
    appendStderr(card, line) {
        const details = card?.querySelector('.codex-stderr');
        const body = card?.querySelector('.codex-stderr-body');
        if (!details || !body) return;
        details.hidden = false;
        const maxLines = window.CONFIG?.CODEX?.UI?.MAX_OUTPUT_LINES || 200;
        const lines = body.textContent ? body.textContent.split('\n') : [];
        lines.push(line);
        body.textContent = lines.slice(-maxLines).join('\n');
    }

    /**
     * エラーを表示する
     * @param {HTMLElement} card
     * @param {string} message
     */
    showError(card, message) {
        const items = card?.querySelector('.codex-items');
        if (!items) return;
        // 同じ文言のエラーは 1 回だけ表示（error / turn.failed / exit の重複を防ぐ）
        const existing = [...items.querySelectorAll('.codex-item-error .codex-item-body')];
        if (existing.some((e) => e.textContent === message)) {
            this.setStatus(card, 'エラー', 'error');
            return;
        }
        const el = document.createElement('div');
        el.className = 'codex-item codex-item-error';
        el.innerHTML = `<span class="codex-item-icon">${this.#icon('error')}</span><span class="codex-item-body"></span>`;
        el.querySelector('.codex-item-body').textContent = message;
        items.appendChild(el);
        this.setStatus(card, 'エラー', 'error');
    }

    /**
     * 実行完了状態にする
     * @param {HTMLElement} card
     * @param {Object} result - CodexClient.run の戻り値
     */
    finalize(card, result) {
        if (!card) return;
        const stopBtn = card.querySelector('.codex-stop-btn');
        if (stopBtn) stopBtn.hidden = true;
        if (result?.threadId) this.#setThread(card, result.threadId);
        if (result?.usage) this.#renderUsage(card, result.usage);

        if (result?.aborted) {
            this.setStatus(card, '中断', 'aborted');
        } else if (result?.success) {
            this.setStatus(card, '完了', 'done');
        } else {
            this.setStatus(card, 'エラー', 'error');
            if (result?.error && !card.querySelector('.codex-item-error')) {
                this.showError(card, result.error);
            }
        }

        if (result?.fileChanges?.length > 0) {
            this.#renderWorkspaceLink(card, result.fileChanges.length);
        }
    }

    /**
     * 履歴から要約カードを復元する
     * @param {HTMLElement} parentElement
     * @param {CodexSummaryData} data
     * @returns {HTMLElement}
     */
    createFromSummary(parentElement, data) {
        const collapsed = window.CONFIG?.CODEX?.UI?.RESTORED_COLLAPSED !== false;
        const card = this.create(parentElement, { collapsed });
        if (data?.threadId) this.#setThread(card, data.threadId);
        const items = card.querySelector('.codex-items');
        for (const item of data?.items || []) {
            const el = document.createElement('div');
            el.className = `codex-item codex-item-${item.type}`;
            el.innerHTML = `<span class="codex-item-icon">${this.#icon(item.type)}</span><span class="codex-item-body"></span>`;
            el.querySelector('.codex-item-body').textContent = item.title || item.type;
            items.appendChild(el);
        }
        if (data?.fileChanges?.length > 0) this.#renderWorkspaceLink(card, data.fileChanges.length);
        if (data?.usage) this.#renderUsage(card, data.usage);
        this.setStatus(card, data?.success === false ? 'エラー' : '完了', data?.success === false ? 'error' : 'done');
        return card;
    }

    /**
     * 実行結果を履歴保存用の要約に変換する
     * @param {Object} result - CodexClient.run の戻り値
     * @returns {CodexSummaryData}
     */
    summarize(result) {
        const items = (result?.items || []).map((item) => ({
            type: item.type,
            title: this.#itemTitle(item),
            status: item.status || (item._completed ? 'completed' : 'started')
        }));
        return {
            threadId: result?.threadId || null,
            items,
            fileChanges: result?.fileChanges || [],
            usage: result?.usage || null,
            success: result?.success !== false,
            error: result?.error
        };
    }

    /**
     * 状態表示を更新する
     * @param {HTMLElement} card
     * @param {string} text
     * @param {string} state - 'running' | 'done' | 'error' | 'aborted' | 'stopping'
     */
    setStatus(card, text, state) {
        const status = card?.querySelector('.codex-status');
        if (!status) return;
        status.textContent = text;
        status.dataset.state = state;
        card.dataset.state = state;
    }

    // ========================================
    // 内部処理
    // ========================================

    /**
     * item を描画（既存 id があれば更新）
     * @param {HTMLElement} card
     * @param {Object} item
     * @param {boolean} completed
     */
    #renderItem(card, item, completed) {
        if (!item) return;
        const items = card.querySelector('.codex-items');
        const id = item.id || `item_${items.children.length}`;
        let el = items.querySelector(`[data-item-id="${CSS.escape(id)}"]`);
        if (!el) {
            el = document.createElement('div');
            el.dataset.itemId = id;
            items.appendChild(el);
        }
        el.className = `codex-item codex-item-${item.type} ${completed ? 'completed' : 'in-progress'}`;

        switch (item.type) {
            case 'reasoning':
                el.innerHTML = `<details class="codex-reasoning"><summary>${this.#icon('reasoning')} 思考</summary><div class="codex-reasoning-body"></div></details>`;
                el.querySelector('.codex-reasoning-body').textContent = item.text || '';
                break;
            case 'command_execution': {
                const exit = completed && item.exit_code !== undefined ? ` <span class="codex-exit-code ${item.exit_code === 0 ? 'ok' : 'ng'}">exit ${item.exit_code}</span>` : '';
                el.innerHTML = `<div class="codex-command-line"><span class="codex-item-icon">${this.#icon('command_execution')}</span><code class="codex-command"></code>${exit}</div><pre class="codex-command-output" hidden></pre>`;
                el.querySelector('.codex-command').textContent = item.command || '';
                const output = (item.aggregated_output || '').trim();
                if (output) {
                    const pre = el.querySelector('.codex-command-output');
                    pre.hidden = false;
                    pre.textContent = this.#truncateLines(output);
                }
                break;
            }
            case 'file_change': {
                const changes = Array.isArray(item.changes) ? item.changes : [];
                el.innerHTML = `<div class="codex-item-line"><span class="codex-item-icon">${this.#icon('file_change')}</span><span>ファイル変更 (${changes.length})</span></div><ul class="codex-file-list"></ul>`;
                const list = el.querySelector('.codex-file-list');
                for (const change of changes) {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="codex-file-kind"></span> <span class="codex-file-path"></span>`;
                    li.querySelector('.codex-file-kind').textContent = change.kind || 'update';
                    li.querySelector('.codex-file-path').textContent = change.path || '';
                    list.appendChild(li);
                }
                break;
            }
            case 'agent_message':
                el.innerHTML = `<div class="codex-item-line"><span class="codex-item-icon">${this.#icon('agent_message')}</span><div class="codex-message-body markdown-content"></div></div>`;
                this.#renderMarkdown(el.querySelector('.codex-message-body'), item.text || '');
                break;
            case 'mcp_tool_call':
                el.innerHTML = `<div class="codex-item-line"><span class="codex-item-icon">${this.#icon('mcp_tool_call')}</span><code></code></div>`;
                el.querySelector('code').textContent = `${item.server || ''}.${item.tool || ''}`.replace(/^\./, '');
                break;
            default:
                el.innerHTML = `<div class="codex-item-line"><span class="codex-item-icon">•</span><code></code></div>`;
                el.querySelector('code').textContent = JSON.stringify(item).substring(0, 300);
                break;
        }
        this.#scrollIntoView(card);
    }

    /**
     * @param {HTMLElement} target
     * @param {string} text
     */
    async #renderMarkdown(target, text) {
        try {
            if (window.Markdown?.getInstance?.renderMarkdown) {
                target.innerHTML = await Markdown.getInstance.renderMarkdown(text);
                return;
            }
        } catch (error) {
            console.warn('[CodexRunCard] Markdown 描画エラー:', error);
        }
        target.textContent = text;
    }

    /**
     * @param {HTMLElement} card
     * @param {Object} usage
     */
    #renderUsage(card, usage) {
        const footer = card.querySelector('.codex-footer');
        if (!footer) return;
        const inTok = usage.input_tokens ?? usage.inputTokens ?? 0;
        const outTok = usage.output_tokens ?? usage.outputTokens ?? 0;
        const cached = usage.cached_input_tokens ?? usage.cachedInputTokens;
        footer.hidden = false;
        let usageEl = footer.querySelector('.codex-usage');
        if (!usageEl) {
            usageEl = document.createElement('span');
            usageEl.className = 'codex-usage';
            footer.appendChild(usageEl);
        }
        usageEl.textContent = `tokens: in ${inTok}${cached ? ` (cached ${cached})` : ''} / out ${outTok}`;
    }

    /**
     * @param {HTMLElement} card
     * @param {number} count
     */
    #renderWorkspaceLink(card, count) {
        const footer = card.querySelector('.codex-footer');
        if (!footer || footer.querySelector('.codex-workspace-link')) return;
        footer.hidden = false;
        const btn = document.createElement('button');
        btn.className = 'codex-workspace-link';
        btn.innerHTML = `<i class="fas fa-folder-open"></i> ワークスペースを開く (${count} ファイル)`;
        btn.addEventListener('click', () => {
            if (window.WorkspaceModal) WorkspaceModal.getInstance.show();
        });
        footer.appendChild(btn);
    }

    /**
     * @param {HTMLElement} card
     * @param {string} threadId
     */
    #setThread(card, threadId) {
        const badge = card.querySelector('.codex-thread-badge');
        if (!badge || !threadId) return;
        badge.textContent = threadId.substring(0, 8);
        badge.title = threadId;
    }

    /**
     * @param {Object} item
     * @returns {string}
     */
    #itemTitle(item) {
        switch (item.type) {
            case 'command_execution':
                return `$ ${(item.command || '').substring(0, 120)}`;
            case 'file_change':
                return (item.changes || []).map((c) => `${c.kind || 'update'} ${c.path}`).join(', ').substring(0, 200);
            case 'agent_message':
                return (item.text || '').substring(0, 120);
            case 'reasoning':
                return (item.text || '').substring(0, 120);
            case 'mcp_tool_call':
                return `${item.server || ''}.${item.tool || ''}`;
            default:
                return item.type;
        }
    }

    /**
     * @param {string} type
     * @returns {string}
     */
    #icon(type) {
        return window.CONFIG?.CODEX?.UI?.ITEM_ICONS?.[type] || '•';
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    #truncateLines(text) {
        const maxLines = window.CONFIG?.CODEX?.UI?.MAX_OUTPUT_LINES || 200;
        const lines = text.split('\n');
        if (lines.length <= maxLines) return text;
        return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} 行省略)`;
    }

    /**
     * @param {HTMLElement} card
     */
    #scrollIntoView(card) {
        const chat = card.closest('.chat-messages');
        if (chat) chat.scrollTop = chat.scrollHeight;
    }
}

window.CodexRunCard = CodexRunCard;
