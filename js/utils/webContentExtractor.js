/**
 * webContentExtractor.js
 * URLからコンテンツを抽出し、整形するユーティリティクラス
 */
class WebContentExtractor {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {WebContentExtractor} WebContentExtractorのシングルトンインスタンス
     */
    static get getInstance() {
        if (!WebContentExtractor.#instance) {
            WebContentExtractor.#instance = new WebContentExtractor();
        }
        return WebContentExtractor.#instance;
    }

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (WebContentExtractor.#instance) {
            throw new Error('WebContentExtractorクラスは直接インスタンス化できません。WebContentExtractor.instanceを使用してください。');
        }
    }

    /**
     * メッセージ内のURLから情報を取得する
     * @param {string} message - URLを検索するメッセージ
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @returns {Promise<{messageWithWebContents: string, hasWebContent: boolean}>} 処理されたメッセージとWeb情報の有無
     */
    async extractWebContents(message, chatMessages) {
        if (!message) return { messageWithWebContents: message, hasWebContent: false };

        try {
            const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
            const urls = message.match(urlRegex) || [];

            if (urls.length === 0) {
                return { messageWithWebContents: message, hasWebContent: false };
            }

            // 進捗状況を表示
            const progressElement = this.#showProgressIndicator(chatMessages);

            const urlResults = await Promise.all(urls.map(url => this.#fetchUrlContent(url)));
            
            // 進捗状況表示を削除
            progressElement?.remove();

            const urlContents = urlResults.map(result => result.content);
            const messageWithWebContents = message + '\n\n' + urlContents.join('\n\n');
            const hasWebContent = urlResults.some(result => !result.isError);

            return { messageWithWebContents, hasWebContent };
        } catch (error) {
            console.error('URL情報取得エラー:', error);
            return { messageWithWebContents: message, hasWebContent: false };
        }
    }

    /**
     * 進捗状況インジケータを表示
     * @private
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @returns {HTMLElement} 作成された進捗表示要素
     */
    #showProgressIndicator(chatMessages) {
        if (!chatMessages) return null;

        const messageDiv = ChatUI.getInstance.createElement('div', {
            classList: ['message', 'user'],
        });
        const contentDiv = ChatUI.getInstance.createElement('div');
        contentDiv.innerHTML = `
            <div class="message-content">
                <p>WEB情報取得中<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
            </div>
        `;
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        return messageDiv;
    }

    /**
     * URLの内容を取得する
     * @private
     * @param {string} url - スクレイピングするURL
     * @returns {Promise<{content: string, isError: boolean}>} ページの内容とエラー状態
     */
    async #fetchUrlContent(url) {
        try {
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // メタデータを抽出
            const title = doc.querySelector('title')?.textContent || '';
            const description = doc.querySelector('meta[name="description"]')?.content || '';
            const h1 = doc.querySelector('h1')?.textContent || '';

            // 本文のテキストを抽出（スクリプトとスタイルを除外）
            const bodyText = doc.body.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 1000); // 最初の1000文字に制限

            const content = `
### ${title || 'ウェブページの内容'}
${description ? `\n${description}\n` : ''}
${h1 ? `\n${h1}\n` : ''}
\n${bodyText}...\n
[元のページを表示](${url})
`;

            return { content, isError: false };
        } catch (error) {
            console.error('URLの内容取得に失敗しました:', error);
            return { 
                content: `\n> URLの内容を取得できませんでした: ${url}\n`,
                isError: true 
            };
        }
    }
}
