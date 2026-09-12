# コンポーネントテンプレート

## 基本構造

```javascript
/**
 * {ComponentName}.js
 * {コンポーネントの説明}
 */
class ComponentName {
    static #instance = null;

    #cache = {
        elements: new Map()
    };

    constructor() {
        if (ComponentName.#instance) {
            throw new Error('ComponentNameクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    static get getInstance() {
        if (!ComponentName.#instance) {
            ComponentName.#instance = new ComponentName();
        }
        return ComponentName.#instance;
    }

    initialize() {
        this.#cacheElements();
        this.#setupEventListeners();
    }

    #cacheElements() {
        this.#cache.elements.set('container', document.getElementById('containerElement'));
    }

    #setupEventListeners() {
        const container = this.#cache.elements.get('container');
        if (container) {
            container.addEventListener('click', (e) => this.#handleClick(e));
        }
    }

    #handleClick(event) {
        event.preventDefault();
        // 処理
    }

    somePublicMethod(options = {}) {
        // 処理
    }
}
```

## モーダルコンポーネント

```javascript
/**
 * {ModalName}Modal.js
 * {モーダルの説明}
 */
class ModalNameModal {
    static #instance = null;

    constructor() {
        if (ModalNameModal.#instance) {
            return ModalNameModal.#instance;
        }
        ModalNameModal.#instance = this;
    }

    static get getInstance() {
        if (!ModalNameModal.#instance) {
            ModalNameModal.#instance = new ModalNameModal();
        }
        return ModalNameModal.#instance;
    }

    show() {
        const modal = document.getElementById('modalNameModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hide() {
        const modal = document.getElementById('modalNameModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    initialize() {
        this.#setupCloseHandlers();
    }

    #setupCloseHandlers() {
        const modal = document.getElementById('modalNameModal');
        if (!modal) return;

        // 背景クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
            }
        });

        // ESCキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.hide();
            }
        });
    }
}
```

## DOM要素作成ヘルパー

ChatUI.instanceを使用：

```javascript
const element = ChatUI.getInstance.createElement('div', {
    classList: ['class-name', 'another-class'],
    attributes: {
        'id': 'elementId',
        'data-value': 'some-value',
        'aria-label': 'アクセシビリティラベル'
    },
    innerHTML: '<span>内容</span>',
    // または
    textContent: 'テキスト内容',
    children: [childElement1, childElement2]
});
```

## モーダルHTML構造

```html
<div id="modalNameModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>モーダルタイトル</h2>
            <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <!-- コンテンツ -->
        </div>
        <div class="modal-footer">
            <button class="modal-cancel-btn">キャンセル</button>
            <button class="modal-save-btn">保存</button>
        </div>
    </div>
</div>
```
