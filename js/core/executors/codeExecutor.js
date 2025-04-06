/**
 * codeExecutor.js
 * コードスニペット実行機能を提供します
 */
class CodeExecutor {
    static #instance = null;
    
    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!CodeExecutor.#instance) {
            CodeExecutor.#instance = new CodeExecutor();
        }
        return CodeExecutor.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     * @throws {Error} 直接インスタンス化できないエラー
     */
    constructor() {
        if (CodeExecutor.#instance) {
            return CodeExecutor.#instance;
        }
        CodeExecutor.#instance = this;
    }

    /**
     * コードを実行する
     * @param {string} code - 実行するコード
     * @param {string} language - コードの言語
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async executeCode(code, language, outputCallback) {
        if (!code || !language) {
            return { error: '実行するコードまたは言語が指定されていません' };
        }
        
        language = language.toLowerCase();
        
        try {
            // 言語に応じて適切な実行メソッドを呼び出す
            switch (language) {
                case 'javascript':
                case 'js':
                    return await JavaScriptExecutor.getInstance.execute(code, outputCallback);
                case 'html':
                    return await HTMLExecutor.getInstance.execute(code, outputCallback);
                case 'python':
                case 'py':
                    return await PythonExecutor.getInstance.execute(code, outputCallback);
                case 'cpp':
                case 'c++':
                    return await CPPExecutor.getInstance.execute(code, outputCallback);
                default:
                    return { error: `${language}の実行は現在サポートされていません` };
            }
        } catch (error) {
            console.error('コード実行中にエラーが発生しました:', error);
            return { 
                error: `実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
        }
    }
}