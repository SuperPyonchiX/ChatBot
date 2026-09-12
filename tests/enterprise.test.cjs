const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const express = require('../app/node_modules/express');
const { registerEnterpriseRoutes, requestPath, baseUrl } = require('../app/server/enterpriseRoutes');
const root = path.join(__dirname, '../app/public/js/core');

function client() {
    const memory = new Map(), calls = [];
    const c = vm.createContext({ URL, TextEncoder, AbortController, setTimeout, clearTimeout,
        console: { log() {}, warn() {}, error() {} }, btoa: text => Buffer.from(text, 'binary').toString('base64'),
        localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) },
        CryptoHelper: { getInstance: { encrypt: text => 'encrypted:' + text, isEncrypted: text => text?.startsWith('encrypted:'), decrypt: text => text.slice(10) } } });
    c.window = c;
    for (const file of ['config.js', 'enterpriseConfig.js', 'storage.js', 'enterpriseClient.js', 'tools/builtin/urlFetchTool.js', 'tools/builtin/jiraSearchTool.js', 'tools/builtin/jiraGetIssueTool.js', 'tools/builtin/confluenceSearchTool.js', 'tools/builtin/confluenceGetPageTool.js'])
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c);
    c.memory = memory; c.calls = calls;
    c.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ success: true, data: { issues: [], total: 0 } }) }; };
    c.api = c.EnterpriseClient.getInstance;
    c.api.saveConnection('jira', { baseUrl: 'https://jira.example/context', authType: 'basic', authData: 'test-auth' });
    c.api.saveConnection('confluence', { baseUrl: 'https://wiki.example', authType: 'pat', authData: 'test-token' });
    return c;
}

test('JQL/CQL escape literals and cannot change the constructed read path', () => {
    const search = new URL('https://example.test' + requestPath('jira', 'search', { query: 'a" OR project = "X', scope: 'A\\B' }));
    assert.equal(search.pathname, '/rest/api/2/search');
    assert.equal(search.searchParams.get('jql'), 'text ~ "a\\" OR project = \\"X" AND project = "A\\\\B"');
    assert.equal(search.searchParams.get('maxResults'), '10');
    assert.match(requestPath('confluence', 'search', { query: '資料', scope: 'DOC' }), /cql=/);
    for (const id of ['../admin', 'A-1?x=2', '', 'https://evil.example']) assert.throws(() => requestPath('jira', 'get', { id }));
    assert.throws(() => requestPath('jira', 'delete', { id: 'TEST-1' }));
    assert.throws(() => requestPath('jira', 'search', { query: '' }));
    for (const url of ['file:///etc/passwd', 'https://user:pass@example.test', 'https://example.test?q=1']) assert.throws(() => baseUrl(url));
    assert.equal(baseUrl('https://example.test/context/'), 'https://example.test/context');
    const macroQuery = 'project = TEST AND status != Done ORDER BY updated DESC';
    const macroUrl = new URL('https://example.test' + requestPath('jira', 'search', { jql: macroQuery, start: 10 }));
    assert.equal(macroUrl.searchParams.get('jql'), macroQuery);
    assert.equal(macroUrl.searchParams.get('startAt'), '10');
    assert.throws(() => requestPath('confluence', 'search', { query: 'test', start: -1 }));
});

test('settings encrypt both services, migrate legacy values, and require new auth for changed host', () => {
    const c = client();
    assert.equal(c.memory.get('jiraAuthData'), 'encrypted:test-auth');
    c.memory.set('confluenceAuthData', 'legacy-token');
    assert.equal(c.api.getConnection('confluence').authData, 'legacy-token');
    assert.equal(c.memory.get('confluenceAuthData'), 'encrypted:legacy-token');
    assert.throws(() => c.api.prepareConnection('jira', { baseUrl: 'https://other.example', authType: 'basic' }), /再入力/);
    assert.equal(c.api.prepareConnection('jira', { baseUrl: 'https://jira.example/context', authType: 'basic' }).authData, 'test-auth');
    const prepared = c.api.prepareConnection('jira', { baseUrl: 'https://jira.example/context', authType: 'basic', username: '日本語', password: '秘密' });
    assert.equal(Buffer.from(prepared.authData, 'base64').toString('utf8'), '日本語:秘密');
});

test('registered URLs use only enterprise fetch and preserve URL query forms', async () => {
    const c = client();
    assert.equal(c.api.matchUrl('https://jira.example/context/browse/TEST-12?src=confmacro').id, 'TEST-12');
    assert.equal(c.api.matchUrl('https://wiki.example/pages/viewpage.action?pageId=42&spaceKey=DOC').id, '42');
    assert.equal(c.api.matchUrl('https://jira.example.evil.test/context/browse/TEST-1'), null);
    assert.equal(c.api.matchUrl('https://jira.example/context2/browse/TEST-1'), null);
    const result = await c.UrlFetchTool.getInstance.execute({ url: 'https://jira.example/context/unsupported' });
    assert.equal(result.success, false); assert.equal(c.calls.length, 0);
    c.fetch = async (url, init) => { c.calls.push(url); return { ok: false, json: async () => ({ error: '認証に失敗しました' }) }; };
    assert.equal((await c.UrlFetchTool.getInstance.execute({ url: 'https://jira.example/context/browse/TEST-1' })).success, false);
    assert.deepEqual(c.calls, ['/api/enterprise/read']);
    c.api.saveConnection('confluence', { baseUrl: 'https://jira.example/context', authType: 'basic', authData: 'dummy' });
    assert.equal(c.api.matchUrl('https://jira.example/context/pages/viewpage.action?pageId=42').service, 'confluence');
});

test('Confluence direct search uses updated connection settings without a RAG data source', async () => {
    const c = client();
    c.api.saveConnection('confluence', { baseUrl: 'https://new-wiki.example/context', authType: 'basic', authData: 'new-auth' });
    await c.ConfluenceSearchTool.getInstance.execute({ query: '設計' });
    assert.equal(c.api.getConnection('confluence').baseUrl, 'https://new-wiki.example/context');
    assert.equal(c.api.getConnection('confluence').authData, 'new-auth');
    assert.equal(c.calls[0].url, '/api/enterprise/read');
    c.api.clearConnection('confluence');
    const result = await c.ConfluenceSearchTool.getInstance.execute({ query: '設計' });
    assert.equal(result.success, false);
});

test('all tools return data to caller without credentials or any AI-provider selection', async () => {
    const c = client();
    for (const apiType of ['openai', 'azure', 'claude', 'gemini']) {
        c.apiSettings = { apiType };
        const result = await c.JiraSearchTool.getInstance.execute({ query: 'test' });
        assert.equal(result.success, true);
        assert.equal(JSON.stringify(result).includes('test-auth'), false);
        assert.equal(c.apiSettings.apiType, apiType);
    }
    assert.equal((await c.ConfluenceGetPageTool.getInstance.execute({ url: 'https://other.example/page' })).success, false);
    assert.equal(c.calls.length, 4);
});

test('Jira detail includes latest comment window, deduplicates links, and bounds structured result', async () => {
    const c = client();
    const related = { key: 'TEST-2', fields: { summary: 'Related' } };
    c.fetch = async (url, init) => {
        const body = JSON.parse(init.body); c.calls.push(body);
        const data = body.operation === 'get' ? { key: 'TEST-1', fields: { summary: 'Issue', description: 'a'.repeat(25000), parent: related, subtasks: [related], issuelinks: [] } }
            : body.operation === 'commentCount' ? { total: 25 }
            : { total: 25, comments: Array.from({ length: 20 }, (_, id) => ({ id, body: 'b'.repeat(20000) })) };
        return { ok: true, json: async () => ({ success: true, data }) };
    };
    const result = await c.JiraGetIssueTool.getInstance.execute({ id: 'TEST-1' });
    assert.equal(result.success, true); assert.equal(result.related.length, 1);
    assert.equal(result.truncated, true); assert.equal(result.resultTruncated, true);
    assert.equal(c.calls[2].params.start, 5); assert.equal(result.commentsHasMore, true);
    assert.ok(JSON.stringify(result).length <= c.CONFIG.ENTERPRISE.RESULT_LIMIT);
    assert.equal(result.url, 'https://jira.example/context/browse/TEST-1');
});

test('partial comment failure preserves page and reports missing comments', async () => {
    const c = client();
    c.api.request = async (service, operation) => { if (operation !== 'get') throw new Error('アクセス権限がありません'); return { key: 'TEST-1', fields: { summary: 'Issue', description: 'Known fact' } }; };
    const result = await c.api.execute('jira', 'get', { id: 'TEST-1' });
    assert.equal(result.success, true); assert.equal(result.content, 'Known fact');
    assert.match(result.commentsError, /権限/);
});

test('registered tools and results pass through selected OpenAI, Azure, Claude and Gemini routes', async () => {
    const c = client(); c.addEventListener = () => {};
    for (const file of ['tools/toolRegistry.js', 'tools/toolSchemaConverter.js', 'tools/toolManager.js', 'api.js'])
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c);
    const manager = vm.runInContext('ToolManager.getInstance', c);
    await manager.initialize();
    for (const [type, modelGroup, cls, method] of [
        ['openai', 'OPENAI', 'OpenAIAPI', 'callOpenAIAPI'], ['azure', 'OPENAI', 'ResponsesAPI', 'callResponsesAPI'],
        ['claude', 'CLAUDE', 'ClaudeAPI', 'callClaudeAPI'], ['gemini', 'GEMINI', 'GeminiAPI', 'callGeminiAPI']
    ]) {
        const routed = [];
        c.apiSettings = { apiType: type, azureResponsesEndpoint: type === 'azure' ? 'https://azure.example/openai/responses' : '' };
        c[cls] = { getInstance: { [method]: async (messages, model, attachments, options) => {
            routed.push({ messages, options }); return 'Answer with source';
        } } };
        const messages = [{ role: 'user', content: 'Jiraで検索して' }];
        await c.AIAPI.getInstance.callAIAPI(messages, c.CONFIG.MODELS[modelGroup][0], [], { stream: true });
        const schemas = JSON.stringify(routed[0].options.tools);
        for (const name of ['jira_search', 'jira_get_issue', 'confluence_search', 'confluence_get_page']) assert.ok(schemas.includes(name), `${type}: ${name}`);
        const result = await c.JiraSearchTool.getInstance.execute({ query: 'review' });
        messages.push({ role: 'user', content: '<tool_result>' + JSON.stringify(result) + '</tool_result>' });
        await c.AIAPI.getInstance.callAIAPI(messages, c.CONFIG.MODELS[modelGroup][0], [], { stream: true });
        assert.equal(routed.length, 2); assert.ok(routed[1].messages[1].content.includes('results'));
        assert.ok(!JSON.stringify(routed).includes('test-auth'));
    }
    manager.saveSettings({ enabledTools: ['jira_search'] });
    assert.equal(manager.getAllTools().find(tool => tool.name === 'confluence_search').enabled, false);
});

async function serverTest(t, fetchImpl) {
    const app = express(); registerEnterpriseRoutes(app, fetchImpl);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return async body => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/enterprise/read`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
    };
}
const input = { service: 'jira', operation: 'get', params: { id: 'TEST-1' }, connection: { baseUrl: 'https://jira.example/context', authType: 'basic', authData: 'dummy' } };

test('route performs only constructed GET, disables redirects, and preserves context path', async t => {
    const calls = [];
    const post = await serverTest(t, async (url, init) => { calls.push({ url, init }); return Response.json({ key: 'TEST-1' }); });
    assert.equal((await post(input)).status, 200);
    assert.match(calls[0].url, /^https:\/\/jira.example\/context\/rest\/api\/2\/issue\/TEST-1\?/);
    assert.equal(calls[0].init.redirect, 'manual'); assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.headers.Authorization, 'Basic dummy');
    assert.equal((await post({ ...input, operation: 'delete' })).status, 400);
    assert.equal(calls.length, 1);
});

test('route distinguishes auth, permissions, missing content, redirect, HTML and certificate errors', async t => {
    let response = Response.json({}, { status: 401 });
    const post = await serverTest(t, async () => { if (response instanceof Error) throw response; return response; });
    for (const [status, pattern] of [[401, /認証/], [403, /権限/], [404, /見つかりません/], [302, /リダイレクト/]]) {
        response = new Response('sensitive upstream body', { status });
        const result = await post(input); assert.match(result.body.error, pattern);
        assert.equal(JSON.stringify(result).includes('sensitive'), false);
    }
    response = new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } });
    assert.match((await post(input)).body.error, /JSON/);
    response = Object.assign(new Error('secret hostname'), { cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } });
    assert.match((await post(input)).body.error, /証明書/);
});
