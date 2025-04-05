/**
 * HTMLExecutor.js
 * HTMLコードの実行を担当するクラス
 */
class HTMLExecutor {
    /**
     * HTMLコードを実行する
     * @param {string} code - 実行するHTMLコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Object} 実行結果（iframeのHTMLとして表示される）
     */
    static async execute(code, outputCallback) {
        try {
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'HTMLを処理しています...'
                });
            }

            let sanitizedHtml = code.trim();
            
            if (!sanitizedHtml.match(/<html[\s>]/i)) {
                const hasDoctype = sanitizedHtml.match(/<!DOCTYPE\s+html>/i);
                const hasHead = sanitizedHtml.match(/<head[\s>]/i);
                const hasBody = sanitizedHtml.match(/<body[\s>]/i);
                
                let resultHtml = '';
                
                if (!hasDoctype) {
                    resultHtml += '<!DOCTYPE html>\n';
                }
                
                if (!sanitizedHtml.match(/<html[\s>]/i)) {
                    resultHtml += '<html>\n';
                    
                    if (!hasHead) {
                        resultHtml += '<head>\n';
                        resultHtml += '  <meta charset="UTF-8">\n';
                        resultHtml += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
                        resultHtml += '  <title>HTML実行結果</title>\n';
                        resultHtml += '</head>\n';
                    }
                    
                    if (!hasBody) {
                        resultHtml += '<body>\n';
                        resultHtml += sanitizedHtml;
                        resultHtml += '\n</body>\n';
                    } else {
                        resultHtml += sanitizedHtml;
                    }
                    
                    resultHtml += '</html>';
                } else {
                    resultHtml = sanitizedHtml;
                }
                
                sanitizedHtml = resultHtml;
            }
            
            sanitizedHtml = ExecutorUtils.sanitizeHtml(sanitizedHtml);
            
            const result = {
                html: sanitizedHtml,
                type: 'html',
                executionTime: '0ms'
            };
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'result',
                    content: result
                });
            }
            
            return result;
        } catch (error) {
            console.error('HTML実行中にエラーが発生しました:', error);
            const errorResult = { 
                error: `HTMLの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: errorResult
                });
            }
            
            return errorResult;
        }
    }
}