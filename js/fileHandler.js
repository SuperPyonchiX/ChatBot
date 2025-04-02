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
     * 保存された添付ファイルのメタデータ
     * @type {Array<Object>}
     */
    savedAttachments: [],
    
    /**
     * 添付ファイルを送信した時のタイムスタンプ
     * @type {number|null}
     */
    attachmentTimestamp: null,

    /**
     * 初期化関数 - ページ読み込み時に呼び出し
     */
    init: function() {
        // file input要素のaccept属性を動的に設定
        this.updateAcceptedFileTypes();
    },
    
    /**
     * 許可されたファイル拡張子をfile input要素に反映
     */
    updateAcceptedFileTypes: function() {
        try {
            const fileInput = document.getElementById('fileInput');
            if (!fileInput) return;
            
            const acceptedExtensions = this.getAllowedFileExtensions();
            if (acceptedExtensions && acceptedExtensions.length > 0) {
                fileInput.setAttribute('accept', acceptedExtensions.join(','));
            }
        } catch (error) {
            console.error('ファイル拡張子設定エラー:', error);
        }
    },
    
    /**
     * 許可されたファイル拡張子リストを生成
     * @returns {Array<string>} 許可された拡張子のリスト (.jpg など)
     */
    getAllowedFileExtensions: function() {
        try {
            const extensions = [];
            const allowedTypes = window.CONFIG.FILE.ALLOWED_FILE_TYPES;
            
            // MIMEタイプから拡張子への変換マップ
            const mimeToExtMap = {
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/png': ['.png'],
                'image/gif': ['.gif'],
                'image/webp': ['.webp'],
                'image/svg+xml': ['.svg'],
                'text/plain': ['.txt'],
                'text/markdown': ['.md'],
                'text/csv': ['.csv'],
                'application/pdf': ['.pdf'],
                'text/javascript': ['.js'],
                'text/html': ['.html', '.htm'],
                'text/css': ['.css'],
                'application/json': ['.json'],
                // Office形式を追加
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/vnd.ms-powerpoint': ['.ppt'],
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
            };
            
            // 各カテゴリから拡張子を抽出
            for (const category in allowedTypes) {
                if (!Object.prototype.hasOwnProperty.call(allowedTypes, category)) continue;
                
                for (const mimeType of allowedTypes[category]) {
                    if (mimeToExtMap[mimeType]) {
                        extensions.push(...mimeToExtMap[mimeType]);
                    }
                }
            }
            
            // 重複を排除して返す
            return [...new Set(extensions)];
        } catch (error) {
            console.error('拡張子リスト生成エラー:', error);
            // エラー時はデフォルトの拡張子リストを返す
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.txt', '.md', '.csv', '.pdf', '.js', '.html', '.css', '.json'];
        }
    },

    /**
     * ファイル選択イベントの処理
     * @param {Event} event - ファイル入力イベント
     */
    handleFileSelect: function(event) {
        if (!event || !event.target || !event.target.files) {
            console.error('不正なファイル選択イベント');
            return;
        }
        
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        // ファイル検証と処理
        const validFiles = this._validateFiles(files);
        
        if (validFiles.length === 0) {
            // ファイル入力をクリア
            event.target.value = '';
            return;
        }
        
        // 選択されたファイルを追加
        this.selectedFiles = [...this.selectedFiles, ...validFiles];

        // プレビューエリアを作成または取得
        const previewArea = this._getOrCreatePreviewArea();
        if (!previewArea) {
            console.error('プレビューエリアを作成できませんでした');
            return;
        }
        
        // 各ファイルのプレビューを作成
        this._createFilePreviewItems(validFiles, previewArea);

        // 添付完了イベントを発火
        this.notifyAttachmentComplete(this.selectedFiles);
        
        // ファイル入力をクリア
        event.target.value = '';
    },
    
    /**
     * ファイルを検証する
     * @private
     * @param {Array<File>} files - 検証するファイルの配列
     * @returns {Array<File>} 検証に通過したファイルの配列
     */
    _validateFiles: function(files) {
        if (!files || !Array.isArray(files)) return [];
        
        const validFiles = [];
        const errors = [];
        
        // 許可されるすべてのMIMEタイプのリスト
        const allowedMimeTypes = Object.values(window.CONFIG.FILE.ALLOWED_FILE_TYPES).flat();
        
        files.forEach(file => {
            // ファイルサイズを確認
            if (file.size > window.CONFIG.FILE.MAX_FILE_SIZE) {
                const maxSizeMB = window.CONFIG.FILE.MAX_FILE_SIZE / (1024 * 1024);
                errors.push(`"${file.name}"は大きすぎます（最大${maxSizeMB}MB）`);
                return;
            }
            
            // MIMEタイプを確認（緩い制限）
            if (!this._isFileTypeAllowed(file.type)) {
                errors.push(`"${file.name}"は対応していないファイル形式です`);
                return;
            }
            
            validFiles.push(file);
        });
        
        // エラーメッセージがある場合は表示
        if (errors.length > 0) {
            alert(`以下のファイルは添付できません:\n\n${errors.join('\n')}`);
        }
        
        return validFiles;
    },
    
    /**
     * ファイルタイプが許可されているか確認
     * @private
     * @param {string} mimeType - チェックするMIMEタイプ
     * @returns {boolean} 許可されている場合はtrue
     */
    _isFileTypeAllowed: function(mimeType) {
        // MIMEタイプが指定されていない場合
        if (!mimeType) return false;
        
        // すべての許可されたMIMEタイプのリスト
        const allowedMimeTypes = Object.values(window.CONFIG.FILE.ALLOWED_FILE_TYPES).flat();
        
        // 完全一致を確認
        if (allowedMimeTypes.includes(mimeType)) {
            return true;
        }
        
        // 一般的なタイプに対して前方一致を確認
        for (const allowed of allowedMimeTypes) {
            const genericType = allowed.split('/')[0];
            if (mimeType.startsWith(`${genericType}/`)) {
                return true;
            }
        }
        
        return false;
    },

    /**
     * プレビューエリアを取得または作成
     * @private
     * @returns {HTMLElement|null} プレビューエリア要素
     */
    _getOrCreatePreviewArea: function() {
        try {
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
        } catch (error) {
            console.error('プレビューエリア作成エラー:', error);
            return null;
        }
    },

    /**
     * ファイルプレビュー要素を作成
     * @private
     * @param {Array<File>} files - 処理するファイルの配列
     * @param {HTMLElement} previewArea - プレビュー要素を追加する親要素
     */
    _createFilePreviewItems: function(files, previewArea) {
        if (!previewArea || !files || !Array.isArray(files)) return;
        
        // 各ファイルに対応するプレビュー要素を作成
        files.forEach((file, currentIndex) => {
            // 全体のインデックスを計算（既存ファイル + 現在のインデックス）
            const fileIndex = this.selectedFiles.indexOf(file);
            if (fileIndex === -1) return;
            
            const fileItem = document.createElement('div');
            fileItem.classList.add('file-preview-item');
            fileItem.dataset.fileIndex = fileIndex.toString();
            
            // ファイルタイプに応じたプレビュー内容を設定
            this._createFilePreview(file, fileItem);
            
            // ファイル情報とクローズボタンを追加
            this._createFileInfo(file, fileItem, previewArea, fileIndex);
            
            previewArea.appendChild(fileItem);
        });
    },

    /**
     * ファイルタイプに応じたプレビューを作成
     * @private
     * @param {File} file - プレビュー対象のファイル
     * @param {HTMLElement} fileItem - プレビュー要素を追加する親要素
     */
    _createFilePreview: function(file, fileItem) {
        if (!file || !fileItem) return;
        
        // ファイルアイコンを表示するデフォルト要素
        const fileTypeIcon = document.createElement('div');
        fileTypeIcon.classList.add('file-type-icon');
        
        try {
            // 画像ファイルの場合
            if (file.type.startsWith('image/')) {
                this._createImagePreview(file, fileItem);
            } 
            // PDF、テキスト、コードなどの場合はアイコン表示
            else {
                // ファイルタイプに基づいてアイコンを選択
                let iconClass = 'fa-file';
                
                if (file.type === 'application/pdf') {
                    iconClass = 'fa-file-pdf';
                } else if (file.type.startsWith('text/')) {
                    iconClass = 'fa-file-alt';
                } else if (file.type.includes('javascript') || file.type.includes('json') || 
                           file.type.includes('html') || file.type.includes('css')) {
                    iconClass = 'fa-file-code';
                }
                
                fileTypeIcon.innerHTML = `<i class="fas ${iconClass} fa-2x"></i>`;
                fileItem.appendChild(fileTypeIcon);
            }
        } catch (error) {
            console.error('ファイルプレビュー作成エラー:', error);
            // エラー時はデフォルトアイコンを表示
            fileTypeIcon.innerHTML = '<i class="fas fa-file fa-2x"></i>';
            fileItem.appendChild(fileTypeIcon);
        }
    },

    /**
     * 画像プレビューを作成して要素に追加
     * @private
     * @param {File} file - 画像ファイル
     * @param {HTMLElement} fileItem - プレビュー要素を追加する親要素
     */
    _createImagePreview: function(file, fileItem) {
        if (!file || !fileItem) return;
        
        const reader = new FileReader();
        
        // 読み込み中の表示
        const loadingIndicator = document.createElement('div');
        loadingIndicator.classList.add('loading-indicator');
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        fileItem.appendChild(loadingIndicator);
        
        reader.onload = function(e) {
            try {
                // 読み込み完了したらローディング表示を削除
                if (loadingIndicator) {
                    fileItem.removeChild(loadingIndicator);
                }
                
                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('image-preview');
                img.style.maxWidth = '150px';
                img.style.maxHeight = '100px';
                img.style.objectFit = 'contain';
                
                // 画像クリックで拡大表示
                img.addEventListener('click', function() {
                    if (window.Chat && typeof window.Chat._showFullSizeImage === 'function') {
                        window.Chat._showFullSizeImage(e.target.result, file.name);
                    }
                });
                
                fileItem.appendChild(img);
            } catch (error) {
                console.error('画像プレビュー表示エラー:', error);
                
                // エラー時はデフォルトアイコンを表示
                const errorIcon = document.createElement('div');
                errorIcon.classList.add('file-type-icon');
                errorIcon.innerHTML = '<i class="fas fa-image fa-2x"></i>';
                fileItem.appendChild(errorIcon);
            }
        };
        
        reader.onerror = function(e) {
            console.error('画像プレビューの作成に失敗しました:', e);
            
            // エラー時はローディング表示を削除
            if (loadingIndicator) {
                fileItem.removeChild(loadingIndicator);
            }
            
            // エラーアイコンを表示
            const errorIcon = document.createElement('div');
            errorIcon.classList.add('file-type-icon');
            errorIcon.innerHTML = '<i class="fas fa-exclamation-triangle fa-2x"></i>';
            fileItem.appendChild(errorIcon);
        };
        
        reader.readAsDataURL(file);
    },

    /**
     * ファイル情報要素とクローズボタンを作成
     * @private
     * @param {File} file - 対象ファイル
     * @param {HTMLElement} fileItem - ファイル情報を追加する親要素
     * @param {HTMLElement} previewArea - プレビューエリア要素
     * @param {number} fileIndex - ファイルのインデックス
     */
    _createFileInfo: function(file, fileItem, previewArea, fileIndex) {
        if (!file || !fileItem) return;
        
        const fileInfo = document.createElement('div');
        fileInfo.classList.add('file-info');
        
        // ファイルサイズを表示用に変換
        const fileSize = this._formatFileSize(file.size);
        
        fileInfo.innerHTML = `
            <span class="file-name" title="${file.name}">${this._truncateFileName(file.name)}</span>
            <span class="file-size">${fileSize}</span>
            <span class="remove-file" data-index="${fileIndex}" title="削除">
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
     * ファイル名を適切な長さに切り詰める
     * @private
     * @param {string} fileName - ファイル名
     * @param {number} maxLength - 最大文字数
     * @returns {string} 切り詰められたファイル名
     */
    _truncateFileName: function(fileName, maxLength = 20) {
        if (!fileName) return '';
        
        if (fileName.length <= maxLength) {
            return fileName;
        }
        
        // 拡張子を保持して切り詰める
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        
        // 必要なだけ切り詰める
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3);
        
        return `${truncatedName}...${extension}`;
    },
    
    /**
     * ファイルサイズを読みやすい形式に変換
     * @private
     * @param {number} sizeInBytes - バイト単位のサイズ
     * @returns {string} 変換されたサイズ文字列
     */
    _formatFileSize: function(sizeInBytes) {
        if (sizeInBytes < 1024) {
            return sizeInBytes + 'B';
        } else if (sizeInBytes < 1024 * 1024) {
            return Math.round(sizeInBytes / 1024) + 'KB';
        } else {
            return (sizeInBytes / (1024 * 1024)).toFixed(1) + 'MB';
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
        if (!removeButton || !fileItem || !previewArea) return;
        
        const self = this;
        removeButton.addEventListener('click', function(e) {
            try {
                e.stopPropagation(); // イベント伝播を停止
                
                const indexToRemove = parseInt(e.currentTarget.dataset.index);
                if (isNaN(indexToRemove)) return;
                
                // 配列からファイルを削除
                self.selectedFiles = self.selectedFiles.filter((_, i) => i !== indexToRemove);
                
                // UIから要素を削除
                fileItem.remove();
                
                // インデックスの再割り当て
                self._updateFileIndices();
                
                // ファイルがなくなった場合はプレビューエリアを削除
                if (self.selectedFiles.length === 0 && previewArea && previewArea.parentNode) {
                    previewArea.remove();
                    
                    // 添付ファイル削除イベントを発火
                    document.dispatchEvent(new CustomEvent('attachment-removed'));
                    return;
                }
                
                // 残りのファイルがある場合は添付完了イベントを発火
                if (self.selectedFiles.length > 0) {
                    self.notifyAttachmentComplete(self.selectedFiles);
                }
            } catch (error) {
                console.error('ファイル削除処理エラー:', error);
            }
        });
    },
    
    /**
     * ファイルのインデックスを更新
     * @private
     */
    _updateFileIndices: function() {
        const fileItems = document.querySelectorAll('.file-preview-item');
        
        fileItems.forEach((item, index) => {
            const removeButton = item.querySelector('.remove-file');
            if (removeButton) {
                removeButton.dataset.index = index.toString();
            }
            item.dataset.fileIndex = index.toString();
        });
    },

    /**
     * 添付完了を通知するイベントを発火
     * @param {Array<File>} files - 添付されたファイルの配列
     */
    notifyAttachmentComplete: function(files) {
        if (!files || files.length === 0) return;
        
        // 現在のタイムスタンプを記録
        this.attachmentTimestamp = Date.now();
        
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
        if (!files || !Array.isArray(files)) {
            return Promise.resolve([]);
        }
        
        return Promise.all(files.map(file => this._convertFileToAttachment(file)));
    },

    /**
     * 単一のファイルをAPI用の添付ファイル形式に変換
     * @private
     * @param {File} file - 変換するファイル
     * @returns {Promise<Object>} 変換された添付ファイルオブジェクト
     */
    _convertFileToAttachment: async function(file) {
        try {
            if (!file) {
                throw new Error('有効なファイルが指定されていません');
            }
            
            // 画像ファイルの場合
            if (file.type.startsWith('image/')) {
                const dataUrl = await this.readFileAsDataURL(file);
                return {
                    type: 'image',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl
                };
            } 
            // PDFファイルの場合
            else if (file.type === 'application/pdf') {
                // PDFをデータURLとして読み込む（プレビュー表示用）
                const dataUrl = await this.readFileAsDataURL(file);
                
                // PDFからテキストを抽出（GPT送信用）
                const extractedText = await this.extractTextFromPDF(file);
                
                return {
                    type: 'pdf',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText // GPTに送信するテキスト内容
                };
            }
            // Office関連ファイル (Word, Excel, PowerPoint) の場合
            else if (this._isOfficeFile(file.type)) {
                // ファイルをデータURLとして読み込む（プレビュー表示用）
                const dataUrl = await this.readFileAsDataURL(file);
                
                // Officeファイルからテキストを抽出（GPT送信用）
                const extractedText = await this.extractTextFromOfficeFile(file);
                
                return {
                    type: 'office',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText // GPTに送信するテキスト内容
                };
            }
            // その他のファイルの場合
            else {
                // ファイルをデータURLとして読み込む（プレビュー表示用）
                const dataUrl = await this.readFileAsDataURL(file);

                // テキストとしてファイルの内容を読み込む
                const textContent = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error('ファイルの読み込みに失敗しました'));
                    reader.readAsText(file);
                });
                let extractedText = `=== ${file.type}ファイル「${file.name}」の内容 ===\n\n`;
                extractedText += textContent;
                return {
                    type: 'file',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText // ファイルの内容をそのまま代入
                };
            }
        } catch (error) {
            console.error('ファイル変換エラー:', error);
            // エラー時にも識別可能なオブジェクトを返す
            return {
                type: 'error',
                name: file ? file.name : 'unknown',
                error: error.message
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
            if (!file) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = function(e) {
                clearTimeout(timeoutId);
                resolve(e.target.result);
            };
            
            reader.onerror = function(e) {
                clearTimeout(timeoutId);
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(new Error('ファイルの読み込みに失敗しました'));
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
            if (!file) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = function(e) {
                clearTimeout(timeoutId);
                try {
                    const base64 = e.target.result.split(',')[1];
                    resolve(base64);
                } catch (e) {
                    console.error('Base64エンコードに失敗しました:', e);
                    reject(new Error('Base64エンコードに失敗しました'));
                }
            };
            
            reader.onerror = function(e) {
                clearTimeout(timeoutId);
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * 選択されたファイルをクリア
     */
    clearSelectedFiles: function() {
        this.selectedFiles = [];
        
        // プレビューをクリア - 全ての関連要素を確実に削除
        try {
            // FileHandler側のプレビュー
            const inputWrapper = document.querySelector('.input-wrapper');
            if (inputWrapper) {
                const filePreview = inputWrapper.querySelector('.file-preview');
                if (filePreview) {
                    filePreview.remove();
                }
            }
            
            // UI側のプレビュー
            const attachmentPreviewArea = document.querySelector('.attachment-preview-area');
            if (attachmentPreviewArea) {
                attachmentPreviewArea.innerHTML = '';
                attachmentPreviewArea.style.display = 'none';
            }
            
            // 保存済み添付ファイルをクリア
            this.savedAttachments = [];
            
            // 添付ファイル削除イベントを発火
            document.dispatchEvent(new CustomEvent('attachment-removed'));
        } catch (error) {
            console.error('ファイルプレビュークリアエラー:', error);
        }
    },
    
    /**
     * Azure OpenAI API用の添付ファイル形式に変換
     * @returns {Promise<Array>} API用に変換された添付ファイル配列
     */
    getAttachmentsForAPI: async function() {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            // 保存された添付ファイルがある場合はそれを返す
            if (this.savedAttachments && this.savedAttachments.length > 0) {
                return this.savedAttachments;
            }
            return [];
        }
        
        try {
            const attachments = await this._convertFilesToAttachments(this.selectedFiles);
            // エラーがあった添付ファイルを除外
            return attachments.filter(attachment => attachment.type !== 'error');
        } catch (error) {
            console.error('API用添付ファイル変換エラー:', error);
            return [];
        }
    },

        /**
         * 会話用の添付ファイルを保存する
         * @param {string} conversationId - 会話ID
         * @param {Array<Object>} attachments - 添付ファイルの配列
         */
        saveAttachmentsForConversation: function(conversationId, attachments) {
            if (!conversationId || !attachments || !Array.isArray(attachments)) return;
            
            try {
                // タイムスタンプを含めた添付ファイル情報を作成
                const attachmentData = {
                    timestamp: this.attachmentTimestamp || Date.now(),
                    files: attachments
                };
                
                // 添付ファイルをローカルストレージに保存
                window.Storage.saveAttachments(conversationId, attachmentData);
                
                // タイムスタンプをリセット
                this.attachmentTimestamp = null;
            } catch (error) {
                console.error('添付ファイルの保存中にエラーが発生しました:', error);
            }
        },
    
        /**
         * 会話の添付ファイルを読み込む
         * @param {string} conversationId - 会話ID
         * @returns {Object} タイムスタンプと添付ファイルの配列を含むオブジェクト
         */
        loadAttachmentsForConversation: function(conversationId) {
            if (!conversationId) return { timestamp: null, files: [] };
            
            try {
                // ローカルストレージから添付ファイルを読み込む
                const attachmentData = window.Storage.loadAttachments(conversationId) || { timestamp: null, files: [] };
                
                // 古い形式のデータを新しい形式に変換（互換性のため）
                if (Array.isArray(attachmentData)) {
                    const newFormat = {
                        timestamp: Date.now(),
                        files: attachmentData
                    };
                    this.savedAttachments = newFormat;
                    return newFormat;
                }
                
                this.savedAttachments = attachmentData;
                return attachmentData;
            } catch (error) {
                console.error('添付ファイルの読み込み中にエラーが発生しました:', error);
                return { timestamp: null, files: [] };
            }
        },
    
        /**
         * メッセージごとに添付ファイルを表示
         * @param {string} conversationId - 会話ID
         * @param {HTMLElement} chatMessages - チャットメッセージ表示エリア
         */
        displaySavedAttachments: function(conversationId, chatMessages) {
            if (!conversationId || !chatMessages) return;
            
            try {
                // 保存されている添付ファイルを読み込む
                const attachmentData = this.loadAttachmentsForConversation(conversationId);
                
                // attachmentDataが存在しない、または有効なファイルがない場合は処理をスキップ
                if (!attachmentData || !attachmentData.files || attachmentData.files.length === 0) {
                    return;
                }
                
                // タイムスタンプが存在しない場合は現在時刻を使用
                const timestamp = attachmentData.timestamp || Date.now();
                
                // 各メッセージに添付ファイルを表示
                const messages = chatMessages.querySelectorAll('.message');
                if (!messages || messages.length === 0) {
                    return;
                }
                
                // ユーザーメッセージを抽出
                const userMessages = Array.from(messages).filter(msg => msg.classList.contains('user'));
                if (userMessages.length === 0) {
                    return;
                }
                
                // 添付ファイルのタイムスタンプに最も近いメッセージを見つける
                let closestMessage = null;
                let minTimeDifference = Number.MAX_SAFE_INTEGER;
                
                userMessages.forEach((message) => {
                    // メッセージのタイムスタンプを取得
                    const messageTimestamp = parseInt(message.dataset.timestamp || '0', 10);
                    if (!messageTimestamp) {
                        return;
                    }
                    
                    // タイムスタンプの差分を計算（添付ファイルの送信タイミングに最も近いメッセージを選択）
                    const timeDiff = Math.abs(timestamp - messageTimestamp);
                    
                    if (timeDiff < minTimeDifference) {
                        minTimeDifference = timeDiff;
                        closestMessage = message;
                    }
                });
                
                // 最も近いメッセージが見つからない場合は最新のユーザーメッセージを使用
                if (!closestMessage && userMessages.length > 0) {
                    closestMessage = userMessages[userMessages.length - 1];
                }
                
                if (closestMessage) {
                    const messageContent = closestMessage.querySelector('.message-content');
                    if (messageContent) {
                        // すでに添付ファイルが表示されていない場合のみ表示
                        const existingAttachments = messageContent.querySelector('.message-attachments');
                        if (!existingAttachments) {
                            // ファイルだけを渡す
                            const attachmentsElement = window.Chat._createAttachmentsElement(attachmentData.files);
                            if (attachmentsElement) {
                                messageContent.appendChild(attachmentsElement);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('保存された添付ファイルの表示中にエラーが発生しました:', error);
            }
        },
    
    /**
     * PDFファイルからテキストを抽出する
     * @param {File} file - PDFファイル
     * @returns {Promise<string>} 抽出されたテキスト
     */
    extractTextFromPDF: async function(file) {
        if (!file || file.type !== 'application/pdf') {
            return Promise.reject(new Error('有効なPDFファイルではありません'));
        }
        
        try {
            // ファイルをArrayBufferとして読み込む
            const arrayBuffer = await this._readFileAsArrayBuffer(file);
            
            // PDF.jsを使用してPDFを読み込む
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            let extractedText = `=== PDFファイル「${file.name}」の内容 ===\n\n`;
            
            // 各ページからテキストを抽出
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                extractedText += `--- ページ ${i} ---\n`;
                
                // テキストアイテムを連結
                const pageText = textContent.items.map(item => item.str).join(' ');
                extractedText += pageText + '\n\n';
            }
            
            return extractedText;
        } catch (error) {
            console.error('PDFテキスト抽出エラー:', error);
            return `PDFファイル「${file.name}」からテキストを抽出できませんでした。`;
        }
    },
        
    /**
     * ファイルをArrayBufferとして読み込む
     * @private
     * @param {File} file - 読み込むファイル
     * @returns {Promise<ArrayBuffer>} ArrayBuffer形式のファイルデータ
     */
    _readFileAsArrayBuffer: function(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = function(e) {
                clearTimeout(timeoutId);
                resolve(e.target.result);
            };
            
            reader.onerror = function(e) {
                clearTimeout(timeoutId);
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    },
    
    /**
     * ファイルがOffice関連ファイルかどうかを判定する
     * @private
     * @param {string} mimeType - ファイルのMIMEタイプ
     * @returns {boolean} Office関連ファイルの場合はtrue
     */
    _isOfficeFile: function(mimeType) {
        if (!mimeType) return false;
        
        const officeTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];
        
        return officeTypes.includes(mimeType);
    },
    
    /**
     * Officeファイルからテキストを抽出する
     * @param {File} file - Officeファイル
     * @returns {Promise<string>} 抽出されたテキスト
     */
    extractTextFromOfficeFile: async function(file) {
        if (!file || !this._isOfficeFile(file.type)) {
            return Promise.reject(new Error('有効なOfficeファイルではありません'));
        }
        
        try {
            const fileType = this._getOfficeFileTypeName(file.type);
            
            // Excelファイル (.xlsx, .xls) の処理
            if (fileType === 'Excel') {
                return await this._extractTextFromExcelFile(file);
            }
            
            // PowerPointファイル (.pptx, .ppt) の処理
            if (fileType === 'PowerPoint') {
                return await this.readPowerPointFile(file);
            }
            
            // Wordファイル (.docx, .doc) の処理
            if (fileType === 'Word') {
                return await this._extractTextFromWordFile(file);
            }
            
            // その他のOfficeファイルの処理
            const fileBase64 = await this.readFileAsBase64(file);
            let extractedText = `=== ${fileType}ファイル「${file.name}」の内容 ===\n\n`;
            extractedText += this._extractTextFromBinaryData(fileBase64, file.type);
            
            if (extractedText.length < 100) {
                extractedText += `\n\n注: このファイルからのテキスト抽出は限定的です。`;
            }
            
            return extractedText;
        } catch (error) {
            console.error('Officeファイルテキスト抽出エラー:', error);
            return `${this._getOfficeFileTypeName(file.type)}ファイル「${file.name}」からテキストを抽出できませんでした。`;
        }
    },

    /**
     * SheetJSを使用してExcelファイルからテキストを抽出する
     * @private
     * @param {File} file - Excelファイル
     * @returns {Promise<string>} 抽出されたテキスト
     */
    _extractTextFromExcelFile: async function(file) {
        return new Promise((resolve, reject) => {
            try {
                // SheetJSライブラリが読み込まれているか確認
                if (typeof XLSX === 'undefined') {
                    console.error('SheetJS (XLSX) ライブラリが読み込まれていません');
                    return resolve(`Excelファイル「${file.name}」からのテキスト抽出に失敗しました。\nSheetJSライブラリが見つかりません。`);
                }
                
                // ファイルリーダーの作成
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    try {
                        // ファイルデータを取得
                        const data = e.target.result;
                        
                        // SheetJSを使用してワークブックを解析
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        let extractedText = `=== Excelファイル「${file.name}」の内容 ===\n\n`;
                        
                        // 各シートからデータを抽出
                        workbook.SheetNames.forEach(sheetName => {
                            // シート名をテキストに追加
                            extractedText += `--- シート: ${sheetName} ---\n\n`;
                            
                            // シートをJSONに変換
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                            
                            // シートが空でないことを確認
                            if (jsonData && jsonData.length > 0) {
                                // 各行を反復
                                jsonData.forEach((row, rowIndex) => {
                                    if (row && row.length > 0) {
                                        // 空でない行のみを追加
                                        const rowText = row.filter(cell => cell !== '').join('\t');
                                        if (rowText.trim()) {
                                            extractedText += rowText + '\n';
                                        }
                                    }
                                });
                                extractedText += '\n';
                            } else {
                                extractedText += '（空のシート）\n\n';
                            }
                        });
                        
                        resolve(extractedText);
                    } catch (error) {
                        console.error('Excel解析エラー:', error);
                        resolve(`Excelファイル「${file.name}」からのテキスト抽出に失敗しました。`);
                    }
                };
                
                reader.onerror = function() {
                    reject(new Error('ファイル読み込みエラー'));
                };
                
                // ファイルをArrayBufferとして読み込む（SheetJSに最適）
                reader.readAsArrayBuffer(file);
            } catch (error) {
                console.error('Excel処理エラー:', error);
                reject(error);
            }
        });
    },

    /**
     * Office関連ファイルの種類名を取得
     * @private
     * @param {string} mimeType - MIMEタイプ
     * @returns {string} ファイルの種類名
     */
    _getOfficeFileTypeName: function(mimeType) {
        if (!mimeType) return 'Office';
        
        if (mimeType.includes('word')) {
            return 'Word';
        } else if (mimeType.includes('excel') || mimeType.includes('sheet')) {
            return 'Excel';
        } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
            return 'PowerPoint';
        }
        
        return 'Office';
    },

    /**
     * バイナリデータからテキストを抽出する
     * @private
     * @param {string} base64Data - Base64エンコードされたデータ
     * @param {string} mimeType - MIMEタイプ
     * @returns {string} 抽出されたテキスト
     */
    _extractTextFromBinaryData: function(base64Data, mimeType) {
        // ここにバイナリデータからテキストを抽出するロジックを実装
        // 例: PDFファイルやOfficeファイルの解析ロジックを追加することができます
        return `このファイルは${this._getOfficeFileTypeName(mimeType)}ファイルです。`;
    },

    /**
     * PowerPointファイルを読み込んでテキストを抽出
     * @param {File} file - PowerPointファイル
     * @returns {Promise<string>} 抽出されたテキスト
     */
    readPowerPointFile: async function(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // スライドの一覧を取得
            const slideEntries = [];
            zip.forEach((path, zipEntry) => {
                if (path.match(/ppt\/slides\/slide[0-9]+\.xml$/)) {
                    slideEntries.push({
                        number: parseInt(path.match(/slide([0-9]+)\.xml$/)[1]),
                        entry: zipEntry
                    });
                }
            });
            
            // スライド番号でソート
            slideEntries.sort((a, b) => a.number - b.number);
            
            let result = [];
            
            // 各スライドの内容を処理
            for (const slideEntry of slideEntries) {
                const xmlContent = await zip.file(slideEntry.entry.name).async("text");
                const slideText = this._extractTextFromXML(xmlContent);
                
                if (slideText) {
                    result.push(`--- スライド ${slideEntry.number} ---\n${slideText}`);
                } else {
                    result.push(`--- スライド ${slideEntry.number} ---\n(テキストなし)`);
                }
            }
            
            if (result.length === 0) {
                return "=== PowerPointファイル「" + file.name + "」の内容 ===\n\nスライドが見つかりませんでした。";
            }
            
            return "=== PowerPointファイル「" + file.name + "」の内容 ===\n\n" + result.join("\n\n");
        } catch (error) {
            console.error("PowerPointファイル処理中のエラー:", error);
            throw new Error("PowerPointファイルの処理中にエラーが発生しました。");
        }
    },

    /**
     * PowerPointのXMLからテキストを抽出する補助メソッド
     * @param {string} xmlContent - スライドのXML内容
     * @returns {string} 抽出されたテキスト
     * @private
     */
    _extractTextFromXML: function(xmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            
            // テキスト要素を含む可能性のある要素を検索
            // a:t要素のみを直接取得し、重複を避ける
            const textElements = xmlDoc.getElementsByTagName('a:t');
            
            // 重複を防ぐためにSetを使用
            const uniqueTexts = new Set();
            
            // テキスト要素から内容を抽出
            Array.from(textElements).forEach(element => {
                const text = element.textContent.trim();
                if (text) {
                    uniqueTexts.add(text);
                }
            });

            // 重複のないテキストを配列に変換して結合
            return Array.from(uniqueTexts).join('\n');
        } catch (error) {
            console.error("XMLパース中のエラー:", error);
            return "";
        }
    },

    /**
     * Wordファイルからテキストを抽出する
     * @private
     * @param {File} file - Wordファイル
     * @returns {Promise<string>} 抽出されたテキスト
     */
    _extractTextFromWordFile: async function(file) {
        try {
            // mammoth.jsが読み込まれているか確認
            if (typeof mammoth === 'undefined') {
                console.error('mammoth.jsライブラリが読み込まれていません');
                return `Wordファイル「${file.name}」からのテキスト抽出に失敗しました。\nmammoth.jsライブラリが見つかりません。`;
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            
            if (result.value) {
                return `=== Wordファイル「${file.name}」の内容 ===\n\n${result.value}`;
            } else {
                const messages = result.messages.map(msg => msg.message).join('\n');
                console.warn('Word文書からのテキスト抽出の警告:', messages);
                return `=== Wordファイル「${file.name}」の内容 ===\n\n（テキストを抽出できませんでした）`;
            }
        } catch (error) {
            console.error('Word文書テキスト抽出エラー:', error);
            return `Wordファイル「${file.name}」からのテキスト抽出に失敗しました。`;
        }
    },
};