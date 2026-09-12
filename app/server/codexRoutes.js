/**
 * Codex CLI 連携ルート
 *
 * - POST /api/codex/run        : `codex exec --json` を子プロセス起動し、JSONL を SSE で中継
 * - POST /api/codex/cancel     : 実行中ジョブの停止
 * - GET  /api/workspace/files  : ワークスペースのファイル一覧
 * - GET  /api/workspace/file   : ファイル内容取得（?download=1 でダウンロード）
 * - POST /api/workspace/file   : ファイル書き込み
 * - POST /api/workspace/exec   : ワークスペース内でシェルコマンド実行
 *
 * 環境変数:
 * - CODEX_WORKSPACE          作業ディレクトリ（既定: app/workspace）
 * - CODEX_BIN                codex 実行ファイル（既定: node_modules/@openai/codex/bin/codex.js）
 * - CODEX_MAX_PARALLEL       同時実行上限（既定: 3）
 * - CODEX_TIMEOUT_MS         1 ジョブのタイムアウト（既定: 600000）
 * - WORKSPACE_EXEC_ENABLED   "0" で /api/workspace/exec を無効化
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { spawn, exec } = require('child_process');

const WORKSPACE_DIR = path.resolve(process.env.CODEX_WORKSPACE || path.join(__dirname, '../workspace'));
const MAX_PARALLEL = Number(process.env.CODEX_MAX_PARALLEL) || 3;
const JOB_TIMEOUT_MS = Number(process.env.CODEX_TIMEOUT_MS) || 600000;
const EXEC_ENABLED = process.env.WORKSPACE_EXEC_ENABLED !== '0';
const PING_INTERVAL_MS = 15000;
const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'];
const FILE_LIST_LIMIT = 2000;
const FILE_PREVIEW_MAX_BYTES = 1024 * 1024;
const EXEC_DEFAULT_TIMEOUT_MS = 60000;
const EXEC_MAX_TIMEOUT_MS = 300000;
const EXEC_OUTPUT_LIMIT = 256 * 1024;
const STDERR_TAIL_BYTES = 4096;
const IGNORED_DIRS = new Set(['node_modules', '.git']);

/** @type {Map<string, {child: import('child_process').ChildProcess, threadId: string|null, startedAt: number}>} */
const codexJobs = new Map();

// ========================================
// ヘルパー
// ========================================

/**
 * ワークスペース内の相対パスを絶対パスに解決する。外に出るパスは null
 * @param {string} rel
 * @returns {string|null}
 */
function resolveWorkspacePath(rel) {
    if (typeof rel !== 'string' || rel.includes('\0')) return null;
    const abs = path.resolve(WORKSPACE_DIR, rel);
    const root = WORKSPACE_DIR + path.sep;
    const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
    if (abs === WORKSPACE_DIR) return abs;
    return norm(abs).startsWith(norm(root)) ? abs : null;
}

/**
 * codex 実行ファイルのパスを返す。未インストールなら null
 * @returns {string|null}
 */
function resolveCodexBin() {
    if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
    try {
        return require.resolve('@openai/codex/bin/codex.js');
    } catch {
        return null;
    }
}

/**
 * 子プロセスをツリーごと終了する
 * @param {import('child_process').ChildProcess} child
 */
function killTree(child) {
    if (!child || child.exitCode !== null || child.killed) return;
    if (process.platform === 'win32') {
        exec(`taskkill /pid ${child.pid} /T /F`, () => {});
    } else {
        try { child.kill('SIGTERM'); } catch { /* noop */ }
        setTimeout(() => {
            if (child.exitCode === null) {
                try { child.kill('SIGKILL'); } catch { /* noop */ }
            }
        }, 5000).unref();
    }
}

/**
 * SSE の 1 イベントを書き出す
 * @param {import('express').Response} res
 * @param {string|null} event
 * @param {string} data
 */
function sseWrite(res, event, data) {
    if (res.writableEnded) return;
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
}

/**
 * ディレクトリを再帰的に列挙する
 * @param {string} dir
 * @param {string} relBase
 * @param {Array} out
 */
async function walk(dir, relBase, out) {
    if (out.length >= FILE_LIST_LIMIT) return;
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (out.length >= FILE_LIST_LIMIT) return;
        if (IGNORED_DIRS.has(entry.name)) continue;
        const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push({ path: rel, isDir: true, size: 0, mtime: null });
            await walk(abs, rel, out);
        } else if (entry.isFile()) {
            try {
                const st = await fs.stat(abs);
                out.push({ path: rel, isDir: false, size: st.size, mtime: st.mtime.toISOString() });
            } catch { /* skip */ }
        }
    }
}

// ========================================
// ルート登録
// ========================================

/**
 * Codex / ワークスペース関連のルートを登録する
 * @param {import('express').Express} app
 */
function registerCodexRoutes(app) {
    fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch((err) => {
        console.error('[Codex] ワークスペース作成エラー:', err.message);
    });

    // ----------------------------------------
    // POST /api/codex/run
    // ----------------------------------------
    app.post('/api/codex/run', express.json({ limit: '2mb' }), (req, res) => {
        const { prompt, threadId, model, apiKey, sandbox, extraConfig } = req.body || {};

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: { message: 'prompt は必須です' } });
        }
        const sandboxMode = sandbox || 'workspace-write';
        if (!SANDBOX_MODES.includes(sandboxMode)) {
            return res.status(400).json({ error: { message: `sandbox は ${SANDBOX_MODES.join(' / ')} のいずれかです` } });
        }
        if (model && !/^[\w.\-]+$/.test(model)) {
            return res.status(400).json({ error: { message: 'model の形式が不正です' } });
        }
        if (threadId && !/^[\w\-]+$/.test(threadId)) {
            return res.status(400).json({ error: { message: 'threadId の形式が不正です' } });
        }
        const configOverrides = Array.isArray(extraConfig) ? extraConfig : [];
        if (configOverrides.some((c) => typeof c !== 'string' || !/^[\w.]+=.+$/.test(c))) {
            return res.status(400).json({ error: { message: 'extraConfig は key=value 形式の配列です' } });
        }
        if (codexJobs.size >= MAX_PARALLEL) {
            return res.status(429).json({ error: { message: `Codex の同時実行数が上限（${MAX_PARALLEL}）に達しています` } });
        }
        const codexBin = resolveCodexBin();
        if (!codexBin) {
            return res.status(503).json({ error: { message: 'Codex CLI が未インストールです。cd app && npm install を実行してください' } });
        }

        // `exec resume` は -C / --sandbox を受け付けない（セッションに保存された設定を引き継ぐ）ので、
        // 新規と継続で引数の組み立てを分ける。プロンプトは末尾の '-' で stdin から渡す
        const args = ['exec'];
        if (threadId) {
            args.push('resume', '--json', '--skip-git-repo-check', '-c', 'approval_policy=never');
            if (model) args.push('-m', model);
            for (const c of configOverrides) args.push('-c', c);
            args.push(threadId, '-');
        } else {
            args.push('--json', '--skip-git-repo-check', '-C', WORKSPACE_DIR, '--sandbox', sandboxMode, '-c', 'approval_policy=never');
            if (model) args.push('-m', model);
            for (const c of configOverrides) args.push('-c', c);
            args.push('-');
        }

        const env = { ...process.env };
        if (apiKey) env.CODEX_API_KEY = apiKey;

        const jobId = crypto.randomBytes(8).toString('hex');
        console.log(`[Codex] 開始 job=${jobId} ${threadId ? `resume=${threadId} ` : ''}sandbox=${sandboxMode}${model ? ` model=${model}` : ''}`);

        let child;
        try {
            child = spawn(process.execPath, [codexBin, ...args], {
                cwd: WORKSPACE_DIR,
                env,
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (err) {
            console.error('[Codex] 起動エラー:', err);
            return res.status(500).json({ error: { message: 'Codex の起動に失敗しました', details: err.message } });
        }

        const job = { child, threadId: threadId || null, startedAt: Date.now() };
        codexJobs.set(jobId, job);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        sseWrite(res, 'job', JSON.stringify({ jobId }));

        const ping = setInterval(() => {
            if (!res.writableEnded) res.write(': ping\n\n');
        }, PING_INTERVAL_MS);

        const timeout = setTimeout(() => {
            console.warn(`[Codex] タイムアウト job=${jobId}`);
            sseWrite(res, 'error', JSON.stringify({ reason: 'timeout', message: `Codex の実行が ${JOB_TIMEOUT_MS / 1000} 秒を超えました` }));
            killTree(child);
        }, JOB_TIMEOUT_MS);

        let stdoutBuf = '';
        let stderrBuf = '';
        let stderrTail = '';

        const handleLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            let parsed = null;
            try {
                parsed = JSON.parse(trimmed);
            } catch {
                sseWrite(res, 'raw', JSON.stringify({ line: trimmed }));
                return;
            }
            if (parsed && parsed.type === 'thread.started' && parsed.thread_id) {
                job.threadId = parsed.thread_id;
            }
            sseWrite(res, null, trimmed);
        };

        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdoutBuf += chunk;
            const lines = stdoutBuf.split('\n');
            stdoutBuf = lines.pop() || '';
            lines.forEach(handleLine);
        });

        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => {
            stderrBuf += chunk;
            const lines = stderrBuf.split('\n');
            stderrBuf = lines.pop() || '';
            for (const line of lines) {
                if (!line.trim()) continue;
                stderrTail = (stderrTail + line + '\n').slice(-STDERR_TAIL_BYTES);
                sseWrite(res, 'stderr', JSON.stringify({ line }));
            }
        });

        child.on('error', (err) => {
            console.error(`[Codex] プロセスエラー job=${jobId}:`, err.message);
            sseWrite(res, 'error', JSON.stringify({ reason: 'spawn', message: err.message }));
        });

        child.on('close', (code) => {
            clearInterval(ping);
            clearTimeout(timeout);
            if (stdoutBuf.trim()) handleLine(stdoutBuf);
            if (stderrBuf.trim()) {
                stderrTail = (stderrTail + stderrBuf).slice(-STDERR_TAIL_BYTES);
                sseWrite(res, 'stderr', JSON.stringify({ line: stderrBuf }));
            }
            if (code !== 0 && code !== null) {
                sseWrite(res, 'error', JSON.stringify({ reason: 'exit', exitCode: code, message: `Codex が終了コード ${code} で終了しました`, stderr: stderrTail }));
            }
            sseWrite(res, 'done', JSON.stringify({ exitCode: code, threadId: job.threadId }));
            codexJobs.delete(jobId);
            console.log(`[Codex] 終了 job=${jobId} code=${code} thread=${job.threadId || '-'}`);
            if (!res.writableEnded) res.end();
        });

        // req の 'close' はボディ読了時にも発火するので、切断検知は res 側で行う
        res.on('close', () => {
            if (codexJobs.has(jobId) && !res.writableFinished) {
                console.log(`[Codex] クライアント切断 job=${jobId} → 停止`);
                killTree(child);
            }
        });

        child.stdin.on('error', () => { /* 早期終了時の EPIPE を無視 */ });
        child.stdin.end(prompt);
    });

    // ----------------------------------------
    // POST /api/codex/cancel
    // ----------------------------------------
    app.post('/api/codex/cancel', express.json(), (req, res) => {
        const { jobId } = req.body || {};
        const job = jobId && codexJobs.get(jobId);
        if (!job) {
            return res.status(404).json({ error: { message: '指定されたジョブは実行中ではありません' } });
        }
        console.log(`[Codex] 停止要求 job=${jobId}`);
        killTree(job.child);
        res.json({ success: true });
    });

    // ----------------------------------------
    // GET /api/workspace/files
    // ----------------------------------------
    app.get('/api/workspace/files', async (req, res) => {
        const rel = typeof req.query.path === 'string' ? req.query.path : '';
        const abs = resolveWorkspacePath(rel);
        if (!abs) {
            return res.status(400).json({ error: { message: 'path がワークスペース外を指しています' } });
        }
        const files = [];
        await walk(abs, rel.replace(/\\/g, '/').replace(/\/+$/, ''), files);
        res.json({ root: WORKSPACE_DIR, files, truncated: files.length >= FILE_LIST_LIMIT });
    });

    // ----------------------------------------
    // GET /api/workspace/file
    // ----------------------------------------
    app.get('/api/workspace/file', async (req, res) => {
        const rel = typeof req.query.path === 'string' ? req.query.path : '';
        const abs = rel ? resolveWorkspacePath(rel) : null;
        if (!abs) {
            return res.status(400).json({ error: { message: 'path が不正です' } });
        }
        try {
            const st = await fs.stat(abs);
            if (!st.isFile()) {
                return res.status(400).json({ error: { message: 'ファイルではありません' } });
            }
            if (req.query.download === '1') {
                return res.download(abs, path.basename(abs));
            }
            const handle = await fs.open(abs, 'r');
            try {
                const head = Buffer.alloc(Math.min(8192, st.size));
                await handle.read(head, 0, head.length, 0);
                if (head.includes(0)) {
                    return res.json({ path: rel, size: st.size, binary: true, content: null });
                }
                const len = Math.min(st.size, FILE_PREVIEW_MAX_BYTES);
                const buf = Buffer.alloc(len);
                await handle.read(buf, 0, len, 0);
                res.json({ path: rel, size: st.size, binary: false, truncated: st.size > len, content: buf.toString('utf8') });
            } finally {
                await handle.close();
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: { message: 'ファイルが見つかりません' } });
            }
            console.error('[Workspace] 読み取りエラー:', err);
            res.status(500).json({ error: { message: 'ファイルの読み取りに失敗しました', details: err.message } });
        }
    });

    // ----------------------------------------
    // POST /api/workspace/file
    // ----------------------------------------
    app.post('/api/workspace/file', express.json({ limit: '10mb' }), async (req, res) => {
        const { path: rel, content } = req.body || {};
        const abs = typeof rel === 'string' && rel ? resolveWorkspacePath(rel) : null;
        if (!abs || abs === WORKSPACE_DIR) {
            return res.status(400).json({ error: { message: 'path が不正です' } });
        }
        if (typeof content !== 'string') {
            return res.status(400).json({ error: { message: 'content は文字列で指定してください' } });
        }
        try {
            await fs.mkdir(path.dirname(abs), { recursive: true });
            await fs.writeFile(abs, content, 'utf8');
            console.log(`[Workspace] 書き込み: ${rel} (${Buffer.byteLength(content)} bytes)`);
            res.json({ success: true, path: rel, size: Buffer.byteLength(content) });
        } catch (err) {
            console.error('[Workspace] 書き込みエラー:', err);
            res.status(500).json({ error: { message: 'ファイルの書き込みに失敗しました', details: err.message } });
        }
    });

    // ----------------------------------------
    // POST /api/workspace/exec
    // ----------------------------------------
    app.post('/api/workspace/exec', express.json({ limit: '1mb' }), (req, res) => {
        if (!EXEC_ENABLED) {
            return res.status(403).json({ error: { message: 'シェル実行は無効化されています（WORKSPACE_EXEC_ENABLED=0）' } });
        }
        const { command, timeoutMs } = req.body || {};
        if (!command || typeof command !== 'string') {
            return res.status(400).json({ error: { message: 'command は必須です' } });
        }
        const timeout = Math.min(Math.max(Number(timeoutMs) || EXEC_DEFAULT_TIMEOUT_MS, 1000), EXEC_MAX_TIMEOUT_MS);
        console.log(`[Workspace] exec: ${command.substring(0, 200)}`);

        const child = spawn(command, { shell: true, cwd: WORKSPACE_DIR, windowsHide: true });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const cap = (s, chunk) => (s.length >= EXEC_OUTPUT_LIMIT ? s : (s + chunk).slice(0, EXEC_OUTPUT_LIMIT));

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (c) => { stdout = cap(stdout, c); });
        child.stderr.on('data', (c) => { stderr = cap(stderr, c); });

        const timer = setTimeout(() => {
            timedOut = true;
            killTree(child);
        }, timeout);

        child.on('error', (err) => {
            clearTimeout(timer);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: err.message, stdout, stderr });
            }
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (res.headersSent) return;
            res.json({ success: code === 0 && !timedOut, exitCode: code, stdout, stderr, timedOut });
        });
    });
}

module.exports = { registerCodexRoutes, WORKSPACE_DIR, EXEC_ENABLED };
