const express = require('express');
const limits = require('../public/js/core/enterpriseConfig');

/** Escape a literal in JQL/CQL, never concatenate raw user search syntax. */
function literal(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('検索語を入力してください');
    return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ') + '"';
}

function baseUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('ベースURLを確認してください');
    }
    return url.href.replace(/\/$/, '');
}

/** Construct only supported read endpoints, including installations under a context path. */
function requestPath(service, operation, params = {}) {
    const query = new URLSearchParams();
    if (operation === 'test') return service === 'jira' ? '/rest/api/2/myself' : '/rest/api/space?limit=1';
    if (operation === 'search') {
        const field = service === 'jira' ? 'jql' : 'cql';
        let expression = service === 'jira' && params.jql ? String(params.jql) : `text ~ ${literal(params.query)}`;
        if (params.scope) expression += ` AND ${service === 'jira' ? 'project' : 'space'} = ${literal(params.scope)}`;
        if (service === 'confluence') expression += ' AND type = page';
        query.set(field, expression);
        query.set(service === 'jira' ? 'maxResults' : 'limit', String(limits.SEARCH_LIMIT));
        if (params.start !== undefined && (!Number.isSafeInteger(params.start) || params.start < 0)) throw new Error('検索開始位置が不正です');
        query.set(service === 'jira' ? 'startAt' : 'start', String(params.start || 0));
        if (service === 'jira') query.set('fields', 'summary,status,updated');
        return (service === 'jira' ? '/rest/api/2/search?' : '/rest/api/content/search?') + query;
    }
    if (!['get', 'comments', 'commentCount'].includes(operation)) throw new Error('非対応の操作です');
    const id = String(params.id || '');
    if (!(service === 'jira' ? /^[A-Za-z][A-Za-z0-9_]*-\d+$/ : /^\d+$/).test(id)) throw new Error('課題キーまたはページIDが不正です');
    const resource = service === 'jira' ? `/rest/api/2/issue/${encodeURIComponent(id)}` : `/rest/api/content/${id}`;
    if (operation === 'get') return resource + (service === 'jira'
        ? '?fields=summary,description,status,assignee,updated,parent,subtasks,issuelinks'
        : '?expand=body.storage,version');
    if (service === 'jira') {
        const start = Number.isSafeInteger(params.start) && params.start >= 0 ? params.start : 0;
        return `${resource}/comment?startAt=${start}&maxResults=${operation === 'commentCount' ? 1 : limits.COMMENT_LIMIT}`;
    }
    const start = Number.isSafeInteger(params.start) && params.start >= 0 ? params.start : 0;
    return `${resource}/child/comment?expand=body.storage,version,history&limit=${limits.COMMENT_PAGE_SIZE}&depth=all&start=${start}`;
}

/** Bounded JSON decoding; upstream HTML/error bodies never reach logs or the model. */
async function readJson(response) {
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('APIからJSONが返りませんでした。ログイン方式・API接続を確認してください');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > limits.RESPONSE_LIMIT) throw new Error('取得データが上限を超えました');
            chunks.push(Buffer.from(value));
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); }
}

function registerEnterpriseRoutes(app, fetchImpl = fetch) {
    app.post(limits.ENDPOINT, express.json({ limit: '64kb' }), async (req, res) => {
        const { service, operation, connection, params } = req.body || {};
        let target, authorization;
        try {
            if (!['jira', 'confluence'].includes(service)) throw new Error('非対応の接続先です');
            target = baseUrl(connection?.baseUrl) + requestPath(service, operation, params);
            if (!['basic', 'pat'].includes(connection?.authType) || typeof connection.authData !== 'string' || !connection.authData || /[\r\n]/.test(connection.authData)) throw new Error('認証設定を確認してください');
            authorization = `${connection.authType === 'pat' ? 'Bearer' : 'Basic'} ${connection.authData}`;
        } catch (error) { return res.status(400).json({ success: false, error: '接続設定・検索語・課題キーまたはページIDを確認してください' }); }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), limits.TIMEOUT_MS);
        try {
            const response = await fetchImpl(target, { method: 'GET', redirect: 'manual', signal: controller.signal,
                headers: { Authorization: authorization, Accept: 'application/json' } });
            if (!response.ok) {
                await response.body?.cancel();
                const message = { 401: '認証に失敗しました', 403: 'アクセス権限がありません', 404: '対象またはAPIが見つかりません', 429: 'アクセスが制限されています。時間をおいて再試行してください' }[response.status];
                return res.status(response.status >= 300 && response.status < 400 ? 502 : response.status)
                    .json({ success: false, error: message || (response.status < 400 ? 'リダイレクトを拒否しました。接続先と認証方式を確認してください' : `APIエラー: HTTP ${response.status}`) });
            }
            return res.json({ success: true, data: await readJson(response) });
        } catch (error) {
            console.error('[Enterprise] 読み取りエラー:', error.name);
            const code = error.cause?.code || '';
            const errorText = controller.signal.aborted ? '接続がタイムアウトしました'
                : /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code) ? '証明書を検証できません。社内CAの設定を確認してください'
                : error.message?.startsWith('APIから') || error.message === '取得データが上限を超えました' ? error.message : '接続に失敗しました。ネットワークとAPI設定を確認してください';
            return res.status(controller.signal.aborted ? 504 : 502).json({ success: false, error: errorText });
        } finally { clearTimeout(timer); }
    });
}
module.exports = { registerEnterpriseRoutes, requestPath, baseUrl, literal };
