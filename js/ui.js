/**
 * ui.js
 * UI関連の機能を提供するモジュール
 * 
 * サイドバー、モーダル、テンプレート、添付ファイルなどのUI要素と
 * 関連するインタラクションを管理します。
 *
 * @module UI
 */

// DOM要素をキャッシュするためのヘルパーオブジェクト
/**
 * DOM要素をキャッシュするためのヘルパーオブジェクト
 * 同じ要素への参照を複数回取得する際のパフォーマンスを向上させます
 * 
 * @namespace UICache
 */
const UICache = {
    elements: {},
    
    /**
     * 要素を取得またはキャッシュから返します
     * @param {string} selector - CSS セレクタ
     * @param {boolean} useQuerySelector - true: querySelector, false: getElementById
     * @returns {HTMLElement} 取得した要素
     */
    get: (selector, useQuerySelector = false) => {
        if (!selector) return null;
        
        // キャッシュに要素が存在するか確認
        if (!UICache.elements[selector]) {
            try {
                UICache.elements[selector] = useQuerySelector 
                    ? document.querySelector(selector) 
                    : document.getElementById(selector);
                    
                // 要素が見つからない場合はnullを返す（エラー防止）
                if (!UICache.elements[selector]) {
                    console.warn(`要素が見つかりません: ${selector}`);
                    return null;
                }
            } catch (error) {
                console.error(`要素の取得エラー: ${selector}`, error);
                return null;
            }
        }
        return UICache.elements[selector];
    },
    
    /**
     * 指定されたセレクタに一致する複数の要素を取得します
     * @param {string} selector - CSS セレクタ
     * @returns {Array<HTMLElement>} 取得した要素の配列
     */
    getAll: (selector) => {
        if (!selector) return [];
        
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            console.error(`要素の複数取得エラー: ${selector}`, error);
            return [];
        }
    },
    
    /**
     * キャッシュをクリアします
     */
    clear: () => {
        UICache.elements = {};
    }
};

/**
 * 共通ユーティリティ関数
 * UI操作に関する汎用メソッドを提供します
 * 
 * @namespace UIUtils
 */
const UIUtils = {
    /**
     * 要素の表示/非表示を切り替えます
     * @param {HTMLElement} element - 対象要素
     * @param {boolean} show - 表示するかどうか
     */
    toggleVisibility: (element, show) => {
        if (!element) return;
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    },
    
    /**
     * モーダルの表示/非表示を切り替えます
     * @param {string} modalId - モーダル要素のID
     * @param {boolean} show - 表示するかどうか
     */
    toggleModal: (modalId, show) => {
        const modal = UICache.get(modalId);
        if (!modal) return;
        
        if (show) {
            modal.classList.add('show');
            // ESCキーでモーダルを閉じる
            document.addEventListener('keydown', UIUtils._escapeKeyHandler);
            // スクロール防止
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.remove('show');
            // イベントリスナーを削除
            document.removeEventListener('keydown', UIUtils._escapeKeyHandler);
            // スクロール許可
            document.body.style.overflow = '';
        }
    },
    
    /**
     * ESCキーが押されたときのハンドラー
     * @param {KeyboardEvent} e - キーボードイベント
     * @private
     */
    _escapeKeyHandler: (e) => {
        if (e.key === 'Escape') {
            const visibleModal = document.querySelector('.modal.show');
            if (visibleModal) {
                UIUtils.toggleModal(visibleModal.id, false);
            }
        }
    },
    
    /**
     * 要素を作成して属性を設定します
     * @param {string} tag - HTML要素タグ名
     * @param {Object} props - 属性オブジェクト
     * @returns {HTMLElement} 作成された要素
     */
    createElement: (tag, props = {}) => {
        if (!tag) return null;
        
        const element = document.createElement(tag);
        
        Object.entries(props).forEach(([key, value]) => {
            if (!value) return;
            
            if (key === 'classList' && Array.isArray(value)) {
                value.forEach(cls => element.classList.add(cls));
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key === 'events' && typeof value === 'object') {
                Object.entries(value).forEach(([event, handler]) => {
                    if (typeof handler === 'function') {
                        element.addEventListener(event, handler);
                    }
                });
            } else if (key === 'children' && Array.isArray(value)) {
                value.forEach(child => {
                    if (child) element.appendChild(child);
                });
            } else if (key === 'attributes' && typeof value === 'object') {
                Object.entries(value).forEach(([attrName, attrValue]) => {
                    element.setAttribute(attrName, attrValue);
                });
            } else {
                element[key] = value;
            }
        });
        
        return element;
    },
    
    /**
     * 指定されたミリ秒だけ遅延するPromiseを返します
     * @param {number} ms - 遅延するミリ秒
     * @returns {Promise} - 遅延を表すPromise
     */
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    /**
     * 要素のサイズを滑らかに変更します
     * @param {HTMLElement} element - 対象要素
     * @param {number} targetHeight - 目標の高さ（px）
     * @param {number} duration - アニメーション時間（ms）
     * @returns {Promise} - アニメーション完了時に解決するPromise
     */
    animateHeight: async (element, targetHeight, duration = 300) => {
        if (!element) return;
        
        const startHeight = element.clientHeight;
        const heightDiff = targetHeight - startHeight;
        const startTime = performance.now();
        
        return new Promise(resolve => {
            function updateHeight(currentTime) {
                const elapsedTime = currentTime - startTime;
                if (elapsedTime >= duration) {
                    element.style.height = `${targetHeight}px`;
                    resolve();
                    return;
                }
                
                const progress = elapsedTime / duration;
                const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2; // イージング関数
                const currentHeight = startHeight + heightDiff * easedProgress;
                element.style.height = `${currentHeight}px`;
                requestAnimationFrame(updateHeight);
            }
            
            requestAnimationFrame(updateHeight);
        });
    }
};

/**
 * UI操作のための機能を提供するグローバルオブジェクト
 * サイドバー、モーダル、テンプレート、添付ファイル機能を含みます
 * 
 * @namespace UI
 */
window.UI = {
    /**
     * モバイル用のサイドバートグルボタンを作成します
     * 画面サイズに応じてサイドバーの表示/非表示を切り替えるボタンを配置します
     * 
     * @function createSidebarToggle
     * @memberof UI
     * @returns {void}
     */
    createSidebarToggle: function() {
        const sidebarEl = UICache.get('.sidebar', true);
        const appContainer = UICache.get('.app-container', true);
        
        // トグルボタンの表示エリアと、トグルボタンを作成
        const toggleArea = UIUtils.createElement('div', { classList: ['sidebar-toggle-area'] });
        const toggleButton = UIUtils.createElement('button', { 
            classList: ['sidebar-toggle'],
            innerHTML: '<i class="fas fa-bars"></i>'
        });

        // 保存された状態を復元
        const isCollapsed = window.Storage.loadSidebarState();
        if (isCollapsed) {
            sidebarEl.classList.add('collapsed');
        } else {
            toggleButton.classList.add('sidebar-visible');
        }
        
        // イベントリスナーをまとめて設定
        toggleButton.addEventListener('click', () => this._toggleSidebarState(sidebarEl, toggleButton));
        
        UICache.get('.chat-container', true).addEventListener('click', () => {
            if (window.innerWidth <= 576 && sidebarEl.classList.contains('show')) {
                sidebarEl.classList.remove('show');
            }
        });
        
        window.addEventListener('resize', () => {
            if (window.innerWidth > 576) {
                sidebarEl.classList.remove('show');
            }
        });
        
        // 要素を追加
        toggleArea.appendChild(toggleButton);
        appContainer.appendChild(toggleArea);
    },

    /**
     * サイドバーの状態をトグルします
     * サイドバーの表示/非表示状態を切り替え、その状態を保存します
     * 
     * @function _toggleSidebarState
     * @memberof UI
     * @param {HTMLElement} sidebar - サイドバー要素
     * @param {HTMLElement} toggleButton - トグルボタン要素
     * @returns {void}
     * @private
     */
    _toggleSidebarState: function(sidebar, toggleButton) {
        const isNowCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        toggleButton.classList.toggle('sidebar-visible');
        window.Storage.saveSidebarState(!isNowCollapsed);
    },

    /**
     * テキストエリアの高さを自動調整します
     * 入力内容に応じてテキストエリアの高さを動的に変更します
     * 
     * @function autoResizeTextarea
     * @memberof UI
     * @param {HTMLTextAreaElement} textarea - 対象のテキストエリア要素
     * @returns {void}
     */
    autoResizeTextarea: function(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    },

    /**
     * APIキーモーダルを表示します
     * API設定を編集するためのモーダルダイアログを表示します
     * 
     * @function showApiKeyModal
     * @memberof UI
     * @param {Object} apiSettings - API設定オブジェクト
     * @param {string} apiSettings.apiType - API種別 ('openai' または 'azure')
     * @param {string} apiSettings.openaiApiKey - OpenAI APIキー
     * @param {string} apiSettings.azureApiKey - Azure APIキー
     * @param {Object} apiSettings.azureEndpoints - Azureエンドポイント設定
     * @returns {void}
     */
    showApiKeyModal: function(apiSettings) {
        UIUtils.toggleModal('apiKeyModal', true);
        
        // 必要な要素を一度に取得
        const elements = {
            azureApiKeyInput: UICache.get('azureApiKeyInput'),
            openaiRadio: UICache.get('openaiRadio'),
            azureRadio: UICache.get('azureRadio'),
            apiKeyInput: UICache.get('apiKeyInput'),
            openaiSettings: UICache.get('openaiSettings'),
            azureSettings: UICache.get('azureSettings'),
            azureEndpointGpt4oMini: UICache.get('azureEndpointGpt4oMini'),
            azureEndpointGpt4o: UICache.get('azureEndpointGpt4o'),
            azureEndpointO1Mini: UICache.get('azureEndpointO1Mini'),
            azureEndpointO1: UICache.get('azureEndpointO1')
        };
        
        // APIタイプに応じて設定を表示
        if (apiSettings.apiType === 'azure') {
            elements.azureRadio.checked = true;
            elements.azureApiKeyInput.value = apiSettings.azureApiKey;
            UIUtils.toggleVisibility(elements.openaiSettings, false);
            UIUtils.toggleVisibility(elements.azureSettings, true);
            
            // Azureエンドポイント設定を適用
            elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
            elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
            elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
            elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
        } else {
            elements.openaiRadio.checked = true;
            elements.apiKeyInput.value = apiSettings.openaiApiKey;
            UIUtils.toggleVisibility(elements.openaiSettings, true);
            UIUtils.toggleVisibility(elements.azureSettings, false);
        }
    },

    /**
     * APIキーモーダルを非表示にします
     * API設定モーダルを閉じます
     * 
     * @function hideApiKeyModal
     * @memberof UI
     * @returns {void}
     */
    hideApiKeyModal: function() {
        UIUtils.toggleModal('apiKeyModal', false);
    },

    /**
     * Azure設定の表示/非表示を切り替えます
     * API設定画面でOpenAI/Azure切り替え時に適切な設定フィールドを表示します
     * 
     * @function toggleAzureSettings
     * @memberof UI
     * @returns {void}
     */
    toggleAzureSettings: function() {
        const openaiSettings = UICache.get('openaiSettings');
        const azureSettings = UICache.get('azureSettings');
        const azureRadio = UICache.get('azureRadio');
        
        UIUtils.toggleVisibility(openaiSettings, !azureRadio.checked);
        UIUtils.toggleVisibility(azureSettings, azureRadio.checked);
    },

    /**
     * チャットの名前変更モーダルを表示します
     * 会話のタイトルを変更するためのモーダルを表示します
     * 
     * @function showRenameChatModal
     * @memberof UI
     * @param {Object} conversation - 会話オブジェクト
     * @param {string} conversation.id - 会話ID
     * @param {string} conversation.title - 会話タイトル
     * @returns {void}
     */
    showRenameChatModal: function(conversation) {
        const modalEl = UICache.get('renameChatModal');
        const titleInput = UICache.get('chatTitleInput');
        
        // 現在のタイトルをセット
        titleInput.value = conversation.title || '新しいチャット';
        
        // 会話IDをモーダルに保存
        modalEl.dataset.conversationId = conversation.id;
        
        // モーダルを表示
        UIUtils.toggleModal('renameChatModal', true);
        
        // フォーカスを設定
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 10);
    },

    /**
     * チャットの名前変更モーダルを非表示にします
     * 会話名変更モーダルを閉じます
     * 
     * @function hideRenameChatModal
     * @memberof UI
     * @returns {void}
     */
    hideRenameChatModal: function() {
        UIUtils.toggleModal('renameChatModal', false);
    },

    /**
     * システムプロンプト設定モーダルを表示します
     * システムプロンプト編集モーダルを表示し、テンプレート一覧も更新します
     * 
     * @function showSystemPromptModal
     * @memberof UI
     * @param {string} systemPrompt - 現在のシステムプロンプト
     * @param {Object} promptTemplates - プロンプトテンプレート集
     * @param {Function} onTemplateSelect - テンプレート選択時のコールバック
     * @param {Function} onTemplateDelete - テンプレート削除時のコールバック
     * @returns {void}
     */
    showSystemPromptModal: function(systemPrompt, promptTemplates, onTemplateSelect, onTemplateDelete) {
        UIUtils.toggleModal('systemPromptModal', true);
        UICache.get('systemPromptInput').value = systemPrompt;
        
        // カテゴリ選択肢を設定
        const categorySelect = document.getElementById('newTemplateCategory');
        if (categorySelect) {
            const categories = window.CONFIG.PROMPTS.TEMPLATES.CATEGORY_ORDER || [];
            categorySelect.innerHTML = ''; // 既存の選択肢をクリア
            
            // デフォルトのカテゴリを追加
            const defaultOption = document.createElement('option');
            defaultOption.value = '基本';
            defaultOption.textContent = '基本';
            categorySelect.appendChild(defaultOption);
            
            // その他のカテゴリを追加
            categories.forEach(category => {
                if (category !== '基本') {  // デフォルトカテゴリは既に追加済み
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                }
            });
            
            // 「その他」カテゴリを最後に追加
            const otherOption = document.createElement('option');
            otherOption.value = 'その他';
            otherOption.textContent = 'その他';
            categorySelect.appendChild(otherOption);
        }
        
        // テンプレート一覧を表示（不要なエントリを除外）
        const filteredTemplates = {};
        Object.entries(promptTemplates).forEach(([key, value]) => {
            // 'CATEGORIES'と'CATEGORY_ORDER'は除外
            if (key !== 'CATEGORIES' && key !== 'CATEGORY_ORDER') {
                filteredTemplates[key] = value;
            }
        });
        
        this.updateTemplateList(filteredTemplates, onTemplateSelect, onTemplateDelete);
    },

    /**
     * システムプロンプト設定モーダルを非表示にします
     * システムプロンプト編集モーダルを閉じます
     * 
     * @function hideSystemPromptModal
     * @memberof UI
     * @returns {void}
     */
    hideSystemPromptModal: function() {
        UIUtils.toggleModal('systemPromptModal', false);
    },

    /**
     * テンプレート一覧を表示します
     * システムプロンプトテンプレートの一覧を表示し、選択/削除機能を提供します
     * 
     * @function updateTemplateList
     * @memberof UI
     * @param {Object} promptTemplates - プロンプトテンプレート集
     * @param {Function} onTemplateSelect - テンプレート選択時のコールバック関数
     * @param {Function} onTemplateDelete - テンプレート削除時のコールバック関数
     * @returns {void}
     */
    updateTemplateList: function(promptTemplates, onTemplateSelect, onTemplateDelete) {
        const templateListArea = UICache.get('templateListArea');
        if (!templateListArea) return;
        
        // テンプレート一覧をクリア
        templateListArea.innerHTML = '';
        
        // DocumentFragmentを使用してDOM操作を最適化
        const fragment = document.createDocumentFragment();
        
        // カテゴリごとにテンプレートを整理
        const categorizedTemplates = {};
        Object.entries(promptTemplates).forEach(([templateName, content]) => {
            // configファイルからカテゴリを取得
            let category = '';
            for (const [cat, templates] of Object.entries(window.CONFIG.PROMPTS.TEMPLATES.CATEGORIES)) {
                if (templates[templateName]) {
                    category = cat;
                    break;
                }
            }
            // カテゴリがない場合は「その他」に分類
            if (!category) category = 'その他';
            
            if (!categorizedTemplates[category]) {
                categorizedTemplates[category] = [];
            }
            categorizedTemplates[category].push({name: templateName, content: content});
        });
        
        // カテゴリの表示順序を取得
        const categoryOrder = window.CONFIG.PROMPTS.TEMPLATES.CATEGORY_ORDER || [];
        const sortedCategories = [...categoryOrder];
        // 設定されていないカテゴリを追加
        Object.keys(categorizedTemplates).forEach(category => {
            if (!sortedCategories.includes(category)) {
                sortedCategories.push(category);
            }
        });
        
        // カテゴリごとにテンプレートを表示
        sortedCategories.forEach(category => {
            if (!categorizedTemplates[category]) return;
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'template-category';
            
            // 保存された展開状態を復元
            const isCategoryCollapsed = window.Storage.loadCategoryState(category);
            if (isCategoryCollapsed) {
                categoryElement.classList.add('collapsed');
            }
            
            // カテゴリヘッダー
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'template-category-header';
            categoryHeader.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span class="category-title">${category}</span>
                <span class="category-count">${categorizedTemplates[category].length}</span>
            `;
            
            // カテゴリヘッダーのクリックイベント
            categoryHeader.addEventListener('click', () => {
                categoryElement.classList.toggle('collapsed');
                // 展開状態を保存
                window.Storage.saveCategoryState(
                    category, 
                    categoryElement.classList.contains('collapsed')
                );
            });
            
            // テンプレートリスト
            const templateList = document.createElement('div');
            templateList.className = 'template-list';
            
            // カテゴリ内のテンプレートをソート
            categorizedTemplates[category]
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(({name: templateName}) => {
                    const item = this._createTemplateItem(templateName, onTemplateSelect, onTemplateDelete);
                    templateList.appendChild(item);
                });
            
            categoryElement.appendChild(categoryHeader);
            categoryElement.appendChild(templateList);
            fragment.appendChild(categoryElement);
        });
        
        // 一度のDOM操作でフラグメントを追加
        templateListArea.appendChild(fragment);
    },

    /**
     * テンプレート項目要素を作成します
     * テンプレート一覧の個々の項目要素を生成します
     * 
     * @function _createTemplateItem
     * @memberof UI
     * @param {string} templateName - テンプレート名
     * @param {Function} onTemplateSelect - テンプレート選択時のコールバック関数
     * @param {Function} onTemplateDelete - テンプレート削除時のコールバック関数
     * @returns {HTMLElement} テンプレート項目要素
     * @private
     */
    _createTemplateItem: function(templateName, onTemplateSelect, onTemplateDelete) {
        // 削除ボタン（デフォルトテンプレートと設定ファイルで定義されたテンプレート以外のみ）
        const children = [
            UIUtils.createElement('span', {
                textContent: templateName,
                classList: ['template-name']
            })
        ];
        
        // config.jsで定義されたテンプレートの判定
        const isConfigTemplate = Object.keys(window.CONFIG.PROMPTS.TEMPLATES).includes(templateName);
        
        // デフォルトテンプレートとconfig.jsで定義されたテンプレート以外に削除ボタンを表示
        if (!isConfigTemplate) {
            children.push(UIUtils.createElement('button', {
                classList: ['template-delete-button'],
                innerHTML: '<i class="fas fa-trash"></i>',
                title: 'テンプレートを削除',
                events: {
                    click: (e) => {
                        e.stopPropagation();
                        onTemplateDelete(templateName);
                    }
                }
            }));
        }
        
        // テンプレート項目
        return UIUtils.createElement('div', {
            classList: ['template-item'],
            children,
            events: {
                click: () => onTemplateSelect(templateName)
            }
        });
    },

    /**
     * ファイル添付ボタンと添付ファイル表示エリアを作成します
     * チャット入力エリアにファイル添付機能を追加します
     * 
     * @function createFileAttachmentUI
     * @memberof UI
     * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
     * @param {Function} onFileAttached - ファイル添付時のコールバック関数
     * @returns {Object} 作成した要素のオブジェクト
     */
    createFileAttachmentUI: function(chatInputContainer, onFileAttached) {
        if (!chatInputContainer) return {};
        
        // ファイル入力要素（非表示）
        const fileInput = UIUtils.createElement('input', {
            type: 'file',
            id: 'fileAttachment',
            accept: 'image/*',
            style: { display: 'none' },
            multiple: false
        });
        
        // ファイル添付ボタン
        const attachButton = UIUtils.createElement('button', {
            classList: ['attachment-button'],
            innerHTML: '<i class="fas fa-paperclip"></i>',
            title: '画像を添付',
            events: {
                click: () => fileInput.click()
            }
        });
        
        // 添付ファイル表示エリア
        const attachmentPreviewArea = UIUtils.createElement('div', {
            classList: ['attachment-preview-area'],
            style: { display: 'none' }
        });
        
        // 要素を追加
        chatInputContainer.appendChild(fileInput);
        
        // 入力ボタングループに添付ボタンを追加
        const inputButtonGroup = chatInputContainer.querySelector('.input-button-group');
        if (inputButtonGroup) {
            const sendButton = inputButtonGroup.querySelector('.send-button');
            if (sendButton) {
                inputButtonGroup.insertBefore(attachButton, sendButton);
            } else {
                inputButtonGroup.appendChild(attachButton);
            }
        } else {
            chatInputContainer.appendChild(attachButton);
        }
        
        // 添付ファイル表示エリアを追加
        chatInputContainer.insertBefore(
            attachmentPreviewArea, 
            inputButtonGroup || chatInputContainer.firstChild
        );
        
        return { fileInput, attachButton, attachmentPreviewArea };
    },

    /**
     * 添付ファイルのプレビューを表示します
     * 添付されたファイルのプレビューと削除ボタンを表示します
     * 
     * @function showAttachmentPreview
     * @memberof UI
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     * @param {File} file - 添付ファイル
     * @param {string} base64Data - Base64エンコードされたファイルデータ
     * @returns {void}
     */
    showAttachmentPreview: function(previewArea, file, base64Data) {
        if (!previewArea || !file) return;
        
        previewArea.innerHTML = '';
        previewArea.style.display = 'flex';
        
        // プレビュー要素の構築
        const children = [];
        
        // 画像プレビュー（画像ファイルの場合）
        if (file.type.startsWith('image/')) {
            children.push(UIUtils.createElement('img', {
                src: base64Data,
                alt: file.name,
                classList: ['attachment-preview-image']
            }));
        }
        
        // ファイル情報
        children.push(UIUtils.createElement('div', {
            classList: ['attachment-file-info'],
            textContent: file.name
        }));
        
        // 削除ボタン
        children.push(UIUtils.createElement('button', {
            classList: ['attachment-remove-button'],
            innerHTML: '<i class="fas fa-times"></i>',
            title: '添付を削除',
            events: {
                click: () => {
                    previewArea.innerHTML = '';
                    previewArea.style.display = 'none';
                    
                    // 添付ファイル削除イベントを発火
                    previewArea.dispatchEvent(new CustomEvent('attachment-removed'));
                }
            }
        }));
        
        // プレビュー項目を追加
        const previewItem = UIUtils.createElement('div', {
            classList: ['attachment-preview-item'],
            children
        });
        
        previewArea.appendChild(previewItem);
    },

    /**
     * 添付ファイルをクリアします
     * 添付ファイルのプレビュー表示を削除します
     * 
     * @function clearAttachments
     * @memberof UI
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     * @returns {void}
     */
    clearAttachments: function(previewArea) {
        if (previewArea) {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
        }
    }   
};

/**
 * パフォーマンス監視とエラー追跡機能
 * UI操作の実行時間監視とエラー処理を提供します
 * 
 * @namespace UIPerfMonitor
 * @private
 */
const UIPerfMonitor = {
    /**
     * 関数の実行時間を計測します
     * @param {Function} fn - 計測対象の関数
     * @param {string} name - 関数名（ログ用）
     * @returns {Function} 計測用にラップされた関数
     */
    measure: (fn, name) => {
        if (typeof fn !== 'function') return fn;
        
        return function(...args) {
            const start = performance.now();
            try {
                return fn.apply(this, args);
            } finally {
                const duration = performance.now() - start;
                if (duration > window.CONFIG.UI.PERFORMANCE_WARNING_THRESHOLD) {
                    console.log(`⚠️ ${name || 'UI操作'} の実行に ${duration.toFixed(2)}ms かかりました`);
                }
            }
        };
    },
    
    /**
     * エラーをキャッチして処理します
     * @param {Function} fn - エラーハンドリング対象の関数
     * @param {string} name - 関数名（ログ用）
     * @returns {Function} エラーハンドリング用にラップされた関数
     */
    safeExec: (fn, name) => {
        if (typeof fn !== 'function') return fn;
        
        return function(...args) {
            try {
                return fn.apply(this, args);
            } catch (error) {
                console.error(`🔴 ${name || 'UI操作'} でエラーが発生しました:`, error);
                // エラーを静かに処理して、アプリケーションのクラッシュを防止
                return null;
            }
        };
    }
};

// UIモジュールに追加機能を拡張
Object.assign(window.UI, {
    /**
     * テーマの切り替えを行います
     * ダークモード/ライトモードの切り替えとローカルストレージへの保存を行います
     * 
     * @function toggleTheme
     * @memberof UI
     * @param {boolean} [isDark] - 指定時：true=ダークモード、false=ライトモード。未指定時は現在の状態を反転
     * @returns {boolean} 設定後のダークモード状態（true=ダークモード）
     */
    toggleTheme: function(isDark) {
        const bodyEl = document.body;
        
        // 現在の状態を取得
        const currentIsDark = bodyEl.classList.contains('dark-theme');
        
        // 切り替え後の状態を決定
        const newIsDark = isDark !== undefined ? isDark : !currentIsDark;
        
        // テーマを適用
        if (newIsDark) {
            bodyEl.classList.add('dark-theme');
            bodyEl.classList.remove('light-theme');
        } else {
            bodyEl.classList.add('light-theme');
            bodyEl.classList.remove('dark-theme');
        }
        
        // 設定を保存
        try {
            localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
        } catch (e) {
            console.warn('テーマ設定の保存に失敗しました:', e);
        }
        
        return newIsDark;
    },
    
    /**
     * 保存されたテーマ設定を適用します
     * ローカルストレージから設定を読み込み、適用します。
     * システム設定の自動検出も行います。
     * 
     * @function applyTheme
     * @memberof UI
     * @returns {void}
     */
    applyTheme: function() {
        try {
            // 保存された設定を取得
            const savedTheme = localStorage.getItem('theme');
            
            if (savedTheme) {
                // 保存された設定があれば適用
                this.toggleTheme(savedTheme === 'dark');
            } else {
                // なければシステム設定を検出
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.toggleTheme(prefersDark);
                
                // システム設定の変更を監視
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    // 保存された設定がなければシステム設定の変更に追従
                    if (!localStorage.getItem('theme')) {
                        this.toggleTheme(e.matches);
                    }
                });
            }
        } catch (e) {
            console.warn('テーマ設定の適用に失敗しました:', e);
        }
    },
    
    /**
     * 通知を表示します
     * 一時的な情報やフィードバックをトースト通知として表示します
     * 
     * @function notify
     * @memberof UI
     * @param {string} message - 表示するメッセージ
     * @param {string} [type='info'] - 通知の種類（'info', 'success', 'warning', 'error'）
     * @param {number} [duration=3000] - 表示時間（ミリ秒）
     * @returns {HTMLElement} 作成された通知要素
     */
    notify: function(message, type = 'info', duration = 3000) {
        if (!message) return null;
        
        // 通知コンテナを取得または作成
        let notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            notificationContainer = UIUtils.createElement('div', {
                classList: ['notification-container']
            });
            document.body.appendChild(notificationContainer);
        }
        
        // アイコンを決定
        const icons = {
            info: '<i class="fas fa-info-circle"></i>',
            success: '<i class="fas fa-check-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            error: '<i class="fas fa-times-circle"></i>'
        };
        
        // 通知要素を作成
        const notification = UIUtils.createElement('div', {
            classList: ['notification', `notification-${type}`],
            innerHTML: `${icons[type] || icons.info} <span>${message}</span>`
        });
        
        // 閉じるボタン
        const closeButton = UIUtils.createElement('button', {
            classList: ['notification-close'],
            innerHTML: '<i class="fas fa-times"></i>',
            events: {
                click: () => this._removeNotification(notification)
            }
        });
        
        notification.appendChild(closeButton);
        notificationContainer.appendChild(notification);
        
        // アニメーション
        setTimeout(() => notification.classList.add('show'), 10);
        
        // 自動的に閉じる
        if (duration > 0) {
            setTimeout(() => this._removeNotification(notification), duration);
        }
        
        return notification;
    },
    
    /**
     * 通知を削除します
     * 指定された通知要素をアニメーション付きで削除します
     * 
     * @function _removeNotification
     * @memberof UI
     * @param {HTMLElement} notification - 削除する通知要素
     * @returns {void}
     * @private
     */
    _removeNotification: function(notification) {
        if (!notification) return;
        
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300); // フェードアウトアニメーションの時間
    },
    
    /**
     * 確認ダイアログを表示します
     * ユーザーに確認を求めるモーダルダイアログを表示します
     * 
     * @function confirm
     * @memberof UI
     * @param {string} message - 表示するメッセージ
     * @param {Object} [options] - オプション
     * @param {string} [options.title='確認'] - ダイアログのタイトル
     * @param {string} [options.confirmText='OK'] - 確認ボタンのテキスト
     * @param {string} [options.cancelText='キャンセル'] - キャンセルボタンのテキスト
     * @returns {Promise<boolean>} ユーザーの選択（true=確認、false=キャンセル）
     */
    confirm: function(message, options = {}) {
        return new Promise(resolve => {
            const title = options.title || '確認';
            const confirmText = options.confirmText || 'OK';
            const cancelText = options.cancelText || 'キャンセル';
            
            // 既存のダイアログを削除
            const existingDialog = document.querySelector('.custom-confirm-dialog');
            if (existingDialog) {
                document.body.removeChild(existingDialog);
            }
            
            // ダイアログ作成
            const dialog = UIUtils.createElement('div', {
                classList: ['modal', 'custom-confirm-dialog']
            });
            
            // ダイアログコンテンツ
            const dialogContent = UIUtils.createElement('div', {
                classList: ['modal-content']
            });
            
            // ヘッダー
            const header = UIUtils.createElement('div', {
                classList: ['modal-header'],
                innerHTML: `<h2>${title}</h2>`
            });
            
            // メッセージ
            const body = UIUtils.createElement('div', {
                classList: ['modal-body'],
                innerHTML: `<p>${message}</p>`
            });
            
            // ボタンエリア
            const footer = UIUtils.createElement('div', {
                classList: ['modal-footer']
            });
            
            // キャンセルボタン
            const cancelButton = UIUtils.createElement('button', {
                classList: ['modal-button', 'cancel-button'],
                textContent: cancelText,
                events: {
                    click: () => {
                        dialog.classList.remove('show');
                        setTimeout(() => {
                            document.body.removeChild(dialog);
                            resolve(false);
                        }, 300);
                    }
                }
            });
            
            // 確認ボタン
            const confirmButton = UIUtils.createElement('button', {
                classList: ['modal-button', 'confirm-button'],
                textContent: confirmText,
                events: {
                    click: () => {
                        dialog.classList.remove('show');
                        setTimeout(() => {
                            document.body.removeChild(dialog);
                            resolve(true);
                        }, 300);
                    }
                }
            });
            
            // 構造を組み立て
            footer.appendChild(cancelButton);
            footer.appendChild(confirmButton);
            
            dialogContent.appendChild(header);
            dialogContent.appendChild(body);
            dialogContent.appendChild(footer);
            
            dialog.appendChild(dialogContent);
            document.body.appendChild(dialog);
            
            // アニメーション
            setTimeout(() => dialog.classList.add('show'), 10);
            
            // フォーカスを設定
            confirmButton.focus();
            
            // ESCキーでキャンセル
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeyDown);
                    cancelButton.click();
                } else if (e.key === 'Enter') {
                    document.removeEventListener('keydown', handleKeyDown);
                    confirmButton.click();
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
        });
    },
    
    /**
     * アクセシビリティを向上させる機能を設定します
     * キーボードショートカットや支援技術に関する設定を行います
     * 
     * @function setupAccessibility
     * @memberof UI
     * @returns {void}
     */
    setupAccessibility: function() {
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter/Cmd+Enterでメッセージ送信
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.click();
                }
            }
            
            // Ctrl+/で新しいチャット
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                const newChatButton = document.getElementById('newChatButton');
                if (newChatButton) {
                    newChatButton.click();
                }
            }
            
            // Escでモーダルを閉じる（すでに実装済み）
        });
        
        // スクリーンリーダー用のARIA属性を設定
        document.querySelectorAll('.message.bot').forEach(message => {
            message.setAttribute('role', 'region');
            message.setAttribute('aria-label', 'AIからの返答');
        });
        
        document.querySelectorAll('.message.user').forEach(message => {
            message.setAttribute('role', 'region');
            message.setAttribute('aria-label', 'あなたのメッセージ');
        });
    },
    
    /**
     * UIのタッチデバイス向け最適化を行います
     * スマートフォンやタブレット向けの操作性を向上させます
     * 
     * @function optimizeForTouchDevices
     * @memberof UI
     * @returns {void}
     */
    optimizeForTouchDevices: function() {
        // タッチデバイスの検出
        const isTouchDevice = 'ontouchstart' in window || 
            navigator.maxTouchPoints > 0 || 
            navigator.msMaxTouchPoints > 0;
            
        if (isTouchDevice) {
            document.body.classList.add('touch-device');
            
            // タッチフレンドリーなUIに調整
            document.querySelectorAll('.history-item-actions button').forEach(button => {
                button.style.padding = '8px 12px';
            });
            
            // スワイプジェスチャーの追加
            this._setupSwipeGestures();
        }
    },
    
    /**
     * スワイプジェスチャーのサポートを設定します
     * サイドバーやチャット履歴の操作をスワイプで行えるようにします
     * 
     * @function _setupSwipeGestures
     * @memberof UI
     * @returns {void}
     * @private
     */
    _setupSwipeGestures: function() {
        let startX, startY, distX, distY;
        const threshold = 100; // スワイプと認識する最小距離
        
        // スワイプ開始
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        // スワイプ終了
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            distX = e.changedTouches[0].clientX - startX;
            distY = e.changedTouches[0].clientY - startY;
            
            // 水平方向のスワイプ
            if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > threshold) {
                // サイドバーエリアの判定
                const chatContainer = document.querySelector('.chat-container');
                const sidebar = document.querySelector('.sidebar');
                
                if (!chatContainer || !sidebar) return;
                
                if (e.target.closest('.chat-container')) {
                    if (distX > 0) {
                        // 右スワイプ → サイドバーを表示
                        sidebar.classList.add('show');
                    }
                } else if (e.target.closest('.sidebar')) {
                    if (distX < 0) {
                        // 左スワイプ → サイドバーを非表示（モバイル時）
                        if (window.innerWidth <= window.CONFIG.UI.MOBILE_BREAKPOINT) {
                            sidebar.classList.remove('show');
                        }
                    }
                }
            }
            
            // 変数をリセット
            startX = startY = null;
        }, { passive: true });
    }
});

// UI最適化の追加拡張
(() => {
    // 既存UI関数のさらなる効率化
    const ui = window.UI;
    
    /**
     * ページロード時の初期化処理
     * アプリケーション起動時に自動的に実行する初期化処理をまとめます
     * 
     * @function initialize
     * @memberof UI
     */
    ui.initialize = function() {
        // テーマ設定を適用
        this.applyTheme();
        
        // アクセシビリティを設定
        this.setupAccessibility();
        
        // タッチデバイス向け最適化
        this.optimizeForTouchDevices();
        
        // サイドバートグルボタンを作成
        this.createSidebarToggle();
        
        // UIパフォーマンス最適化
        this._optimizeUI();
    };
    
    /**
     * UIのパフォーマンスを最適化します
     * 不要なレンダリングを減らし、応答性を向上させる設定を行います
     * 
     * @function _optimizeUI
     * @memberof UI
     * @private
     */
    ui._optimizeUI = function() {
        // リサイズイベントの最適化（デバウンス処理）
        const resizeHandler = (() => {
            let resizeTimeout;
            return () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    // サイドバーのモバイル表示調整
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar && window.innerWidth > 576) {
                        sidebar.classList.remove('show');
                    }
                    
                    // その他のレスポンシブ調整があれば追加
                }, 100);
            };
        })();
        
        window.addEventListener('resize', resizeHandler, { passive: true });
        
        // スクロール最適化（スロットル処理）
        let scrollTicking = false;
        document.addEventListener('scroll', () => {
            if (!scrollTicking) {
                window.requestAnimationFrame(() => {
                    // スクロール時の処理（パフォーマンスに影響する処理がある場合）
                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        }, { passive: true });
        
        // 非同期読み込みでパフォーマンス向上
        this._lazyLoadResources();
    };
    
    /**
     * 非同期にリソースを読み込みます
     * パフォーマンスを向上させるためにリソースを遅延読み込みします
     * 
     * @function _lazyLoadResources
     * @memberof UI
     * @private
     */
    ui._lazyLoadResources = function() {
        // アイコンフォントの遅延読み込み
        setTimeout(() => {
            const fontAwesome = document.createElement('link');
            fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
            fontAwesome.rel = 'stylesheet';
            document.head.appendChild(fontAwesome);
        }, 500);
    };
    
    /**
     * チャットメッセージエリアのスクロール位置を調整します
     * 新しいメッセージが表示されたときにスムーズにスクロールします
     * 
     * @function scrollChatToBottom
     * @memberof UI
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @param {boolean} smooth - スムーズスクロールを使用するか
     */
    ui.scrollChatToBottom = function(chatMessages, smooth = true) {
        if (!chatMessages) return;
        
        // スクロール位置を下部に設定
        if (smooth && 'scrollBehavior' in document.documentElement.style) {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    };
    
    /**
     * 共有機能を実装します
     * チャット会話の内容をコピーまたは共有するための機能です
     * 
     * @function shareConversation
     * @memberof UI
     * @param {Object} conversation - 共有する会話オブジェクト
     * @returns {Promise<boolean>} 共有操作の結果
     */
    ui.shareConversation = async function(conversation) {
        if (!conversation || !conversation.messages) {
            this.notify('共有する会話がありません', 'error');
            return false;
        }
        
        try {
            // 会話内容をテキスト形式に変換
            let text = `# ${conversation.title || '会話'}\n\n`;
            
            conversation.messages.forEach(msg => {
                if (msg.role === 'system') return;
                
                const roleLabel = msg.role === 'user' ? '👤 ユーザー' : '🤖 AI';
                text += `## ${roleLabel}\n\n${msg.content}\n\n`;
            });
            
            // Web Share APIが利用可能な場合
            if (navigator.share) {
                await navigator.share({
                    title: conversation.title || 'AI会話',
                    text: text
                });
                this.notify('会話を共有しました', 'success');
                return true;
            }
            
            // Web Share APIが利用できない場合はクリップボードにコピー
            await navigator.clipboard.writeText(text);
            this.notify('会話をクリップボードにコピーしました', 'success');
            return true;
        } catch (error) {
            console.error('共有処理中にエラーが発生しました:', error);
            this.notify('共有できませんでした', 'error');
            return false;
        }
    };
    
    /**
     * メッセージ入力欄のサイズ調整機能を強化します
     * より自然な入力体験のためにテキストエリアのサイズを動的に調整します
     * 
     * @function enhanceTextarea
     * @memberof UI
     * @param {HTMLTextAreaElement} textarea - 対象のテキストエリア要素
     */
    ui.enhanceTextarea = function(textarea) {
        if (!textarea) return;
        
        // 最大高さの設定
        const maxHeight = window.innerHeight * window.CONFIG.UI.TEXTAREA_MAX_HEIGHT_RATIO;
        
        // 自動リサイズの設定
        const resize = () => {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, maxHeight);
            textarea.style.height = `${newHeight}px`;
            
            // スクロールが必要な場合は overflow を設定
            textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
        };
        
        // イベントリスナーを設定
        textarea.addEventListener('input', resize);
        textarea.addEventListener('focus', resize);
        
        // 初期サイズ調整
        resize();
        
        // プレースホルダーテキストの動的設定
        this._updateTextareaPlaceholder(textarea);
        
        // コマンド入力サポート（例: /help、/new）
        textarea.addEventListener('keyup', (e) => {
            // コマンド入力検出（最初のスラッシュから始まる場合）
            if (e.target.value.trim().startsWith('/')) {
                this._handleCommandInput(textarea);
            }
        });
    };
    
    /**
     * テキストエリアのプレースホルダーテキストを更新します
     * 画面サイズやデバイスに応じて適切なプレースホルダーを設定します
     * 
     * @function _updateTextareaPlaceholder
     * @memberof UI
     * @param {HTMLTextAreaElement} textarea - 対象のテキストエリア要素
     * @private
     */
    ui._updateTextareaPlaceholder = function(textarea) {
        if (!textarea) return;
        
        // デバイスに応じてプレースホルダーを変更
        const isMobile = window.innerWidth <= window.CONFIG.UI.MOBILE_BREAKPOINT;
        const defaultPlaceholder = 'メッセージを入力...';
        const mobilePlaceholder = '入力...';
        
        textarea.placeholder = isMobile ? mobilePlaceholder : defaultPlaceholder;
        
        // 画面サイズ変更時にプレースホルダーを更新
        window.addEventListener('resize', () => {
            const isCurrentlyMobile = window.innerWidth <= window.CONFIG.UI.MOBILE_BREAKPOINT;
            if (isCurrentlyMobile !== isMobile) {
                textarea.placeholder = isCurrentlyMobile ? mobilePlaceholder : defaultPlaceholder;
            }
        }, { passive: true });
    };
    
    /**
     * コマンド入力を処理します
     * テキストエリアでのコマンド入力（/で始まる）を処理します
     * 
     * @function _handleCommandInput
     * @memberof UI
     * @param {HTMLTextAreaElement} textarea - 対象のテキストエリア要素
     * @private
     */
    ui._handleCommandInput = function(textarea) {
        if (!textarea) return;
        
        const input = textarea.value.trim();
        
        // コマンド入力でない場合は処理しない
        if (!input.startsWith('/')) return;
        
        // コマンドの候補
        const commands = {
            '/new': '新しいチャットを開始',
            '/clear': 'チャット履歴をクリア',
            '/help': 'ヘルプを表示',
            '/theme': 'テーマを切り替え'
        };
        
        // コマンドサジェストの表示
        // 実際の実装では、ドロップダウンやツールチップでサジェストを表示する
        console.log('コマンド入力検出:', input);
    };
    
    /**
     * プロンプトマネージャーモーダルを表示する
     * @function showPromptManagerModal
     * @memberof UI
     */
    ui.showPromptManagerModal = function() {
        console.log('プロンプトマネージャーモーダルを表示します');
        const modal = document.getElementById('promptManagerModal');
        if (!modal) {
            console.error('モーダル要素が見つかりません: promptManagerModal');
            return;
        }
        
        // モーダル表示
        modal.style.display = 'block';
        
        // カテゴリとプロンプト一覧を更新
        this.updatePromptCategories();
        this.updatePromptsList();
        
        // デバッグログ
        console.log('プロンプトマネージャーモーダルを表示しました');
        console.log('カテゴリ要素:', document.getElementById('promptCategoriesList'));
        console.log('プロンプト一覧要素:', document.getElementById('promptsList'));
    };
    
    /**
     * プロンプトマネージャーモーダルを非表示にする
     * @function hidePromptManagerModal
     * @memberof UI
     */
    ui.hidePromptManagerModal = function() {
        console.log('プロンプトマネージャーモーダルを閉じます');
        const modal = document.getElementById('promptManagerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    /**
     * プロンプトカテゴリ一覧を更新する
     * @function updatePromptCategories
     * @memberof UI
     */
    ui.updatePromptCategories = function() {
        console.log('カテゴリ一覧を更新します');
        const categoriesList = document.getElementById('promptCategoriesList');
        if (!categoriesList) {
            console.error('カテゴリリスト要素が見つかりません: promptCategoriesList');
            return;
        }
        
        // カテゴリリストをクリア
        categoriesList.innerHTML = '';
        
        // カテゴリを読み込む
        const categories = window.PromptManager.loadCategories();
        console.log('読み込まれたカテゴリ:', categories);
        
        // カテゴリを並び替え
        const sortedCategories = Object.entries(categories)
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
        
        // カテゴリごとにリスト項目を作成
        sortedCategories.forEach(([key, category]) => {
            // カテゴリ項目
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            if (key === 'all') {
                categoryItem.classList.add('active'); // 「全体」カテゴリを初期選択状態に
            }
            categoryItem.dataset.category = key;
            
            // カテゴリ名とカウントを含むコンテナ
            const nameContainer = document.createElement('div');
            nameContainer.className = 'category-name-container';
            nameContainer.innerHTML = `
                <span>${category.name}</span>
                <span class="category-count">0</span>
            `;
            
            // アクションボタン
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'category-actions';
            
            if (key !== 'all' && key !== 'general') {
                const editButton = document.createElement('button');
                editButton.className = 'category-edit-button';
                editButton.innerHTML = '<i class="fas fa-edit"></i>';
                editButton.title = 'カテゴリを編集';
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._editCategory(key, category.name);
                });
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'category-delete-button';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = 'カテゴリを削除';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._deleteCategory(key);
                });
                
                actionsContainer.appendChild(editButton);
                actionsContainer.appendChild(deleteButton);
            }
            
            categoryItem.appendChild(nameContainer);
            categoryItem.appendChild(actionsContainer);
            
            // クリックイベント（カテゴリの選択）
            nameContainer.addEventListener('click', () => {
                console.log('カテゴリがクリックされました:', key);
                document.querySelectorAll('.category-item.active').forEach(item => {
                    item.classList.remove('active');
                });
                
                categoryItem.classList.add('active');
                // カテゴリをクリックしたときにカウントを更新し、プロンプト一覧も更新
                this._updateCategoryCounts();
                this.updatePromptsList({ category: key });
            });
            
            categoriesList.appendChild(categoryItem);
        });

        // 初期表示時のカウントとプロンプト一覧を更新
        this._updateCategoryCounts();
        this.updatePromptsList({ category: 'all' });
        
        console.log('カテゴリ一覧の更新が完了しました');
    };
    /**
     * プロンプト一覧を更新する
     * @function updatePromptsList
     * @memberof UI
     * @param {Object} [filter] - フィルタリング条件
     */
    ui.updatePromptsList = function(filter = {}) {
        console.log('プロンプト一覧を更新します', filter);
        const promptsList = document.getElementById('promptsList');
        if (!promptsList) {
            console.error('プロンプトリスト要素が見つかりません: promptsList');
            return;
        }
        
        // プロンプトリストをクリア
        promptsList.innerHTML = '';
        
        // 検索条件でプロンプトを取得
        const prompts = window.PromptManager.searchPrompts(filter);
        console.log('検索結果:', prompts);
        
        if (prompts.length === 0) {
            promptsList.innerHTML = '<div class="no-prompts-message">プロンプトが見つかりません</div>';
            return;
        }
        
        // 日付でソート（新しい順）
        prompts.sort((a, b) => b.updatedAt - a.updatedAt);
        
        // プロンプトごとにリスト項目を作成
        prompts.forEach(prompt => {
            const promptItem = document.createElement('div');
            promptItem.className = 'prompt-item';
            promptItem.dataset.promptId = prompt.id;
            
            // プロンプト項目のHTMLを構築
            promptItem.innerHTML = `
                <div class="prompt-item-header">
                    <span class="prompt-item-name">${prompt.name}</span>
                    <div class="prompt-item-actions">
                        <button class="edit-prompt-button" title="編集">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="use-prompt-button" title="プロンプトを使用">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button class="system-prompt-button" title="システムプロンプトとして設定">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="template-save-button" title="テンプレートとして保存">
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="delete-prompt-button" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="prompt-item-description">${prompt.description || ''}</div>
                <div class="prompt-item-tags">
                    ${prompt.tags.map(tag => `<span class="prompt-tag">${tag}</span>`).join('')}
                </div>
            `;
            
            // イベントリスナーの設定
            this._setupPromptItemEventListeners(promptItem, prompt);
            
            promptsList.appendChild(promptItem);
        });
        
        console.log('プロンプト一覧の更新が完了しました');
    };
    
    /**
     * プロンプト項目のイベントリスナーを設定する
     * @function _setupPromptItemEventListeners
     * @memberof UI
     * @param {HTMLElement} promptItem - プロンプト項目要素
     * @param {Object} prompt - プロンプトデータ
     * @private
     */
    ui._setupPromptItemEventListeners = function(promptItem, prompt) {
        // 編集ボタンのイベント
        promptItem.querySelector('.edit-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('編集ボタンがクリックされました:', prompt.id);
            this.showPromptEditModal(prompt);
        });
        
        // 使用ボタンのイベント
        promptItem.querySelector('.use-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('使用ボタンがクリックされました:', prompt.id);
            this._usePrompt(prompt.id);
        });
        
        // システムプロンプトとして設定するボタンのイベント
        promptItem.querySelector('.system-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('システムプロンプト設定ボタンがクリックされました:', prompt.id);
            this._setAsSystemPrompt(prompt.id);
        });
        
        // テンプレートとして保存ボタンのイベント
        promptItem.querySelector('.template-save-button').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('テンプレート保存ボタンがクリックされました:', prompt.id);
            this._saveAsTemplate(prompt.id);
        });
        
        // 削除ボタンのイベント
        promptItem.querySelector('.delete-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('削除ボタンがクリックされました:', prompt.id);
            this._deletePrompt(prompt.id);
        });
        
        // 項目クリック時に編集モーダルを表示
        promptItem.addEventListener('click', () => {
            console.log('プロンプト項目がクリックされました:', prompt.id);
            this.showPromptEditModal(prompt);
        });
    };
    
    /**
     * プロンプトを使用する
     * @function _usePrompt
     * @memberof UI
     * @param {string} promptId - 使用するプロンプトのID
     * @private
     */
    ui._usePrompt = function(promptId) {
        try {
            console.log('プロンプトを使用します:', promptId);
            // プロンプトを構築
            const promptText = window.PromptManager.buildPrompt(promptId);
            
            // ユーザー入力欄に挿入
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = promptText;
                this.autoResizeTextarea(userInput);
            }
            
            // プロンプトマネージャーモーダルを閉じる
            this.hidePromptManagerModal();
            
            // 通知
            this.notify('プロンプトをセットしました', 'success');
        } catch (error) {
            console.error('プロンプト使用中にエラーが発生しました:', error);
            this.notify('プロンプトの使用に失敗しました', 'error');
        }
    };
    
    /**
     * プロンプトを削除する
     * @function _deletePrompt
     * @memberof UI
     * @param {string} promptId - 削除するプロンプトのID
     * @private
     */
    ui._deletePrompt = function(promptId) {
        console.log('プロンプト削除処理を開始します:', promptId);
        if (confirm('このプロンプトを削除してもよろしいですか？')) {
            try {
                const result = window.PromptManager.deletePrompt(promptId);
                if (result) {
                    this.notify('プロンプトを削除しました', 'success');
                    
                    // プロンプト一覧を更新
                    const activeCategory = document.querySelector('.category-item.active');
                    
                    const filter = {};
                    if (activeCategory) {
                        filter.category = activeCategory.dataset.category;
                    }
                    
                    this.updatePromptsList(filter);
                    this._updateCategoryCounts();
                } else {
                    this.notify('プロンプトの削除に失敗しました', 'error');
                }
            } catch (error) {
                console.error('プロンプト削除中にエラーが発生しました:', error);
                this.notify('エラー: ' + error.message, 'error');
            }
        }
    };
    
    /**
     * プロンプト編集モーダルを表示する
     * @function showPromptEditModal
     * @memberof UI
     * @param {Object|null} prompt - 編集するプロンプト（新規作成の場合はnull）
     */
    ui.showPromptEditModal = function(prompt = null) {
        console.log('プロンプト編集モーダルを表示します', prompt);
        const isNewPrompt = !prompt;
        
        // 必要な要素を取得
        const modal = document.getElementById('promptEditModal');
        const modalTitle = document.getElementById('promptEditTitle');
        const nameInput = document.getElementById('promptNameInput');
        const categorySelect = document.getElementById('promptCategorySelect');
        const tagsInput = document.getElementById('promptTagsInput');
        const descriptionInput = document.getElementById('promptDescriptionInput');
        const contentInput = document.getElementById('promptContentInput');
        
        if (!modal || !modalTitle || !nameInput || !categorySelect || 
            !tagsInput || !descriptionInput || !contentInput) {
            console.error('プロンプト編集モーダルの要素が見つかりません');
            return;
        }
        
        // モーダルタイトルを設定
        modalTitle.textContent = isNewPrompt ? '新規プロンプト作成' : 'プロンプト編集';
        
        // カテゴリオプションを設定
        this._updateCategoryOptions(categorySelect);
        
        if (isNewPrompt) {
            // 新規プロンプトの場合はフォームをクリア
            nameInput.value = '';
            categorySelect.value = 'general';
            tagsInput.value = '';
            descriptionInput.value = '';
            contentInput.value = '';
            
            // プロンプトIDを削除
            delete modal.dataset.promptId;
        } else {
            // 既存プロンプトの場合はフォームに値をセット
            nameInput.value = prompt.name || '';
            categorySelect.value = prompt.category || 'general';
                        
            tagsInput.value = prompt.tags ? prompt.tags.join(', ') : '';
            descriptionInput.value = prompt.description || '';
            contentInput.value = prompt.content || '';
            
            // プロンプトIDを保存
            modal.dataset.promptId = prompt.id;
        }
        
        // カテゴリ変更時のイベントリスナー
        categorySelect.onchange = () => {

        };
        
        // モーダルを表示
        modal.style.display = 'block';
        console.log('プロンプト編集モーダルを表示しました');
    };
    
    /**
     * プロンプト編集モーダルを非表示にする
     * @function hidePromptEditModal
     * @memberof UI
     */
    ui.hidePromptEditModal = function() {
        console.log('プロンプト編集モーダルを閉じます');
        const modal = document.getElementById('promptEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    /**
     * プロンプト編集内容を保存する
     * @function savePromptChanges
     * @memberof UI
     */
    ui.savePromptChanges = function() {
        console.log('プロンプト変更を保存します');
        
        // 必要な要素を取得
        const modal = document.getElementById('promptEditModal');
        const nameInput = document.getElementById('promptNameInput');
        const categorySelect = document.getElementById('promptCategorySelect');
        const tagsInput = document.getElementById('promptTagsInput');
        const descriptionInput = document.getElementById('promptDescriptionInput');
        const contentInput = document.getElementById('promptContentInput');
        
        if (!modal || !nameInput || !categorySelect || 
            !tagsInput || !descriptionInput || !contentInput) {
            console.error('プロンプト編集モーダルの要素が見つかりません');
            return;
        }
        
        // 入力値を取得
        const name = nameInput.value.trim();
        const category = categorySelect.value;
        const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
        const description = descriptionInput.value.trim();
        const content = contentInput.value.trim();
        
        // 名前とコンテンツは必須
        if (!name || !content) {
            this.notify('名前とプロンプト内容は必須です', 'error');
            return;
        }
        
        try {
            const promptId = modal.dataset.promptId;
            
            if (promptId) {
                // 既存プロンプトの更新
                console.log('既存プロンプトを更新します:', promptId);
                const result = window.PromptManager.updatePrompt(promptId, {
                    name,
                    category,
                    tags,
                    description,
                    content
                });
                
                if (result) {
                    this.notify('プロンプトを更新しました', 'success');
                } else {
                    this.notify('プロンプトの更新に失敗しました', 'error');
                }
            } else {
                // 新規プロンプトの追加
                console.log('新規プロンプトを追加します');
                const newPromptId = window.PromptManager.addPrompt({
                    name,
                    category,
                    tags,
                    description,
                    content
                });
                
                if (newPromptId) {
                    this.notify('新規プロンプトを作成しました', 'success');
                } else {
                    this.notify('プロンプトの作成に失敗しました', 'error');
                }
            }
            
            // モーダルを閉じる
            this.hidePromptEditModal();
            
            // プロンプト一覧を更新
            const activeCategory = document.querySelector('.category-item.active');
            
            const filter = {};
            if (activeCategory) {
                filter.category = activeCategory.dataset.category;
            }
            
            this.updatePromptsList(filter);
            this._updateCategoryCounts();
            
        } catch (error) {
            console.error('プロンプト保存中にエラーが発生しました:', error);
            this.notify('エラー: ' + error.message, 'error');
        }
    };
    
    /**
     * プロンプト編集内容をキャンセルする
     * @function cancelPromptEdit
     * @memberof UI
     */
    ui.cancelPromptEdit = function() {
        console.log('プロンプト編集をキャンセルします');
        this.hidePromptEditModal();
    };
    
    /**
     * プロンプト編集内容をクリアする
     * @function clearPromptEdit
     * @memberof UI
     */
    ui.clearPromptEdit = function() {
        console.log('プロンプト編集内容をクリアします');
        
        // 必要な要素を取得
        const modal = document.getElementById('promptEditModal');
        const nameInput = document.getElementById('promptNameInput');
        const categorySelect = document.getElementById('promptCategorySelect');
        const tagsInput = document.getElementById('promptTagsInput');
        const descriptionInput = document.getElementById('promptDescriptionInput');
        const contentInput = document.getElementById('promptContentInput');
        
        if (!modal || !nameInput || !categorySelect || 
            !tagsInput || !descriptionInput || !contentInput) {
            console.error('プロンプト編集モーダルの要素が見つかりません');
            return;
        }
        
        // フォームをクリア
        nameInput.value = '';
        categorySelect.value = 'general';
        tagsInput.value = '';
        descriptionInput.value = '';
        contentInput.value = '';
        
        // モーダルを閉じる
        this.hidePromptEditModal();
    };
    
    /**
     * カテゴリごとのプロンプト数を更新する
     * @function _updateCategoryCounts
     * @memberof UI
     * @private
     */
    ui._updateCategoryCounts = function() {
        console.log('カテゴリごとのプロンプト数を更新します');
        const categories = document.querySelectorAll('.category-item');
        if (!categories.length) {
            console.error('カテゴリ要素が見つかりません');
            return;
        }
        
        // プロンプトライブラリを取得
        const prompts = window.PromptManager.loadPromptLibrary();
        console.log('プロンプトライブラリを読み込みました:', prompts.length, '件');
        
        // カテゴリごとのカウントを集計
        const counts = {
            'all': prompts.length // 「全体」カテゴリのカウントを追加
        };
        
        // 各カテゴリのカウントを計算
        prompts.forEach(prompt => {
            if (!prompt.category) return;
            counts[prompt.category] = (counts[prompt.category] || 0) + 1;
        });
        
        // カテゴリ要素のカウンタを更新
        categories.forEach(categoryEl => {
            const categoryKey = categoryEl.dataset.category;
            if (!categoryKey) return;
            
            const countEl = categoryEl.querySelector('.category-count');
            if (countEl) {
                countEl.textContent = counts[categoryKey] || 0;
            }
        });
        
        console.log('カテゴリカウントを更新しました', counts);
    };
    
    /**
     * カテゴリとの選択肢を更新する
     * @function _updateCategoryOptions
     * @memberof UI
     * @param {HTMLSelectElement} categorySelect - カテゴリ選択要素
     * @private
     */
    ui._updateCategoryOptions = function(categorySelect) {
        console.log('カテゴリオプションを更新します');
        if (!categorySelect) {
            console.error('カテゴリ選択要素が見つかりません');
            return;
        }
        
        // カテゴリ選択肢をクリア
        categorySelect.innerHTML = '';
        
        // カテゴリを取得
        const categories = window.PromptManager.loadCategories();
        console.log('カテゴリを読み込みました:', categories);
        
        // カテゴリを並び替え
        const sortedCategories = Object.entries(categories)
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
            .filter(([key]) => key !== 'all'); // 「全体」カテゴリを除外        
        // カテゴリオプションを作成
        sortedCategories.forEach(([key, category]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
                
        console.log('カテゴリオプションの更新が完了しました');
    };
    
    /**
     * プロンプトをシステムプロンプトとして設定する
     * @function _setAsSystemPrompt
     * @memberof UI
     * @param {string} promptId - 設定するプロンプトのID
     * @private
     */
    ui._setAsSystemPrompt = function(promptId) {
        try {
            console.log('プロンプトをシステムプロンプトとして設定します:', promptId);
            // カスタム変数の取得（実際の実装ではユーザー入力を求めるなど）
            const customVariables = {};
            
            // プロンプトをシステムプロンプトとして設定
            const systemPrompt = window.PromptManager.setAsSystemPrompt(promptId, customVariables);
            
            // 通知
            this.notify('システムプロンプトを更新しました', 'success');
            
            // プロンプトマネージャーモーダルを閉じる
            this.hidePromptManagerModal();
            
            console.log('システムプロンプトを設定しました');
        } catch (error) {
            console.error('システムプロンプトの設定に失敗しました:', error);
            this.notify('システムプロンプトの設定に失敗しました', 'error');
        }
    };
    
    /**
     * プロンプトをテンプレートとして保存する
     * @function _saveAsTemplate
     * @memberof UI
     * @param {string} promptId - 保存するプロンプトのID
     * @private
     */
    ui._saveAsTemplate = function(promptId) {
        console.log('プロンプトをテンプレートとして保存します:', promptId);
        // テンプレート名の入力を求める
        const templateName = prompt('テンプレート名を入力してください:');
        if (!templateName) {
            console.log('テンプレート名が入力されなかったため、処理を中断します');
            return;
        }
        
        try {
            // テンプレートとして保存
            const success = window.PromptManager.saveAsSystemPromptTemplate(promptId, templateName);
            
            if (success) {
                this.notify(`テンプレート「${templateName}」を保存しました`, 'success');
                console.log('テンプレートを保存しました:', templateName);
            } else {
                this.notify('テンプレートの保存に失敗しました', 'error');
                console.error('テンプレートの保存に失敗しました');
            }
        } catch (error) {
            console.error('テンプレートの保存中にエラーが発生しました:', error);
            this.notify(`エラー: ${error.message}`, 'error');
        }
    };
    
    // プロンプトマネージャー関連のイベントをセットアップする
    ui.setupPromptManagerEvents = function() {
        
        // 閉じるボタン
        const closeButton = document.getElementById('closePromptManager');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                console.log('閉じるボタンがクリックされました');
                this.hidePromptManagerModal();
            });
        }
        
        // システムプロンプト設定へ切り替えボタン
        const switchToSystemPromptBtn = document.getElementById('switchToSystemPrompt');
        if (switchToSystemPromptBtn) {
            switchToSystemPromptBtn.addEventListener('click', () => {
                console.log('システムプロンプト設定へボタンがクリックされました');
                this.hidePromptManagerModal();
                
                // AppStateからシステムプロンプトとテンプレートを取得
                const systemPrompt = window.Storage.loadSystemPrompt();
                const promptTemplates = window.Storage.loadPromptTemplates();
                
                // システムプロンプトモーダルを表示
                this.showSystemPromptModal(
                    systemPrompt,
                    promptTemplates,
                    // テンプレート選択と削除のコールバック関数
                    (templateName) => {
                        const template = promptTemplates[templateName];
                        if (template) {
                            const systemPromptInput = document.getElementById('systemPromptInput');
                            if (systemPromptInput) {
                                systemPromptInput.value = template;
                            }
                        }
                    },
                    (templateName) => {
                        if (confirm(`テンプレート "${templateName}" を削除してもよろしいですか？`)) {
                            delete promptTemplates[templateName];
                            window.Storage.savePromptTemplates(promptTemplates);
                            this.updateTemplateList(promptTemplates, 
                                (tName) => {
                                    const template = promptTemplates[tName];
                                    if (template) {
                                        const systemPromptInput = document.getElementById('systemPromptInput');
                                        if (systemPromptInput) {
                                            systemPromptInput.value = template;
                                        }
                                    }
                                }, 
                                (tName) => {
                                    if (confirm(`テンプレート "${tName}" を削除してもよろしいですか？`)) {
                                        delete promptTemplates[tName];
                                        window.Storage.savePromptTemplates(promptTemplates);
                                        this.updateTemplateList(promptTemplates, null, null);
                                    }
                                }
                            );
                        }
                    }
                );
            });
        }
        
        // 新規プロンプトボタン
        const addPromptButton = document.getElementById('addPromptButton');
        if (addPromptButton) {
            addPromptButton.addEventListener('click', () => {
                console.log('新規プロンプトボタンがクリックされました');
                this.showPromptEditModal(); // 引数なしで呼び出すと新規プロンプト作成モード
            });
        }
        
        // カテゴリ追加ボタン
        const addCategoryButton = document.getElementById('addCategoryButton');
        if (addCategoryButton) {
            addCategoryButton.addEventListener('click', () => {
                console.log('カテゴリ追加ボタンがクリックされました');
                const categoryName = prompt('新しいカテゴリ名を入力してください:');
                if (categoryName && categoryName.trim()) {
                    try {
                        const result = window.PromptManager.addCategory(categoryName.trim());
                        if (result) {
                            this.notify('カテゴリを追加しました', 'success');
                            // プロンプトマネージャーモーダルを一度閉じて開き直す
                            this.hidePromptManagerModal();
                            this.showPromptManagerModal();
                        } else {
                            this.notify('カテゴリの追加に失敗しました', 'error');
                        }
                    } catch (error) {
                        console.error('カテゴリ追加中にエラーが発生しました:', error);
                        this.notify('エラー: ' + error.message, 'error');
                    }
                }
            });
        }
        
        // プロンプト検索入力欄
        const promptSearchInput = document.getElementById('promptSearchInput');
        if (promptSearchInput) {
            promptSearchInput.addEventListener('input', () => {
                console.log('プロンプト検索入力:', promptSearchInput.value);
                const searchText = promptSearchInput.value.trim();
                
                // カテゴリによるフィルタリング条件を取得
                const activeCategory = document.querySelector('.category-item.active');
                
                const filter = {
                    searchText: searchText
                };
                
                if (activeCategory) {
                    filter.category = activeCategory.dataset.category;
                }

                this.updatePromptsList(filter);
            });
        }
        
        // プロンプト編集モーダルの保存ボタン
        const savePromptEditButton = document.getElementById('savePromptEdit');
        if (savePromptEditButton) {
            savePromptEditButton.addEventListener('click', () => {
                console.log('保存ボタンがクリックされました');
                this.savePromptChanges();
            });
        }
        
        // プロンプト編集モーダルのキャンセルボタン
        const cancelPromptEditButton = document.getElementById('cancelPromptEdit');
        if (cancelPromptEditButton) {
            cancelPromptEditButton.addEventListener('click', () => {
                console.log('キャンセルボタンがクリックされました');
                this.hidePromptEditModal();
            });
        }
        
    };
    
    /**
     * プロンプト候補表示機能を初期化します
     * テキストエリアにスラッシュ(/)入力時の候補表示機能を追加します
     * 
     * @function initPromptSuggestions
     * @memberof UI
     */
    ui.initPromptSuggestions = function() {
        const userInput = document.getElementById('userInput');
        const promptSuggestions = document.getElementById('promptSuggestions');
        
        if (!userInput || !promptSuggestions) {
            console.error('プロンプト候補表示に必要な要素が見つかりません');
            return;
        }
        
        // プロンプト候補表示機能を初期化
        if (window.PromptSuggestions) {
            window.PromptSuggestions.init(userInput, promptSuggestions);
        } else {
            console.error('PromptSuggestionsモジュールが読み込まれていません');
        }
    };
    
    /**
     * カテゴリを編集する
     * @function _editCategory
     * @memberof UI
     * @param {string} categoryKey - カテゴリのキー
     * @param {string} currentName - 現在のカテゴリ名
     * @private
     */
    ui._editCategory = function(categoryKey, currentName) {
        console.log('カテゴリ編集を開始します:', categoryKey);
        const newName = prompt('新しいカテゴリ名を入力してください:', currentName);
        
        if (newName && newName.trim() && newName !== currentName) {
            try {
                const success = window.PromptManager.updateCategory(categoryKey, {
                    name: newName.trim()
                });
                
                if (success) {
                    this.notify('カテゴリ名を更新しました', 'success');
                    this.updatePromptCategories();
                } else {
                    this.notify('カテゴリの更新に失敗しました', 'error');
                }
            } catch (error) {
                console.error('カテゴリ更新中にエラーが発生しました:', error);
                this.notify('エラー: ' + error.message, 'error');
            }
        }
    };
    
    /**
     * カテゴリを削除する
     * @function _deleteCategory
     * @memberof UI
     * @param {string} categoryKey - 削除するカテゴリのキー
     * @private
     */
    ui._deleteCategory = function(categoryKey) {
        console.log('カテゴリ削除を開始します:', categoryKey);
        
        // 削除前の確認
        this.confirm(
            'このカテゴリを削除してもよろしいですか？\nこのカテゴリ内のプロンプトは「一般」カテゴリに移動されます。',
            {
                title: 'カテゴリの削除',
                confirmText: '削除',
                cancelText: 'キャンセル'
            }
        ).then(confirmed => {
            if (confirmed) {
                try {
                    const success = window.PromptManager.deleteCategory(categoryKey);
                    
                    if (success) {
                        this.notify('カテゴリを削除しました', 'success');
                        this.updatePromptCategories();
                    } else {
                        this.notify('カテゴリの削除に失敗しました', 'error');
                    }
                } catch (error) {
                    console.error('カテゴリ削除中にエラーが発生しました:', error);
                    this.notify('エラー: ' + error.message, 'error');
                }
            }
        });
    };
})();