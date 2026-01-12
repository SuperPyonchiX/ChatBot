/**
 * ToolExecutorBase.js
 * ツール実行クラスの基底クラス
 * 全ての具体的ツール実装はこのクラスを継承
 */
class ToolExecutorBase {
    /**
     * ツールを実行（サブクラスでオーバーライド必須）
     * @param {Object} params - ツールパラメータ
     * @returns {Promise<Object>} 実行結果
     */
    async execute(params) {
        throw new Error('execute() メソッドはサブクラスで実装する必要があります');
    }

    /**
     * パラメータを検証
     * @param {Object} params - ツールパラメータ
     * @param {Array<string>} required - 必須パラメータ名の配列
     * @throws {Error} 必須パラメータが不足している場合
     */
    validateParams(params, required = []) {
        if (!params || typeof params !== 'object') {
            throw new Error('パラメータはオブジェクトである必要があります');
        }

        for (const param of required) {
            if (params[param] === undefined || params[param] === null) {
                throw new Error(`必須パラメータ '${param}' が指定されていません`);
            }
        }
    }

    /**
     * ファイル結果を作成
     * @param {Blob} blob - ファイルのBlob
     * @param {string} filename - ファイル名
     * @param {string} mimeType - MIMEタイプ
     * @returns {Object} ファイル結果オブジェクト
     */
    createFileResult(blob, filename, mimeType) {
        return {
            type: 'file',
            filename: filename,
            mimeType: mimeType,
            blob: blob,
            size: blob.size,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * 画像結果を作成
     * @param {Blob} blob - 画像のBlob
     * @param {string} dataUrl - DataURL形式の画像
     * @param {number} width - 画像の幅
     * @param {number} height - 画像の高さ
     * @param {string} filename - ファイル名
     * @returns {Object} 画像結果オブジェクト
     */
    createImageResult(blob, dataUrl, width, height, filename) {
        return {
            type: 'image',
            filename: filename,
            mimeType: 'image/png',
            blob: blob,
            dataUrl: dataUrl,
            width: width,
            height: height,
            size: blob.size,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * テキスト結果を作成
     * @param {string} content - テキスト内容
     * @returns {Object} テキスト結果オブジェクト
     */
    createTextResult(content) {
        return {
            type: 'text',
            content: content,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * JSON結果を作成
     * @param {Object} data - JSONデータ
     * @returns {Object} JSON結果オブジェクト
     */
    createJsonResult(data) {
        return {
            type: 'json',
            data: data,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * エラー結果を作成
     * @param {string} message - エラーメッセージ
     * @param {Error} originalError - 元のエラーオブジェクト（オプション）
     * @returns {Object} エラー結果オブジェクト
     */
    createErrorResult(message, originalError = null) {
        return {
            type: 'error',
            message: message,
            originalError: originalError?.message || null,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * XMLをエスケープ
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    escapeXml(str) {
        if (!str) return '';
        return String(str).replace(/[<>&'"]/g, c => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            "'": '&apos;',
            '"': '&quot;'
        }[c]));
    }

    /**
     * ファイル名をサニタイズ
     * @param {string} filename - ファイル名
     * @returns {string} サニタイズされたファイル名
     */
    sanitizeFilename(filename) {
        if (!filename) return 'untitled';
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 200);
    }
}
