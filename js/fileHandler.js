/**
 * fileHandler.js
 * ファイルアップロード関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.FileHandler = {
    /**
     * 選択したファイルを保持する配列
     * @type {Array<File>}
     */
    selectedFiles: [],

    /**
     * ファイル選択イベントの処理
     * @param {Event} event - ファイル入力イベント
     */
    handleFileSelect: function(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        // 選択されたファイルを追加
        this.selectedFiles = [...this.selectedFiles, ...files];

        // プレビューエリアを作成または取得
        const previewArea = this._getOrCreatePreviewArea();
        
        // 各ファイルのプレビューを作成
        this._createFilePreviewItems(files, previewArea);

        // 添付完了イベントを発火
        this.notifyAttachmentComplete(this.selectedFiles);
    },

    /**
     * プレビューエリアを取得または作成
     * @private
     * @returns {HTMLElement} プレビューエリア要素
     */
    _getOrCreatePreviewArea: function() {
        const inputWrapper = document.querySelector('.input-wrapper');
        if (!inputWrapper) {
            console.error('入力ラッパー要素が見つかりません');
            return null;
        }
        
        // 既存のプレビューエリアを検索
        let previewArea = inputWrapper.querySelector('.file-preview');
        
        // プレビューエリアがなければ新規作成
        if (!previewArea) {
            previewArea = document.createElement('div');
            previewArea.classList.add('file-preview');
            const userInput = document.getElementById('userInput');
            if (userInput) {
                inputWrapper.insertBefore(previewArea, userInput);
            } else {
                inputWrapper.appendChild(previewArea);
            }
        }
        
        return previewArea;
    },

    /**
     * ファイルプレビュー要素を作成
     * @private
     * @param {Array<File>} files - 処理するファイルの配列
     * @param {HTMLElement} previewArea - プレビュー要素を追加する親要素
     */
    _createFilePreviewItems: function(files, previewArea) {
        if (!previewArea) return;
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.classList.add('file-preview-item');
            
            // 画像ファイルの場合はプレビュー表示
            if (file.type.startsWith('image/')) {
                this._createImagePreview(file, fileItem);
            }
            
            // ファイル情報とクローズボタンを追加
            this._createFileInfo(file, fileItem, previewArea);
            
            previewArea.appendChild(fileItem);
        });
    },

    /**
     * 画像プレビューを作成して要素に追加
     * @private
     * @param {File} file - 画像ファイル
     * @param {HTMLElement} fileItem - プレビュー要素を追加する親要素
     */
    _createImagePreview: function(file, fileItem) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.classList.add('image-preview');
            img.style.maxWidth = '150px';
            img.style.maxHeight = '100px';
            img.style.objectFit = 'contain';
            fileItem.appendChild(img);
        };
        reader.onerror = function(e) {
            console.error('画像プレビューの作成に失敗しました:', e);
        };
        reader.readAsDataURL(file);
    },

    /**
     * ファイル情報要素とクローズボタンを作成
     * @private
     * @param {File} file - 対象ファイル
     * @param {HTMLElement} fileItem - ファイル情報を追加する親要素
     * @param {HTMLElement} previewArea - プレビューエリア要素
     */
    _createFileInfo: function(file, fileItem, previewArea) {
        const fileInfo = document.createElement('div');
        fileInfo.classList.add('file-info');
        
        const fileIndex = this.selectedFiles.indexOf(file);
        fileInfo.innerHTML = `
            ${file.name}
            <span class="remove-file" data-index="${fileIndex}">
                <i class="fas fa-times"></i>
            </span>
        `;
        fileItem.appendChild(fileInfo);

        // ファイル削除イベントを登録
        const removeButton = fileInfo.querySelector('.remove-file');
        if (removeButton) {
            this._setupRemoveButtonHandler(removeButton, fileItem, previewArea);
        }
    },

    /**
     * 削除ボタンのイベントハンドラを設定
     * @private
     * @param {HTMLElement} removeButton - 削除ボタン要素
     * @param {HTMLElement} fileItem - ファイルアイテム要素
     * @param {HTMLElement} previewArea - プレビューエリア要素
     */
    _setupRemoveButtonHandler: function(removeButton, fileItem, previewArea) {
        const self = this;
        removeButton.addEventListener('click', function(e) {
            const indexToRemove = parseInt(e.currentTarget.dataset.index);
            if (isNaN(indexToRemove)) return;
            
            // 配列からファイルを削除
            self.selectedFiles = self.selectedFiles.filter((_, i) => i !== indexToRemove);
            
            // UIから要素を削除
            fileItem.remove();
            
            // ファイルがなくなった場合はプレビューエリアを削除
            if (self.selectedFiles.length === 0 && previewArea && previewArea.parentNode) {
                previewArea.remove();
            }
            
            // 添付ファイル削除イベントを発火
            document.dispatchEvent(new CustomEvent('attachment-removed'));
            
            // 残りのファイルがある場合は添付完了イベントを発火
            if (self.selectedFiles.length > 0) {
                self.notifyAttachmentComplete(self.selectedFiles);
            }
        });
    },

    /**
     * 添付完了を通知するイベントを発火
     * @param {Array<File>} files - 添付されたファイルの配列
     */
    notifyAttachmentComplete: function(files) {
        if (!files || files.length === 0) return;
        
        // ファイルをAPI用形式に変換
        this._convertFilesToAttachments(files)
            .then(attachments => {
                // ファイル添付完了イベントを発火
                document.dispatchEvent(new CustomEvent('file-attached', {
                    detail: { attachments }
                }));
            })
            .catch(error => {
                console.error('ファイル処理中にエラーが発生しました:', error);
            });
    },

    /**
     * ファイルをAPI用の添付ファイル形式に変換
     * @private
     * @param {Array<File>} files - 変換するファイルの配列
     * @returns {Promise<Array>} 変換された添付ファイル配列
     */
    _convertFilesToAttachments: function(files) {
        return Promise.all(files.map(file => this._convertFileToAttachment(file)));
    },

    /**
     * 単一のファイルをAPI用の添付ファイル形式に変換
     * @private
     * @param {File} file - 変換するファイル
     * @returns {Promise<Object>} 変換された添付ファイルオブジェクト
     */
    _convertFileToAttachment: async function(file) {
        if (file.type.startsWith('image/')) {
            const dataUrl = await this.readFileAsDataURL(file);
            return {
                type: 'image',
                name: file.name,
                data: dataUrl
            };
        } else {
            // 非画像ファイルの場合
            const base64 = await this.readFileAsBase64(file);
            return {
                type: 'file',
                name: file.name,
                mimeType: file.type,
                data: `data:${file.type};base64,${base64}`
            };
        }
    },

    /**
     * ファイルをDataURL (base64エンコード含む) として読み込む
     * @param {File} file - 読み込むファイル
     * @returns {Promise<string>} DataURL形式のファイルデータ
     */
    readFileAsDataURL: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (e) => {
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(e);
            };
            reader.readAsDataURL(file);
        });
    },

    /**
     * ファイルをBase64として読み込む (DataURLからbase64部分のみ抽出)
     * @param {File} file - 読み込むファイル
     * @returns {Promise<string>} Base64エンコードされたファイルデータ
     */
    readFileAsBase64: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } catch (e) {
                    console.error('Base64エンコードに失敗しました:', e);
                    reject(e);
                }
            };
            reader.onerror = (e) => {
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(e);
            };
            reader.readAsDataURL(file);
        });
    },

    /**
     * 選択されたファイルを取得
     * @returns {Array<File>} 選択されたファイルの配列
     */
    getSelectedFiles: function() {
        return this.selectedFiles;
    },

    /**
     * 選択されたファイルをクリア
     */
    clearSelectedFiles: function() {
        this.selectedFiles = [];
        
        // プレビューをクリア
        const inputWrapper = document.querySelector('.input-wrapper');
        if (inputWrapper) {
            const previewArea = inputWrapper.querySelector('.file-preview');
            if (previewArea) {
                previewArea.remove();
            }
        }
    },
    
    /**
     * Azure OpenAI API用の添付ファイル形式に変換
     * @returns {Promise<Array>} API用に変換された添付ファイル配列
     */
    getAttachmentsForAPI: async function() {
        if (this.selectedFiles.length === 0) {
            return [];
        }
        
        return this._convertFilesToAttachments(this.selectedFiles);
    }
};