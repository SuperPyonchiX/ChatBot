/**
 * システムプロンプトモーダルを管理するクラス
 * @class SystemPromptModal
 */
class SystemPromptModal {
    static #instance = null;

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (SystemPromptModal.#instance) {
            throw new Error('SystemPromptModalクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * シングルトンインスタンスを取得します
     * @returns {SystemPromptModal} SystemPromptModalのインスタンス
     */
    static get getInstance() {
        if (!SystemPromptModal.#instance) {
            SystemPromptModal.#instance = new SystemPromptModal();
        }
        return SystemPromptModal.#instance;
    }

    /**
     * システムプロンプト設定モーダルを表示します
     * @param {string} systemPrompt - 現在のシステムプロンプト
     * @param {Object} systemPromptTemplates - システムプロンプト集
     * @param {Function} onSelect - システムプロンプト選択時のコールバック
     * @param {Function} onDelete - システムプロンプト削除時のコールバック
     */
    showSystemPromptModal(systemPrompt, systemPromptTemplates, onSelect, onDelete) {
        UIUtils.getInstance.toggleModal('systemPromptModal', true);
        UICache.getInstance.get('systemPromptInput').value = systemPrompt;
        
        // バインドされたコールバック関数を保存
        this._boundOnSelect = onSelect.bind(ModalHandlers.getInstance);
        this._boundOnDelete = onDelete.bind(ModalHandlers.getInstance);
        
        this.updateList(systemPromptTemplates);
    }

    /**
     * システムプロンプトモーダルを非表示にします
     */
    hideSystemPromptModal() {
        UIUtils.getInstance.toggleModal('systemPromptModal', false);
    }

    /**
     * システムプロンプト一覧を表示します
     * @param {Object} systemPromptTemplates - システムプロンプト集
     */
    updateList(systemPromptTemplates) {
        const listArea = UICache.getInstance.get('systemPromptListArea');
        if (!listArea) return;
        
        // 一覧をクリア
        listArea.innerHTML = '';
        
        // DocumentFragmentを使用してDOM操作を最適化
        const fragment = document.createDocumentFragment();

        // カテゴリごとにプロンプトを整理
        const categorizedPrompts = {};
        Object.entries(systemPromptTemplates).forEach(([promptName, template]) => {
            const category = template.category || '基本';
            if (!categorizedPrompts[category]) {
                categorizedPrompts[category] = [];
            }
            categorizedPrompts[category].push({
                name: promptName,
                content: template.content,
                description: template.description || '',
                tags: template.tags || []
            });
        });
        
        // カテゴリの表示順序を設定
        const defaultCategories = Object.keys(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES);
        const sortedCategories = [...defaultCategories];
        // 設定されていないカテゴリを追加
        Object.keys(categorizedPrompts).forEach(category => {
            if (!sortedCategories.includes(category)) {
                sortedCategories.push(category);
            }
        });
        
        // カテゴリごとにシステムプロンプトを表示
        sortedCategories.forEach(category => {
            if (!categorizedPrompts[category]) return;
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'system-prompt-category';
            
            // 保存された展開状態を復元
            const isCategoryCollapsed = Storage.getInstance.loadCategoryState(category);
            if (isCategoryCollapsed) {
                categoryElement.classList.add('collapsed');
            }
            
            // カテゴリヘッダー
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'system-prompt-category-header';
            categoryHeader.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span class="category-title">${category}</span>
                <span class="category-count">${categorizedPrompts[category].length}</span>
            `;
            
            // カテゴリヘッダーのクリックイベント
            categoryHeader.addEventListener('click', () => {
                categoryElement.classList.toggle('collapsed');
                // 展開状態を保存
                Storage.getInstance.saveCategoryState(
                    category, 
                    categoryElement.classList.contains('collapsed')
                );
            });
            
            // システムプロンプトリスト
            const promptList = document.createElement('div');
            promptList.className = 'system-prompt-list';
            
            // カテゴリ内のプロンプトをソート
            categorizedPrompts[category]
                .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
                .forEach(prompt => {
                    const item = this._createPromptItem(prompt);
                    promptList.appendChild(item);
                });
            
            categoryElement.appendChild(categoryHeader);
            categoryElement.appendChild(promptList);
            fragment.appendChild(categoryElement);
        });
        
        // 一度のDOM操作でフラグメントを追加
        listArea.appendChild(fragment);
    }

    /**
     * システムプロンプト項目要素を作成します
     * @private
     */
    _createPromptItem(prompt) {
        const promptItem = document.createElement('div');
        promptItem.className = 'system-prompt-item';
        
        // プロンプト名
        const nameElement = document.createElement('span');
        nameElement.className = 'system-prompt-name';
        nameElement.textContent = prompt.name;
        promptItem.appendChild(nameElement);
        
        // 説明文が存在する場合は表示
        if (prompt.description) {
            const descElement = document.createElement('div');
            descElement.className = 'system-prompt-description';
            descElement.textContent = prompt.description;
            promptItem.appendChild(descElement);
        }
        
        // タグの表示
        if (prompt.tags && prompt.tags.length > 0) {
            const tagsElement = document.createElement('div');
            tagsElement.className = 'system-prompt-tags';
            prompt.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'system-prompt-tag';
                tagElement.textContent = tag;
                tagsElement.appendChild(tagElement);
            });
            promptItem.appendChild(tagsElement);
        }

        // デフォルトプロンプトかどうかを判定
        const isDefaultPrompt = Object.values(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES)
            .some(category => Object.keys(category).includes(prompt.name));

        // デフォルトプロンプト以外に削除ボタンを表示
        if (!isDefaultPrompt) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'system-prompt-delete-button';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'システムプロンプトを削除';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._boundOnDelete) {
                    this._boundOnDelete(prompt.name);
                }
            });
            promptItem.appendChild(deleteButton);
        }

        // クリックイベントの設定
        promptItem.addEventListener('click', () => {
            if (this._boundOnSelect) {
                this._boundOnSelect(prompt.name);
            }
        });
        
        return promptItem;
    }
}

// グローバルアクセスのために window.UI.Core.Modal に設定
window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = SystemPromptModal.getInstance;