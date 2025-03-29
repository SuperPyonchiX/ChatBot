/**
 * ui.js
 * UI関連の機能を提供するモジュール
 * 
 * サイドバー、モーダル、テンプレート、添付ファイルなどのUI要素と
 * 関連するインタラクションを管理します。
 */

// UI管理のための名前空間
window.UI = (() => {
    /**
     * サイドバー関連機能
     */
    const sidebar = {
        /**
         * モバイル用のサイドバートグルボタンを作成します
         * 
         * @returns {void}
         */
        createSidebarToggle: () => {
            const sidebar = document.querySelector('.sidebar');
            const appContainer = document.querySelector('.app-container');
            
            // トグルボタンの表示エリアを作成
            const toggleArea = document.createElement('div');
            toggleArea.classList.add('sidebar-toggle-area');
            
            // トグルボタンを作成
            const toggleButton = document.createElement('button');
            toggleButton.classList.add('sidebar-toggle');
            toggleButton.innerHTML = '<i class="fas fa-bars"></i>';

            // 保存された状態を復元
            const isCollapsed = window.Storage.loadSidebarState();
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
            } else {
                toggleButton.classList.add('sidebar-visible');
            }
            
            toggleButton.addEventListener('click', () => {
                sidebar._toggleSidebarState(sidebar, toggleButton);
            });
            
            // チャットエリアのクリックでサイドバーを閉じる（モバイルのみ）
            document.querySelector('.chat-container').addEventListener('click', () => {
                sidebar._handleChatAreaClick(sidebar);
            });
            
            // ウィンドウサイズ変更時の処理
            window.addEventListener('resize', () => {
                sidebar._handleWindowResize(sidebar);
            });
            
            // トグルボタンを表示エリアに追加
            toggleArea.appendChild(toggleButton);
            appContainer.appendChild(toggleArea);
        },

        /**
         * サイドバーの状態をトグルします (プライベート関数)
         * 
         * @param {HTMLElement} sidebar - サイドバー要素
         * @param {HTMLElement} toggleButton - トグルボタン要素
         * @returns {void}
         */
        _toggleSidebarState: (sidebar, toggleButton) => {
            const isNowCollapsed = sidebar.classList.contains('collapsed');
            if (isNowCollapsed) {
                sidebar.classList.remove('collapsed');
                toggleButton.classList.add('sidebar-visible');
                window.Storage.saveSidebarState(false);
            } else {
                sidebar.classList.add('collapsed');
                toggleButton.classList.remove('sidebar-visible');
                window.Storage.saveSidebarState(true);
            }
        },

        /**
         * チャットエリアクリック時のサイドバー処理 (プライベート関数)
         * 
         * @param {HTMLElement} sidebar - サイドバー要素
         * @returns {void}
         */
        _handleChatAreaClick: (sidebar) => {
            if (window.innerWidth <= 576 && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
            }
        },

        /**
         * ウィンドウリサイズ時のサイドバー処理 (プライベート関数)
         * 
         * @param {HTMLElement} sidebar - サイドバー要素
         * @returns {void}
         */
        _handleWindowResize: (sidebar) => {
            if (window.innerWidth > 576) {
                sidebar.classList.remove('show');
            }
        }
    };

    /**
     * フォーム要素関連機能
     */
    const form = {
        /**
         * テキストエリアの高さを自動調整します
         * 
         * @param {HTMLTextAreaElement} textarea - 対象のテキストエリア要素
         * @returns {void}
         */
        autoResizeTextarea: (textarea) => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }
    };

    /**
     * モーダル関連機能
     */
    const modal = {
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
        showApiKeyModal: (apiSettings) => {
            const apiKeyModal = document.getElementById('apiKeyModal');
            apiKeyModal.classList.add('show');
            
            // 必要な要素を取得
            const elements = modal._getApiKeyModalElements();
            
            // OpenAIまたはAzureのAPIキーを表示
            if (apiSettings.apiType === 'azure') {
                modal._setupAzureApiSettings(elements, apiSettings);
            } else {
                modal._setupOpenAIApiSettings(elements, apiSettings);
            }
        },

        /**
         * APIキーモーダルに必要な要素を取得します (プライベート関数)
         * 
         * @returns {Object} モーダル内の要素オブジェクト
         */
        _getApiKeyModalElements: () => {
            return {
                azureApiKeyInput: document.getElementById('azureApiKeyInput'),
                openaiRadio: document.getElementById('openaiRadio'),
                azureRadio: document.getElementById('azureRadio'),
                apiKeyInput: document.getElementById('apiKeyInput'),
                openaiSettings: document.getElementById('openaiSettings'),
                azureSettings: document.getElementById('azureSettings'),
                azureEndpointGpt4oMini: document.getElementById('azureEndpointGpt4oMini'),
                azureEndpointGpt4o: document.getElementById('azureEndpointGpt4o'),
                azureEndpointO1Mini: document.getElementById('azureEndpointO1Mini'),
                azureEndpointO1: document.getElementById('azureEndpointO1')
            };
        },

        /**
         * Azure API設定をモーダルにセットアップします (プライベート関数)
         * 
         * @param {Object} elements - モーダル内の要素オブジェクト
         * @param {Object} apiSettings - API設定オブジェクト
         * @returns {void}
         */
        _setupAzureApiSettings: (elements, apiSettings) => {
            elements.azureRadio.checked = true;
            elements.azureApiKeyInput.value = apiSettings.azureApiKey;
            elements.openaiSettings.classList.add('hidden');
            elements.azureSettings.classList.remove('hidden');
            elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
            elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
            elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
            elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
        },

        /**
         * OpenAI API設定をモーダルにセットアップします (プライベート関数)
         * 
         * @param {Object} elements - モーダル内の要素オブジェクト
         * @param {Object} apiSettings - API設定オブジェクト
         * @returns {void}
         */
        _setupOpenAIApiSettings: (elements, apiSettings) => {
            elements.openaiRadio.checked = true;
            elements.apiKeyInput.value = apiSettings.openaiApiKey;
            elements.openaiSettings.classList.remove('hidden');
            elements.azureSettings.classList.add('hidden');
        },

        /**
         * APIキーモーダルを非表示にします
         * 
         * @returns {void}
         */
        hideApiKeyModal: () => {
            const apiKeyModal = document.getElementById('apiKeyModal');
            apiKeyModal.classList.remove('show');
        },

        /**
         * Azure設定の表示/非表示を切り替えます
         * 
         * @returns {void}
         */
        toggleAzureSettings: () => {
            const openaiSettings = document.getElementById('openaiSettings');
            const azureSettings = document.getElementById('azureSettings');
            const azureRadio = document.getElementById('azureRadio');
            
            if (azureRadio.checked) {
                openaiSettings.classList.add('hidden');
                azureSettings.classList.remove('hidden');
            } else {
                openaiSettings.classList.remove('hidden');
                azureSettings.classList.add('hidden');
            }
        },

        /**
         * チャットの名前変更モーダルを表示します
         * 
         * @param {Object} conversation - 会話オブジェクト
         * @param {string} conversation.id - 会話ID
         * @param {string} conversation.title - 会話タイトル
         * @returns {void}
         */
        showRenameChatModal: (conversation) => {
            const modal = document.getElementById('renameChatModal');
            const titleInput = document.getElementById('chatTitleInput');
            
            // 現在のタイトルをセット
            titleInput.value = conversation.title || '新しいチャット';
            
            // 会話IDをモーダルに保存（データ属性を使用）
            modal.dataset.conversationId = conversation.id;
            
            // モーダルを表示
            modal.classList.add('show');
            
            // フォーカスを入力フィールドに設定
            titleInput.focus();
            titleInput.select();
        },

        /**
         * チャットの名前変更モーダルを非表示にします
         * 
         * @returns {void}
         */
        hideRenameChatModal: () => {
            const modal = document.getElementById('renameChatModal');
            modal.classList.remove('show');
        },

        /**
         * システムプロンプト設定モーダルを表示します
         * 
         * @param {string} systemPrompt - 現在のシステムプロンプト
         * @param {Function} loadPromptTemplatesCallback - テンプレート読み込みコールバック関数
         * @returns {void}
         */
        showSystemPromptModal: (systemPrompt, loadPromptTemplatesCallback) => {
            const systemPromptModal = document.getElementById('systemPromptModal');
            const systemPromptInput = document.getElementById('systemPromptInput');
            
            systemPromptModal.classList.add('show');
            systemPromptInput.value = systemPrompt;
            loadPromptTemplatesCallback();
        },

        /**
         * システムプロンプト設定モーダルを非表示にします
         * 
         * @returns {void}
         */
        hideSystemPromptModal: () => {
            const systemPromptModal = document.getElementById('systemPromptModal');
            systemPromptModal.classList.remove('show');
        }
    };

    /**
     * テンプレート関連機能
     */
    const template = {
        /**
         * テンプレート一覧を表示します
         * 
         * @param {Object} promptTemplates - プロンプトテンプレート集
         * @param {Function} onTemplateSelect - テンプレート選択時のコールバック関数
         * @param {Function} onTemplateDelete - テンプレート削除時のコールバック関数
         * @returns {void}
         */
        updateTemplateList: (promptTemplates, onTemplateSelect, onTemplateDelete) => {
            // 既存のテンプレート一覧エリアを取得
            const templateListArea = document.getElementById('templateListArea');
            
            // テンプレート一覧をクリア
            templateListArea.innerHTML = '';
            
            // デフォルトテンプレートは削除不可
            const defaultTemplates = ['default', 'creative', 'technical'];
            
            // テンプレート一覧を表示
            Object.keys(promptTemplates).forEach(templateName => {
                const templateItem = template._createTemplateItem(
                    templateName, 
                    defaultTemplates.includes(templateName),
                    onTemplateSelect,
                    onTemplateDelete
                );
                templateListArea.appendChild(templateItem);
            });
        },

        /**
         * テンプレート項目要素を作成します (プライベート関数)
         * 
         * @param {string} templateName - テンプレート名
         * @param {boolean} isDefault - デフォルトテンプレートかどうか
         * @param {Function} onTemplateSelect - テンプレート選択時のコールバック関数
         * @param {Function} onTemplateDelete - テンプレート削除時のコールバック関数
         * @returns {HTMLElement} テンプレート項目要素
         */
        _createTemplateItem: (templateName, isDefault, onTemplateSelect, onTemplateDelete) => {
            const templateItem = document.createElement('div');
            templateItem.classList.add('template-item');
            
            const templateNameSpan = document.createElement('span');
            templateNameSpan.textContent = templateName;
            templateNameSpan.classList.add('template-name');
            templateItem.appendChild(templateNameSpan);
            
            // デフォルトテンプレート以外には削除ボタンを追加
            if (!isDefault) {
                const deleteButton = document.createElement('button');
                deleteButton.classList.add('template-delete-button');
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = 'テンプレートを削除';
                
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onTemplateDelete(templateName);
                });
                
                templateItem.appendChild(deleteButton);
            }
            
            // テンプレートをクリックすると選択される
            templateItem.addEventListener('click', () => {
                onTemplateSelect(templateName);
            });
            
            return templateItem;
        }
    };
    
    /**
     * 添付ファイル関連機能
     */
    const attachment = {
        /**
         * ファイル添付ボタンと添付ファイル表示エリアを作成します
         * 
         * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
         * @param {Function} onFileAttached - ファイル添付時のコールバック関数
         * @returns {Object} 作成した要素のオブジェクト
         */
        createFileAttachmentUI: (chatInputContainer, onFileAttached) => {
            // ファイル入力要素を作成（非表示）
            const fileInput = attachment._createFileInput();
            
            // ファイル添付ボタンを作成
            const attachButton = attachment._createAttachButton(fileInput);
            
            // 添付ファイル表示エリアを作成
            const attachmentPreviewArea = document.createElement('div');
            attachmentPreviewArea.classList.add('attachment-preview-area');
            attachmentPreviewArea.style.display = 'none';
            
            // 要素を追加
            chatInputContainer.appendChild(fileInput);
            
            // 入力ボタングループに添付ボタンを追加
            attachment._addAttachButtonToContainer(chatInputContainer, attachButton);
            
            // 添付ファイル表示エリアを追加
            const inputButtonGroup = chatInputContainer.querySelector('.input-button-group');
            chatInputContainer.insertBefore(attachmentPreviewArea, inputButtonGroup || chatInputContainer.firstChild);
            
            return {
                fileInput,
                attachButton,
                attachmentPreviewArea
            };
        },

        /**
         * ファイル入力要素を作成します (プライベート関数)
         * 
         * @returns {HTMLElement} ファイル入力要素
         */
        _createFileInput: () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'fileAttachment';
            fileInput.accept = 'image/*';  // 画像ファイルのみ許可
            fileInput.style.display = 'none';
            fileInput.multiple = false;    // 1つのファイルのみ
            return fileInput;
        },

        /**
         * 添付ボタンを作成します (プライベート関数)
         * 
         * @param {HTMLElement} fileInput - ファイル入力要素
         * @returns {HTMLElement} 添付ボタン要素
         */
        _createAttachButton: (fileInput) => {
            const attachButton = document.createElement('button');
            attachButton.classList.add('attachment-button');
            attachButton.innerHTML = '<i class="fas fa-paperclip"></i>';
            attachButton.title = '画像を添付';
            
            // ファイル選択ダイアログを表示
            attachButton.addEventListener('click', () => {
                fileInput.click();
            });
            
            return attachButton;
        },

        /**
         * 添付ボタンを入力コンテナに追加します (プライベート関数)
         * 
         * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
         * @param {HTMLElement} attachButton - 添付ボタン要素
         * @returns {void}
         */
        _addAttachButtonToContainer: (chatInputContainer, attachButton) => {
            const inputButtonGroup = chatInputContainer.querySelector('.input-button-group');
            if (inputButtonGroup) {
                // 送信ボタンの前に挿入
                const sendButton = inputButtonGroup.querySelector('.send-button');
                if (sendButton) {
                    inputButtonGroup.insertBefore(attachButton, sendButton);
                } else {
                    inputButtonGroup.appendChild(attachButton);
                }
            } else {
                chatInputContainer.appendChild(attachButton);
            }
        },
        
        /**
         * 添付ファイルのプレビューを表示します
         * 
         * @param {HTMLElement} previewArea - プレビュー表示エリア
         * @param {File} file - 添付ファイル
         * @param {string} base64Data - Base64エンコードされたファイルデータ
         * @returns {void}
         */
        showAttachmentPreview: (previewArea, file, base64Data) => {
            previewArea.innerHTML = '';
            previewArea.style.display = 'flex';
            
            // プレビュー要素を作成
            const previewItem = document.createElement('div');
            previewItem.classList.add('attachment-preview-item');
            
            // ファイルタイプに応じたプレビュー表示
            attachment._addPreviewContent(previewItem, file, base64Data);
            
            // 削除ボタンを追加
            attachment._addRemoveButton(previewItem, previewArea);
            
            previewArea.appendChild(previewItem);
        },

        /**
         * ファイルタイプに応じたプレビューコンテンツを追加します (プライベート関数)
         * 
         * @param {HTMLElement} previewItem - プレビュー項目要素
         * @param {File} file - 添付ファイル
         * @param {string} base64Data - Base64エンコードされたファイルデータ
         * @returns {void}
         */
        _addPreviewContent: (previewItem, file, base64Data) => {
            // 画像プレビュー
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = base64Data;
                img.alt = file.name;
                img.classList.add('attachment-preview-image');
                previewItem.appendChild(img);
            }
            
            // ファイル情報
            const fileInfo = document.createElement('div');
            fileInfo.classList.add('attachment-file-info');
            fileInfo.textContent = file.name;
            previewItem.appendChild(fileInfo);
        },

        /**
         * 削除ボタンを追加します (プライベート関数)
         * 
         * @param {HTMLElement} previewItem - プレビュー項目要素
         * @param {HTMLElement} previewArea - プレビュー表示エリア
         * @returns {void}
         */
        _addRemoveButton: (previewItem, previewArea) => {
            const removeButton = document.createElement('button');
            removeButton.classList.add('attachment-remove-button');
            removeButton.innerHTML = '<i class="fas fa-times"></i>';
            removeButton.title = '添付を削除';
            
            removeButton.addEventListener('click', () => {
                previewArea.innerHTML = '';
                previewArea.style.display = 'none';
                
                // 添付ファイル削除イベントを発火
                const removeEvent = new CustomEvent('attachment-removed');
                previewArea.dispatchEvent(removeEvent);
            });
            
            previewItem.appendChild(removeButton);
        },
        
        /**
         * 添付ファイルをクリアします
         * 
         * @param {HTMLElement} previewArea - プレビュー表示エリア
         * @returns {void}
         */
        clearAttachments: (previewArea) => {
            if (previewArea) {
                previewArea.innerHTML = '';
                previewArea.style.display = 'none';
            }
        }
    };

    // 公開API
    return {
        // サイドバー関連
        createSidebarToggle: sidebar.createSidebarToggle,
        
        // フォーム要素関連
        autoResizeTextarea: form.autoResizeTextarea,
        
        // モーダル関連
        showApiKeyModal: modal.showApiKeyModal,
        hideApiKeyModal: modal.hideApiKeyModal,
        toggleAzureSettings: modal.toggleAzureSettings,
        showRenameChatModal: modal.showRenameChatModal,
        hideRenameChatModal: modal.hideRenameChatModal,
        showSystemPromptModal: modal.showSystemPromptModal,
        hideSystemPromptModal: modal.hideSystemPromptModal,
        
        // テンプレート関連
        updateTemplateList: template.updateTemplateList,
        
        // 添付ファイル関連
        createFileAttachmentUI: attachment.createFileAttachmentUI,
        showAttachmentPreview: attachment.showAttachmentPreview,
        clearAttachments: attachment.clearAttachments
    };
})();