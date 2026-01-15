/**
 * fileReadTool.js
 * ファイル読み込みツール
 * 添付ファイルの内容を読み取る
 */

/**
 * @typedef {Object} FileReadResult
 * @property {boolean} success - 成功したかどうか
 * @property {string} fileName - ファイル名
 * @property {string} [content] - ファイル内容
 * @property {string} [mimeType] - MIMEタイプ
 * @property {number} [size] - ファイルサイズ
 * @property {string} [error] - エラーメッセージ
 */

class FileReadTool {
    static #instance = null;

    /** @type {string} */
    name = 'file_read';

    /** @type {string} */
    description = '添付されたファイルの内容を読み取ります。テキスト、PDF、Office文書などに対応。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: '読み取るファイルのID'
            },
            encoding: {
                type: 'string',
                description: 'テキストエンコーディング（デフォルト: utf-8）'
            },
            maxLength: {
                type: 'number',
                description: '読み取る最大文字数（デフォルト: 50000）'
            }
        },
        required: ['fileId']
    };

    /** @type {string[]} */
    keywords = ['ファイル', '読み込み', '添付', '内容', 'file', 'read', 'attachment', 'content', 'document'];

    /** @type {Map<string, Object>} */
    #fileCache = new Map();

    /** @type {number} */
    #defaultMaxLength = 50000;

    /**
     * @constructor
     */
    constructor() {
        if (FileReadTool.#instance) {
            return FileReadTool.#instance;
        }
        FileReadTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {FileReadTool}
     */
    static get getInstance() {
        if (!FileReadTool.#instance) {
            FileReadTool.#instance = new FileReadTool();
        }
        return FileReadTool.#instance;
    }

    /**
     * ファイルを登録（添付時に呼び出し）
     * @param {string} fileId - ファイルID
     * @param {File|Blob} file - ファイルオブジェクト
     * @param {Object} [metadata] - メタデータ
     */
    registerFile(fileId, file, metadata = {}) {
        this.#fileCache.set(fileId, {
            file,
            metadata: {
                ...metadata,
                name: file.name || metadata.name || 'unknown',
                type: file.type || metadata.type || 'application/octet-stream',
                size: file.size || metadata.size || 0,
                registeredAt: Date.now()
            }
        });
        console.log(`[FileReadTool] ファイル登録: ${fileId} (${file.name})`);
    }

    /**
     * 登録ファイル一覧を取得
     * @returns {Array<{fileId: string, name: string, type: string, size: number}>}
     */
    getRegisteredFiles() {
        const files = [];
        for (const [fileId, data] of this.#fileCache.entries()) {
            files.push({
                fileId,
                name: data.metadata.name,
                type: data.metadata.type,
                size: data.metadata.size
            });
        }
        return files;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.fileId - ファイルID
     * @param {string} [params.encoding='utf-8'] - エンコーディング
     * @param {number} [params.maxLength] - 最大文字数
     * @returns {Promise<FileReadResult>}
     */
    async execute(params) {
        const { fileId, encoding = 'utf-8', maxLength = this.#defaultMaxLength } = params;

        if (!fileId) {
            return {
                success: false,
                fileName: '',
                error: 'ファイルIDが指定されていません'
            };
        }

        const cached = this.#fileCache.get(fileId);

        if (!cached) {
            return {
                success: false,
                fileName: '',
                error: `ファイルが見つかりません: ${fileId}`
            };
        }

        const { file, metadata } = cached;

        try {
            let content;

            // MIMEタイプに応じて処理
            if (this.#isTextFile(metadata.type, metadata.name)) {
                content = await this.#readAsText(file, encoding);
            } else if (this.#isPdf(metadata.type, metadata.name)) {
                content = await this.#readPdf(file);
            } else if (this.#isOfficeDocument(metadata.type, metadata.name)) {
                content = await this.#readOfficeDocument(file, metadata.name);
            } else if (this.#isImage(metadata.type)) {
                content = `[画像ファイル: ${metadata.name}] サイズ: ${this.#formatSize(metadata.size)}, タイプ: ${metadata.type}`;
            } else {
                content = await this.#readAsText(file, encoding).catch(() =>
                    `[バイナリファイル: ${metadata.name}] サイズ: ${this.#formatSize(metadata.size)}, タイプ: ${metadata.type}`
                );
            }

            // 長さ制限
            if (content.length > maxLength) {
                content = content.substring(0, maxLength) + `\n\n... (${this.#formatSize(metadata.size)}中 ${maxLength}文字まで表示)`;
            }

            return {
                success: true,
                fileName: metadata.name,
                content: content,
                mimeType: metadata.type,
                size: metadata.size
            };
        } catch (error) {
            console.error('[FileReadTool] 読み込みエラー:', error);
            return {
                success: false,
                fileName: metadata.name,
                error: `読み込みエラー: ${error.message}`
            };
        }
    }

    /**
     * テキストファイルかどうか
     * @param {string} mimeType
     * @param {string} fileName
     * @returns {boolean}
     */
    #isTextFile(mimeType, fileName) {
        if (mimeType.startsWith('text/')) return true;
        if (mimeType === 'application/json') return true;
        if (mimeType === 'application/xml') return true;
        if (mimeType === 'application/javascript') return true;

        const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.yaml', '.yml', '.csv', '.log', '.sh', '.bat'];
        return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * PDFかどうか
     * @param {string} mimeType
     * @param {string} fileName
     * @returns {boolean}
     */
    #isPdf(mimeType, fileName) {
        return mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    }

    /**
     * Office文書かどうか
     * @param {string} mimeType
     * @param {string} fileName
     * @returns {boolean}
     */
    #isOfficeDocument(mimeType, fileName) {
        const officeTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint'
        ];
        if (officeTypes.includes(mimeType)) return true;

        const officeExtensions = ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'];
        return officeExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * 画像かどうか
     * @param {string} mimeType
     * @returns {boolean}
     */
    #isImage(mimeType) {
        return mimeType.startsWith('image/');
    }

    /**
     * テキストとして読み込み
     * @param {File|Blob} file
     * @param {string} encoding
     * @returns {Promise<string>}
     */
    async #readAsText(file, encoding) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file, encoding);
        });
    }

    /**
     * PDFを読み込み
     * @param {File|Blob} file
     * @returns {Promise<string>}
     */
    async #readPdf(file) {
        // PDF.jsを使用
        if (!window.pdfjsLib) {
            return '[PDF読み込みエラー: PDF.jsが読み込まれていません]';
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            const texts = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                texts.push(`--- ページ ${i} ---\n${pageText}`);
            }

            return texts.join('\n\n');
        } catch (error) {
            throw new Error(`PDF解析エラー: ${error.message}`);
        }
    }

    /**
     * Office文書を読み込み
     * @param {File|Blob} file
     * @param {string} fileName
     * @returns {Promise<string>}
     */
    async #readOfficeDocument(file, fileName) {
        const lowerName = fileName.toLowerCase();

        if (lowerName.endsWith('.docx')) {
            return this.#readDocx(file);
        } else if (lowerName.endsWith('.xlsx')) {
            return this.#readXlsx(file);
        } else if (lowerName.endsWith('.pptx')) {
            return this.#readPptx(file);
        } else {
            return `[Office文書: ${fileName}] 旧形式のOffice文書は対応していません`;
        }
    }

    /**
     * Word文書（.docx）を読み込み
     * @param {File|Blob} file
     * @returns {Promise<string>}
     */
    async #readDocx(file) {
        if (!window.mammoth) {
            return '[Word読み込みエラー: Mammoth.jsが読み込まれていません]';
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            return result.value || '(内容なし)';
        } catch (error) {
            throw new Error(`Word解析エラー: ${error.message}`);
        }
    }

    /**
     * Excel文書（.xlsx）を読み込み
     * @param {File|Blob} file
     * @returns {Promise<string>}
     */
    async #readXlsx(file) {
        if (!window.XLSX) {
            return '[Excel読み込みエラー: SheetJSが読み込まれていません]';
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });

            const texts = [];
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const csv = window.XLSX.utils.sheet_to_csv(sheet);
                texts.push(`--- シート: ${sheetName} ---\n${csv}`);
            }

            return texts.join('\n\n') || '(内容なし)';
        } catch (error) {
            throw new Error(`Excel解析エラー: ${error.message}`);
        }
    }

    /**
     * PowerPoint文書（.pptx）を読み込み
     * @param {File|Blob} file
     * @returns {Promise<string>}
     */
    async #readPptx(file) {
        if (!window.JSZip) {
            return '[PowerPoint読み込みエラー: JSZipが読み込まれていません]';
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await window.JSZip.loadAsync(arrayBuffer);

            const texts = [];
            const slideFiles = Object.keys(zip.files)
                .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
                .sort();

            for (const slidePath of slideFiles) {
                const slideContent = await zip.files[slidePath].async('text');
                const parser = new DOMParser();
                const doc = parser.parseFromString(slideContent, 'application/xml');

                // テキストを抽出
                const textNodes = doc.getElementsByTagName('a:t');
                const slideTexts = [];
                for (const node of textNodes) {
                    if (node.textContent) {
                        slideTexts.push(node.textContent);
                    }
                }

                const slideNumber = slidePath.match(/slide(\d+)\.xml/)?.[1] || '?';
                texts.push(`--- スライド ${slideNumber} ---\n${slideTexts.join(' ')}`);
            }

            return texts.join('\n\n') || '(内容なし)';
        } catch (error) {
            throw new Error(`PowerPoint解析エラー: ${error.message}`);
        }
    }

    /**
     * ファイルサイズをフォーマット
     * @param {number} bytes
     * @returns {string}
     */
    #formatSize(bytes) {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    /**
     * キャッシュをクリア
     * @param {string} [fileId] - 特定のファイルIDのみクリア
     */
    clearCache(fileId) {
        if (fileId) {
            this.#fileCache.delete(fileId);
        } else {
            this.#fileCache.clear();
        }
    }

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

// グローバルに公開
window.FileReadTool = FileReadTool;
