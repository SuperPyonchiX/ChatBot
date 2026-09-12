const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(reduced = false) {
    const timers = new Map(); let timerId = 0;
    const context = vm.createContext({ console, Date,
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        document: { createElement: () => element() },
        matchMedia: () => ({ matches: reduced })
    });
    context.window = context;
    for (const file of ['core/config.js', 'components/chat/streamingIndicator.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js', file), 'utf8'), context);
    }
    function element() {
        return { dataset: {}, children: [], style: { setProperty(){}, removeProperty(){} },
            setAttribute(){}, appendChild(child) { this.children.push(child); child.parent = this; },
            querySelector(selector) { return selector === '.stream-label'
                ? this.children.find(e => e.className === 'stream-label')
                : this.children.flatMap(e => [e, ...e.children]).find(e => e.className === 'stream-indicator'); },
            remove() { this.parent.children = this.parent.children.filter(e => e !== this); }, offsetTop: 0
        };
    }
    const message = element(); const content = element(); message.appendChild(content);
    const indicator = context.StreamingIndicator.getInstance;
    return { context, indicator, message, content, timers, element };
}

test('waiting label, busy label and clear retain the same ring', () => {
    const { indicator, message, content } = setup();
    const view = indicator.attach(message, content); const ring = view.children[0];
    assert.equal(view.children[1].textContent, '応答を準備中');
    indicator.setLabel(message, '検索中');
    assert.equal(view.dataset.state, 'busy');
    indicator.clearLabel(message);
    assert.equal(view.children[1].textContent, '応答を準備中');
    assert.equal(view.children[0], ring);
    assert.equal(indicator.attach(message, content), view);
});

test('a stale exit cannot hide a renewed tool/waiting state', () => {
    const { indicator, message, content, timers } = setup();
    const view = indicator.attach(message, content);
    indicator.onBodyChunk(message);
    const staleExit = [...timers.values()][0];
    assert.equal(view.dataset.state, 'leaving');
    indicator.onBodyChunk(message);
    assert.equal(timers.size, 1);
    indicator.setLabel(message, 'ツールを実行中');
    staleExit();
    assert.equal(view.dataset.state, 'busy');
    assert.equal(timers.size, 0);
    indicator.clearLabel(message);
    indicator.onBodyChunk(message);
    [...timers.values()][0]();
    assert.equal(view.dataset.state, 'hidden');
});

test('finish removes pending exits and active target; repeated finish is safe', () => {
    const { indicator, message, content, timers } = setup();
    indicator.attach(message, content); indicator.onBodyChunk(message);
    indicator.finish(message); indicator.finish(message);
    assert.equal(timers.size, 0);
    assert.equal(indicator.activeMessage, null);
    assert.equal(content.children.length, 0);
    indicator.setActiveLabel('late event');
    assert.equal(content.children.length, 0);
});

test('reduced motion hides immediately without scheduling an animation', () => {
    const { indicator, message, content, timers } = setup(true);
    const view = indicator.attach(message, content); indicator.onBodyChunk(message);
    assert.equal(view.dataset.state, 'hidden');
    assert.equal(timers.size, 0);
});

test('attaching a new message cleans up the previous active indicator', () => {
    const { indicator, message, content, timers, element } = setup();
    indicator.attach(message, content); indicator.onBodyChunk(message);
    const next = element(); const nextContent = element(); next.appendChild(nextContent);
    indicator.attach(next, nextContent);
    assert.equal(content.children.length, 0);
    assert.equal(timers.size, 0);
    assert.equal(indicator.activeMessage, next);
});

function rendererSetup() {
    const env = setup(); const frames = [];
    env.context.requestAnimationFrame = fn => frames.push(fn);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/components/chat/chatRenderer.js'), 'utf8'), env.context);
    const container = { isConnected: true, dataset: {}, textContent: '', innerHTML: '', querySelectorAll: () => [] };
    const message = { querySelector: selector => selector === '.markdown-content' ? container : null, classList: { remove(){} } };
    const renderer = env.context.ChatRenderer.getInstance;
    return { ...env, frames, container, message, renderer };
}

test('cancellation invalidates a queued render and rejects later chunks', async () => {
    const { renderer, frames, container, message } = rendererSetup();
    const pending = renderer.updateStreamingBotMessage(container, '', 'old');
    renderer.cancelStreamingMessage(message);
    frames.shift()(); await pending;
    await renderer.updateStreamingBotMessage(container, '', 'late');
    assert.equal(frames.length, 0);
    assert.equal(container.innerHTML, '');
    assert.equal(container.dataset.streamClosed, 'true');
});

test('asynchronous Markdown success and failure cannot overwrite a cancelled message', async () => {
    for (const failure of [false, true]) {
        const { context, renderer, frames, container, message } = rendererSetup();
        let complete;
        context.Markdown = { getInstance: { renderMarkdown: () => new Promise((resolve, reject) => {
            complete = () => failure ? reject(new Error('late failure')) : resolve('<p>late success</p>');
        }) } };
        const pending = renderer.updateStreamingBotMessage(container, '', 'late');
        frames.shift()();
        renderer.cancelStreamingMessage(message);
        complete(); await pending;
        assert.equal(container.innerHTML, '');
        assert.equal(container.textContent, '');
    }
});
