/**
 * ExecutorUtils.js
 * コード実行に関する共通ユーティリティ機能を提供します
 */
class ExecutorUtils {
    /**
     * コンソール引数をフォーマットする
     * @param {Array} args - コンソール出力の引数
     * @param {string} type - ログタイプ
     * @returns {Object} フォーマットされた出力
     */
    static formatConsoleArgs(args, type) {
        try {
            const formatted = args.map(arg => {
                if (arg === undefined) return 'undefined';
                if (arg === null) return 'null';
                
                try {
                    if (typeof arg === 'object') {
                        return JSON.stringify(arg);
                    }
                    return String(arg);
                } catch (e) {
                    return '[フォーマット不可能なオブジェクト]';
                }
            }).join(' ');
            
            return { type, content: formatted + '\n' };
        } catch (error) {
            console.error('コンソール出力のフォーマット中にエラーが発生しました:', error);
            return { type, content: '[出力フォーマットエラー]\n' };
        }
    }

    /**
     * サンドボックス環境を作成する
     * @returns {Object} サンドボックスオブジェクト
     */
    static createSandbox() {
        return {
            Array,
            Object,
            String,
            Number,
            Boolean,
            Date,
            Math,
            JSON,
            RegExp,
            Error,
            console: {},
            undefined: undefined,
            null: null,
            NaN: NaN,
            Infinity: Infinity,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            decodeURI,
            decodeURIComponent,
            encodeURI,
            encodeURIComponent,
            setTimeout: (cb, ms) => {
                if (ms > 5000) ms = 5000;
                return setTimeout(cb, ms);
            },
            clearTimeout,
            setInterval: (cb, ms) => {
                if (ms < 100) ms = 100;
                return setInterval(cb, ms);
            },
            clearInterval,
            Promise,
            print: (...args) => {
                console.log(...args);
                return args.join(' ');
            }
        };
    }

    /**
     * HTMLをサニタイズする
     * @param {string} html - サニタイズするHTML
     * @returns {string} サニタイズされたHTML
     */
    static sanitizeHtml(html) {
        try {
            const sanitized = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
                    if (match.match(/src\s*=\s*["']https?:\/\//i)) {
                        return '<!-- 外部スクリプトは安全のため削除されました -->';
                    }
                    return match;
                });
            
            const hasBaseTag = /<base\b/i.test(sanitized);
            if (!hasBaseTag) {
                return sanitized.replace(/<head\b[^>]*>/i, '$&<base target="_blank">');
            }
            
            return sanitized;
        } catch (error) {
            console.error('HTMLサニタイズ中にエラーが発生しました:', error);
            return '<p>HTMLのサニタイズに失敗しました</p>';
        }
    }
}