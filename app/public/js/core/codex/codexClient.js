/**
 * codexClient.js
 * サーバーの /api/codex/run（SSE）を呼び出し、Codex CLI の JSONL イベントを逐次受け取るクライアント
 */

/**
 * Codex の 1 イベント（`codex exec --json` の 1 行）
 * @typedef {Object} CodexEvent
 * @property {string} type - 'thread.started' | 'turn.started' | 'item.started' | 'item.completed' | 'turn.completed' | 'turn.failed' | 'error' など
 * @property {string} [thread_id]
 * @property {Object} [item] - item.* イベントの本体（id, type, text, command, aggregated_output, exit_code, changes など）
 * @property {Object} [usage]
 * @property {string} [message]
 * @property {Object} [error]
 */

/**
 * Codex 実行結果
 * @typedef {Object} CodexRunResult
 * @property {boolean} success
 * @property {string|null} threadId
 * @property {string} finalMessage - 最後の agent_message のテキスト
 * @property {Array<Object>} items - 完了した item の一覧
 * @property {Array<{path: string, kind: string}>} fileChanges
 * @property {Object|null} usage
 * @property {number|null} exitCode
 * @property {string} [error]
 * @property {boolean} [aborted]
 */

class CodexClient {
    static #instance = null;

    constructor() {
        if (CodexClient.#instance) {
            return CodexClient.#instance;
        }
        CodexClient.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CodexClient}
     */
    static get getInstance() {
        if (!CodexClient.#instance) {
            CodexClient.#instance = new CodexClient();
        }
        return CodexClient.#instance;
    }

    /**
     * Codex 連携が使えるか
     * @returns {boolean}
     */
    isEnabled() {
        return window.CONFIG?.CODEX?.ENABLED === true;
    }

    /**
     * Codex を実行し、イベントを逐次コールバックへ渡す
     * @param {Object} options
     * @param {string} options.prompt - Codex に渡す指示
     * @param {string|null} [options.threadId] - 継続するスレッド ID（resume）
     * @param {string|null} [options.model]
     * @param {string} [options.sandbox]
     * @param {string[]} [options.extraConfig]
     * @param {AbortSignal} [options.signal]
     * @param {(event: CodexEvent) => void} [options.onEvent] - JSONL イベント
     * @param {(line: string) => void} [options.onStderr] - Codex の stderr 行
     * @param {(jobId: string) => void} [options.onJob] - ジョブ ID 確定時
     * @param {(err: {reason: string, message: string}) => void} [options.onError] - サーバー側エラー
     * @returns {Promise<CodexRunResult>}
     * @throws {Error} サーバーに接続できない、または HTTP エラーのとき
     */
    async run(options) {
        const config = window.CONFIG?.CODEX || {};
        const {
            prompt,
            threadId = null,
            model = config.DEFAULT_MODEL || null,
            sandbox = config.DEFAULT_SANDBOX || 'workspace-write',
            extraConfig = config.EXTRA_CONFIG || [],
            signal,
            onEvent,
            onStderr,
            onJob,
            onError
        } = options;

        if (!prompt || typeof prompt !== 'string') {
            throw new Error('prompt が指定されていません');
        }

        const body = { prompt, sandbox, extraConfig };
        if (threadId) body.threadId = threadId;
        if (model) body.model = model;
        const apiKey = window.AppState?.apiSettings?.openaiApiKey;
        if (apiKey) body.apiKey = apiKey;

        console.log(`[CodexClient] 実行開始${threadId ? ` (resume ${threadId})` : ''}: "${prompt.substring(0, 60)}..."`);

        let response;
        try {
            response = await fetch(config.ENDPOINTS?.RUN || '/api/codex/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                return this.#buildResult({ aborted: true, error: '中断されました' });
            }
            console.error('[CodexClient] 接続エラー:', error);
            throw new Error(`Codex サーバーに接続できません: ${error.message}`);
        }

        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const data = await response.json();
                message = data?.error?.message || message;
            } catch { /* ignore */ }
            throw new Error(message);
        }

        const state = {
            jobId: null,
            threadId: threadId,
            items: new Map(),
            finalMessage: '',
            usage: null,
            exitCode: null,
            error: null,
            aborted: false
        };

        const handleSse = (eventName, data) => {
            switch (eventName) {
                case 'job': {
                    const parsed = this.#safeParse(data);
                    state.jobId = parsed?.jobId || null;
                    if (state.jobId && onJob) onJob(state.jobId);
                    return;
                }
                case 'stderr': {
                    const parsed = this.#safeParse(data);
                    if (parsed?.line && onStderr) onStderr(parsed.line);
                    return;
                }
                case 'raw': {
                    const parsed = this.#safeParse(data);
                    if (parsed?.line && onStderr) onStderr(parsed.line);
                    return;
                }
                case 'error': {
                    const parsed = this.#safeParse(data) || { reason: 'unknown', message: data };
                    if (!state.error) state.error = parsed.message;
                    if (onError) onError(parsed);
                    return;
                }
                case 'done': {
                    const parsed = this.#safeParse(data);
                    state.exitCode = parsed?.exitCode ?? null;
                    if (parsed?.threadId) state.threadId = parsed.threadId;
                    return;
                }
                default: {
                    const event = this.#safeParse(data);
                    if (!event) return;
                    this.#track(state, event);
                    if (onEvent) {
                        try {
                            onEvent(event);
                        } catch (err) {
                            console.warn('[CodexClient] onEvent エラー:', err);
                        }
                    }
                }
            }
        };

        try {
            await this.#readSse(response.body, handleSse);
        } catch (error) {
            if (error.name === 'AbortError' || signal?.aborted) {
                state.aborted = true;
                if (state.jobId) this.cancel(state.jobId).catch(() => {});
            } else {
                console.error('[CodexClient] ストリーム読み取りエラー:', error);
                state.error = state.error || error.message;
            }
        }

        const result = this.#buildResult(state);
        console.log(`[CodexClient] 実行終了: success=${result.success} thread=${result.threadId || '-'} files=${result.fileChanges.length}`);
        document.dispatchEvent(new CustomEvent('codex:completed', { detail: result }));
        return result;
    }

    /**
     * 実行中ジョブを停止する
     * @param {string} jobId
     * @returns {Promise<boolean>}
     */
    async cancel(jobId) {
        if (!jobId) return false;
        try {
            const response = await fetch(window.CONFIG?.CODEX?.ENDPOINTS?.CANCEL || '/api/codex/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId })
            });
            return response.ok;
        } catch (error) {
            console.warn('[CodexClient] 停止要求エラー:', error.message);
            return false;
        }
    }

    // ========================================
    // 内部処理
    // ========================================

    /**
     * SSE ストリームを読み、イベントごとにコールバックを呼ぶ
     * @param {ReadableStream} stream
     * @param {(event: string|null, data: string) => void} onMessage
     */
    async #readSse(stream, onMessage) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const dispatch = (block) => {
            let eventName = null;
            const dataLines = [];
            for (const rawLine of block.split('\n')) {
                const line = rawLine.replace(/\r$/, '');
                if (!line || line.startsWith(':')) continue;
                if (line.startsWith('event:')) {
                    eventName = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).replace(/^ /, ''));
                }
            }
            if (dataLines.length > 0) {
                onMessage(eventName, dataLines.join('\n'));
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const block = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);
                dispatch(block);
            }
        }
        if (buffer.trim()) dispatch(buffer);
    }

    /**
     * イベントから結果に必要な情報を集める
     * @param {Object} state
     * @param {CodexEvent} event
     */
    #track(state, event) {
        switch (event.type) {
            case 'thread.started':
                if (event.thread_id) state.threadId = event.thread_id;
                break;
            case 'item.started':
            case 'item.completed':
                if (event.item?.id) {
                    state.items.set(event.item.id, { ...event.item, _completed: event.type === 'item.completed' });
                    if (event.type === 'item.completed' && event.item.type === 'agent_message' && event.item.text) {
                        state.finalMessage = event.item.text;
                    }
                }
                break;
            case 'turn.completed':
                if (event.usage) state.usage = event.usage;
                break;
            case 'turn.failed':
                if (!state.error) state.error = event.error?.message || 'Codex のターンが失敗しました';
                break;
            case 'error':
                if (!state.error) state.error = event.message || 'Codex でエラーが発生しました';
                break;
            default:
                break;
        }
    }

    /**
     * 結果オブジェクトを組み立てる
     * @param {Object} state
     * @returns {CodexRunResult}
     */
    #buildResult(state) {
        const items = state.items ? Array.from(state.items.values()) : [];
        const fileChanges = [];
        for (const item of items) {
            if (item.type !== 'file_change' || !Array.isArray(item.changes)) continue;
            for (const change of item.changes) {
                if (change?.path) fileChanges.push({ path: change.path, kind: change.kind || 'update' });
            }
        }
        const success = !state.aborted && !state.error && (state.exitCode === 0 || state.exitCode === null);
        return {
            success,
            threadId: state.threadId || null,
            finalMessage: state.finalMessage || '',
            items,
            fileChanges,
            usage: state.usage || null,
            exitCode: state.exitCode ?? null,
            error: state.error || undefined,
            aborted: state.aborted || false
        };
    }

    /**
     * @param {string} text
     * @returns {Object|null}
     */
    #safeParse(text) {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }
}

window.CodexClient = CodexClient;
