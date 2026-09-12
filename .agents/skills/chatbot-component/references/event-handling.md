# イベントハンドリングパターン

## 基本パターン

```javascript
#setupEventListeners() {
    const element = document.getElementById('elementId');
    if (!element) return;

    element.addEventListener('click', (e) => this.#handleClick(e));
    element.addEventListener('keydown', (e) => this.#handleKeydown(e));
}

#handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    // 処理
}
```

## イベント委譲パターン

```javascript
#setupEventDelegation() {
    const container = document.getElementById('container');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const target = e.target;

        if (target.matches('.action-button')) {
            this.#handleActionButton(target);
            return;
        }

        if (target.matches('.link-item')) {
            this.#handleLinkClick(target);
            return;
        }
    });
}
```

## キーボードイベント

```javascript
#setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESCキーでモーダルを閉じる
        if (e.key === 'Escape') {
            this.#closeModal();
            return;
        }

        // Ctrl+Enter で送信
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            this.#handleSubmit();
            return;
        }

        // Tabキーのカスタム処理
        if (e.key === 'Tab') {
            e.preventDefault();
            this.#handleTab(e.shiftKey);
        }
    });
}
```

## フォームイベント

```javascript
#setupFormEvents() {
    const input = document.getElementById('inputField');
    if (!input) return;

    input.addEventListener('input', (e) => {
        this.#handleInput(e.target.value);
    });

    input.addEventListener('focus', () => {
        this.#handleFocus();
    });

    input.addEventListener('blur', () => {
        this.#handleBlur();
    });

    input.addEventListener('change', (e) => {
        this.#handleChange(e.target.value);
    });
}
```

## 非同期イベント処理

```javascript
async #handleAsyncClick(event) {
    const button = event.target;

    button.disabled = true;
    button.classList.add('loading');

    try {
        await this.#performAsyncOperation();
        UI.getInstance.Core.Notification.show('処理が完了しました', 'success');
    } catch (error) {
        console.error('[Component] 処理エラー:', error);
        UI.getInstance.Core.Notification.show('エラーが発生しました', 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
    }
}
```

## カスタムイベント

```javascript
// イベントを発火
#dispatchCustomEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
        bubbles: true,
        detail: detail
    });
    document.dispatchEvent(event);
}

// イベントをリッスン
#listenCustomEvent(eventName, handler) {
    document.addEventListener(eventName, (e) => {
        handler(e.detail);
    });
}
```

## スクロールイベント

```javascript
#setupScrollHandler() {
    const container = document.getElementById('scrollContainer');
    if (!container) return;

    let isScrolling = false;

    container.addEventListener('scroll', () => {
        if (!isScrolling) {
            requestAnimationFrame(() => {
                this.#handleScroll(container);
                isScrolling = false;
            });
            isScrolling = true;
        }
    });
}

#handleScroll(container) {
    const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    if (isNearBottom) {
        this.#loadMoreContent();
    }
}
```

## リサイズイベント

```javascript
#setupResizeHandler() {
    let resizeTimeout;

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            this.#handleResize();
        }, 100);
    });
}
```

## イベントリスナーの解除

```javascript
#cleanup() {
    // 保存したハンドラー参照を使用して解除
    this.#cache.elements.get('button')?.removeEventListener('click', this.#boundClickHandler);
}
```
