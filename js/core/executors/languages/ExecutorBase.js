/**
 * ExecutorBase.js
 * 言語実行クラスの基底クラス
 */
class ExecutorBase {
    constructor() {
        if (this.constructor === ExecutorBase) {
            throw new Error('ExecutorBaseは抽象クラスです。直接インスタンス化はできません。');
        }
    }

    /**
     * コードを実行する
     * @param {string} code - 実行するコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async execute(code, outputCallback) {
        throw new Error('execute()メソッドは実装クラスでオーバーライドする必要があります。');
    }

    /**
     * 実行環境のランタイムを読み込む
     * @protected
     * @returns {Promise<void>}
     */
    _loadRuntime() {
        throw new Error('_loadRuntime()メソッドは実装クラスでオーバーライドする必要があります。');
    }
}