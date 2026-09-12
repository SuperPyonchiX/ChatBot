const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicRoot = path.join(__dirname, '../app/public');

function context() {
    const memory = new Map();
    const c = vm.createContext({ console: { log() {}, warn() {}, error() {} },
        localStorage: {
            getItem: key => memory.get(key) ?? null,
            setItem: (key, value) => memory.set(key, String(value)),
            removeItem: key => memory.delete(key)
        }, addEventListener() {} });
    c.window = c;
    c.load = file => vm.runInContext(fs.readFileSync(path.join(publicRoot, file), 'utf8'), c);
    c.load('js/core/config.js');
    c.memory = memory;
    return c;
}

test('customization retains the active legacy instruction and resets to an empty override', () => {
    const c = context();
    c.memory.set('systemPrompt', '既存の口調と回答方針');
    c.memory.set('systemPromptTemplates', '{"archived":"keep"}');
    c.memory.set('ragEnabled', 'true');
    c.memory.set('userPrompts', '[{"content":"keep"}]');
    c.load('js/core/storage.js');
    c.Storage = vm.runInContext('Storage', c);
    assert.equal(c.Storage.getInstance.loadSystemPrompt(), '既存の口調と回答方針');
    c.Storage.getInstance.saveSystemPrompt('');
    assert.equal(c.Storage.getInstance.loadSystemPrompt(), '');
    assert.equal(c.memory.get('systemPromptTemplates'), '{"archived":"keep"}');
    assert.equal(c.memory.get('ragEnabled'), 'true');
    assert.equal(c.memory.get('userPrompts'), '[{"content":"keep"}]');
    assert.ok(c.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT);
});

test('legacy RAG settings cannot expose a search tool to any provider', async () => {
    const c = context();
    c.memory.set('ragEnabled', 'true');
    c.memory.set('tool_settings', JSON.stringify({ disabledTools: [], maxRounds: 5 }));
    for (const [cls, name] of [['RagSearchTool', 'rag_search'], ['ConfluenceSearchTool', 'confluence_search'], ['JiraSearchTool', 'jira_search']]) {
        c[cls] = { getInstance: { name, description: name, parameters: { type: 'object', properties: {} }, execute() {} } };
    }
    c.load('js/core/tools/toolRegistry.js');
    c.load('js/core/tools/toolSchemaConverter.js');
    c.load('js/core/tools/toolManager.js');
    c.ToolManager = vm.runInContext('ToolManager', c);
    c.ToolRegistry = vm.runInContext('ToolRegistry', c);
    await c.ToolManager.getInstance.initialize();
    assert.equal(c.ToolRegistry.getInstance.getNames().includes('rag_search'), false);
    assert.equal(c.ToolManager.getInstance.isToolEnabled('confluence_search'), true);
    assert.equal(c.ToolManager.getInstance.isToolEnabled('jira_search'), true);
    for (const provider of ['openai', 'claude', 'gemini']) {
        const tools = JSON.stringify(c.ToolManager.getInstance.getToolsForProvider(provider));
        assert.ok(!tools.includes('rag_search'));
        assert.ok(tools.includes('confluence_search'));
    }
    assert.equal(c.memory.get('ragEnabled'), 'true');
});

test('the startup graph has no retired scripts or missing local resources', () => {
    const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
    for (const [, resource] of html.matchAll(/(?:src|href)="([^"?#]+)"/g)) {
        if (/^(https?:|data:)/.test(resource)) continue;
        assert.ok(fs.existsSync(path.join(publicRoot, resource)), resource);
        assert.doesNotMatch(resource, /core\/(rag|userprompts)\/|ragSearchTool|modals\/(knowledgeBase|promptManager|systemPrompt)\//);
    }
    assert.doesNotMatch(html, /huggingface\/transformers|openKnowledgeBase|promptSuggestions|azureEndpointEmbedding/);
    assert.doesNotMatch(fs.readFileSync(path.join(publicRoot, 'main.js'), 'utf8'), /RAGManager|PromptManager/);
    assert.doesNotMatch(fs.readFileSync(path.join(publicRoot, 'js/components/chat/chatActions.js'), 'utf8'), /RAGManager|augmentPrompt/);
});
