/**
 * ui.js
 * UI関連の機能を提供するモジュール
 * 
 * サイドバー、モーダル、テンプレート、添付ファイルなどのUI要素と
 * 関連するインタラクションを管理します。
 */

// DOM要素をキャッシュするためのヘルパーオブジェクト
const UICache = {
    elements: {},
    
    /**
     * 要素を取得またはキャッシュから返します
     * @param {string} selector - CSS セレクタ
     * @param {boolean} useQuerySelector - true: querySelector, false: getElementById
     * @returns {HTMLElement} 取得した要素
     */
    get(selector, useQuerySelector = false) {
        if (!this.elements[selector]) {
            this.elements[selector] = useQuerySelector 
                ? document.querySelector(selector) 
                : document.getElementById(selector);
        }
        return this.elements[selector];
    },
    
    /**
     * キャッシュをクリアします
     */
    clear() {
        this.elements = {};
    }
};

// 共通ユーティリティ関数
const UIUtils = {
    /**
     * 要素の表示/非表示を切り替えます
     * @param {HTMLElement} element - 対象要素
     * @param {boolean} show - 表示するかどうか
     */
    toggleVisibility(element, show) {
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
    toggleModal(modalId, show) {
        const modal = UICache.get(modalId);
        if (show) {
            modal.classList.add('show');
        } else {
            modal.classList.remove('show');
        }
    },
    
    /**
     * 要素を作成して属性を設定します
     * @param {string} tag - HTML要素タグ名
     * @param {Object} props - 属性オブジェクト
     * @returns {HTMLElement} 作成された要素
     */
    createElement(tag, props = {}) {
        const element = document.createElement(tag);
        
        Object.entries(props).forEach(([key, value]) => {
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
                    element.addEventListener(event, handler);
                });
            } else if (key === 'children' && Array.isArray(value)) {
                value.forEach(child => {
                    if (child) element.appendChild(child);
                });
            } else {
                element[key] = value;
            }
        });
        
        return element;
    }
};

// グローバルスコープに関数を公開
window.UI = {
    /**
     * モバイル用のサイドバートグルボタンを作成します
     * 
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
     * サイドバーの状態をトグルします (プライベート関数)
     * 
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
     * 
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
     * 
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
     * 
     * @returns {void}
     */
    hideApiKeyModal: function() {
        UIUtils.toggleModal('apiKeyModal', false);
    },

    /**
     * Azure設定の表示/非表示を切り替えます
     * 
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
     * 
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
     * 
     * @returns {void}
     */
    hideRenameChatModal: function() {
        UIUtils.toggleModal('renameChatModal', false);
    },

    /**
     * システムプロンプト設定モーダルを表示します
     * 
     * @param {string} systemPrompt - 現在のシステムプロンプト
     * @param {Function} loadPromptTemplatesCallback - テンプレート読み込みコールバック関数
     * @returns {void}
     */
    showSystemPromptModal: function(systemPrompt, loadPromptTemplatesCallback) {
        UIUtils.toggleModal('systemPromptModal', true);
        UICache.get('systemPromptInput').value = systemPrompt;
        
        // テンプレートを非同期で読み込み
        if (typeof loadPromptTemplatesCallback === 'function') {
            setTimeout(loadPromptTemplatesCallback, 0);
        }
    },

    /**
     * システムプロンプト設定モーダルを非表示にします
     * 
     * @returns {void}
     */
    hideSystemPromptModal: function() {
        UIUtils.toggleModal('systemPromptModal', false);
    },

    /**
     * テンプレート一覧を表示します
     * 
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
        
        // デフォルトテンプレート
        const defaultTemplates = ['default', 'creative', 'technical'];
        
        // DocumentFragmentを使用してDOM操作を最適化
        const fragment = document.createDocumentFragment();
        
        // テンプレート項目を作成して追加
        Object.keys(promptTemplates).forEach(templateName => {
            const isDefault = defaultTemplates.includes(templateName);
            const item = this._createTemplateItem(templateName, isDefault, onTemplateSelect, onTemplateDelete);
            fragment.appendChild(item);
        });
        
        // 一度のDOM操作でフラグメントを追加
        templateListArea.appendChild(fragment);
    },

    /**
     * テンプレート項目要素を作成します (プライベート関数)
     * 
     * @param {string} templateName - テンプレート名
     * @param {boolean} isDefault - デフォルトテンプレートかどうか
     * @param {Function} onTemplateSelect - テンプレート選択時のコールバック関数
     * @param {Function} onTemplateDelete - テンプレート削除時のコールバック関数
     * @returns {HTMLElement} テンプレート項目要素
     * @private
     */
    _createTemplateItem: function(templateName, isDefault, onTemplateSelect, onTemplateDelete) {
        // 削除ボタン（デフォルトテンプレート以外のみ）
        const children = [
            UIUtils.createElement('span', {
                textContent: templateName,
                classList: ['template-name']
            })
        ];
        
        if (!isDefault) {
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
     * 
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
     * 
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
     * 
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