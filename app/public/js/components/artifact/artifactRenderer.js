/**
 * ArtifactRenderer
 * アーティファクトの各形式（HTML, SVG, Markdown, Mermaid）をレンダリングするクラス
 */
class ArtifactRenderer {
    static #instance = null;

    constructor() {
        if (ArtifactRenderer.#instance) {
            return ArtifactRenderer.#instance;
        }
        ArtifactRenderer.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ArtifactRenderer.#instance) {
            ArtifactRenderer.#instance = new ArtifactRenderer();
        }
        return ArtifactRenderer.#instance;
    }

    /**
     * アーティファクトをレンダリング
     * @param {Object} artifact - アーティファクトオブジェクト
     * @param {HTMLElement} container - レンダリング先のコンテナ
     * @returns {Promise<boolean>} レンダリング成功したかどうか
     */
    async render(artifact, container) {
        if (!artifact || !container) {
            console.error('[ArtifactRenderer] Invalid artifact or container');
            return false;
        }

        // コンテナをクリア
        container.innerHTML = '';

        try {
            switch (artifact.type) {
                case 'html':
                    await this.#renderHTML(artifact.content, container);
                    break;
                case 'svg':
                    this.#renderSVG(artifact.content, container);
                    break;
                case 'markdown':
                    await this.#renderMarkdown(artifact.content, container);
                    break;
                case 'mermaid':
                    await this.#renderMermaid(artifact.content, container);
                    break;
                case 'drawio':
                    await this.#renderDrawio(artifact.content, container);
                    break;
                case 'javascript':
                case 'typescript':
                case 'python':
                case 'cpp':
                    this.#renderCodePreview(artifact, container);
                    break;
                default:
                    console.warn(`[ArtifactRenderer] Unknown type: ${artifact.type}`);
                    this.#renderPlainText(artifact.content, container);
            }

            return true;
        } catch (error) {
            console.error('[ArtifactRenderer] Render error:', error);
            this.#renderError(error.message, container);
            return false;
        }
    }

    /**
     * HTMLをレンダリング（iframe sandbox使用）
     * @param {string} content - HTMLコンテンツ
     * @param {HTMLElement} container - コンテナ
     */
    async #renderHTML(content, container) {
        // サニタイズ処理
        const sanitizedHTML = this.#sanitizeHTML(content);

        // iframeを作成
        const iframe = document.createElement('iframe');
        iframe.classList.add('artifact-iframe');
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
        iframe.style.width = '100%';
        iframe.style.minHeight = '300px';
        iframe.style.border = 'none';
        iframe.style.backgroundColor = '#fff';
        iframe.style.borderRadius = 'var(--border-radius-sm)';

        container.appendChild(iframe);

        // iframeにコンテンツを書き込み
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(sanitizedHTML);
        doc.close();

        // 高さを自動調整
        iframe.onload = () => {
            this.#autoResizeIframe(iframe);
        };

        // ResizeObserverで高さを監視
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                this.#autoResizeIframe(iframe);
            });

            iframe.onload = () => {
                try {
                    if (iframe.contentDocument && iframe.contentDocument.body) {
                        resizeObserver.observe(iframe.contentDocument.body);
                    }
                } catch (e) {
                    // セキュリティエラーを無視
                }
                this.#autoResizeIframe(iframe);
            };
        }
    }

    /**
     * HTMLをサニタイズ
     * @param {string} html - HTMLコンテンツ
     * @returns {string} サニタイズされたHTML
     */
    #sanitizeHTML(html) {
        // 外部スクリプトを削除
        let sanitized = html.replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            (match) => {
                if (match.match(/src\s*=\s*["']https?:\/\//i)) {
                    return '<!-- 外部スクリプトは安全のため削除されました -->';
                }
                return match;
            }
        );

        // baseタグを追加（リンクを新規タブで開く）
        if (!sanitized.includes('<base')) {
            sanitized = sanitized.replace(
                /<head\b[^>]*>/i,
                '$&<base target="_blank">'
            );
        }

        return sanitized;
    }

    /**
     * iframeの高さを自動調整
     * @param {HTMLIFrameElement} iframe - iframe要素
     */
    #autoResizeIframe(iframe) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && doc.body) {
                const height = Math.max(
                    300,
                    doc.body.scrollHeight + 30,
                    doc.documentElement.scrollHeight + 30
                );
                iframe.style.height = `${Math.min(height, 800)}px`;
            }
        } catch (e) {
            // セキュリティエラーを無視
            iframe.style.height = '400px';
        }
    }

    /**
     * SVGをレンダリング
     * @param {string} content - SVGコンテンツ
     * @param {HTMLElement} container - コンテナ
     */
    #renderSVG(content, container) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('artifact-svg-wrapper');
        wrapper.innerHTML = content;

        // SVG要素のスタイルを調整
        const svgElement = wrapper.querySelector('svg');
        if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
        }

        container.appendChild(wrapper);
    }

    /**
     * Markdownをレンダリング
     * @param {string} content - Markdownコンテンツ
     * @param {HTMLElement} container - コンテナ
     */
    async #renderMarkdown(content, container) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('artifact-markdown-wrapper', 'markdown-content');

        // Markdownクラスを使用してレンダリング
        if (typeof Markdown !== 'undefined') {
            const renderedHTML = await Markdown.getInstance.renderMarkdown(content);
            wrapper.innerHTML = renderedHTML;
        } else {
            // フォールバック: marked.jsを直接使用
            if (typeof marked !== 'undefined') {
                wrapper.innerHTML = marked.parse(content);
            } else {
                // さらにフォールバック: プレーンテキスト
                wrapper.textContent = content;
            }
        }

        // Prismによるシンタックスハイライト
        if (typeof Prism !== 'undefined') {
            Prism.highlightAllUnder(wrapper);
        }

        container.appendChild(wrapper);
    }

    /**
     * Mermaid図をレンダリング
     * @param {string} content - Mermaidコード
     * @param {HTMLElement} container - コンテナ
     */
    async #renderMermaid(content, container) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('artifact-mermaid-wrapper');

        // Mermaidライブラリをロード
        await this.#loadMermaid();

        if (typeof mermaid === 'undefined') {
            throw new Error('Mermaidライブラリをロードできませんでした');
        }

        try {
            const diagramId = `artifact-mermaid-${Date.now()}`;
            const { svg } = await mermaid.render(diagramId, content);
            wrapper.innerHTML = svg;

            // SVGのスタイルを調整
            const svgElement = wrapper.querySelector('svg');
            if (svgElement) {
                svgElement.style.maxWidth = '100%';
                svgElement.style.height = 'auto';
            }
        } catch (error) {
            console.error('[ArtifactRenderer] Mermaid render error:', error);
            throw new Error(`Mermaid図の生成に失敗しました: ${error.message}`);
        }

        container.appendChild(wrapper);
    }

    /**
     * Draw.io図をレンダリング
     * @param {string} content - Draw.io XMLコンテンツ
     * @param {HTMLElement} container - コンテナ
     */
    async #renderDrawio(content, container) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('artifact-drawio-wrapper');

        // 設定を取得
        const config = window.CONFIG?.DRAWIO || {
            EMBED_URL: 'https://embed.diagrams.net/',
            PARAMS: { embed: 1, spin: 1, proto: 'json', configure: 1 }
        };

        // iframeを作成
        const iframe = document.createElement('iframe');
        iframe.classList.add('drawio-iframe');

        // URLパラメータを構築
        const params = new URLSearchParams(config.PARAMS);
        iframe.src = `${config.EMBED_URL}?${params.toString()}`;

        // メッセージハンドラを設定
        const messageHandler = (event) => {
            if (event.origin !== 'https://embed.diagrams.net') {
                return;
            }

            try {
                const message = JSON.parse(event.data);

                if (message.event === 'init') {
                    // Draw.ioが初期化されたらXMLを読み込み
                    iframe.contentWindow.postMessage(JSON.stringify({
                        action: 'load',
                        xml: content
                    }), '*');
                } else if (message.event === 'configure') {
                    // UI設定を送信
                    iframe.contentWindow.postMessage(JSON.stringify({
                        action: 'configure',
                        config: {
                            defaultFonts: ['Helvetica', 'Verdana', 'メイリオ', 'ＭＳ Ｐゴシック']
                        }
                    }), '*');
                } else if (message.event === 'load') {
                    console.log('[ArtifactRenderer] Draw.io図を読み込みました');
                } else if (message.event === 'save') {
                    // 保存イベント（編集後のXMLを取得可能）
                    console.log('[ArtifactRenderer] Draw.io図が保存されました');
                }
            } catch (e) {
                // JSON解析エラーは無視
            }
        };

        window.addEventListener('message', messageHandler);

        // iframeがアンマウントされたらリスナーを削除
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const removedNode of mutation.removedNodes) {
                    if (removedNode === wrapper || removedNode.contains(wrapper)) {
                        window.removeEventListener('message', messageHandler);
                        observer.disconnect();
                        return;
                    }
                }
            }
        });
        observer.observe(container.parentElement || document.body, { childList: true, subtree: true });

        wrapper.appendChild(iframe);
        container.appendChild(wrapper);
    }

    /**
     * Mermaidライブラリをロード
     */
    async #loadMermaid() {
        if (typeof mermaid !== 'undefined') {
            return;
        }

        // Markdownクラスのメソッドを使用
        if (typeof Markdown !== 'undefined') {
            await Markdown.getInstance.loadScript(
                'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js'
            );
        } else {
            // フォールバック
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        // Mermaidを初期化
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'strict',
                theme: 'default'
            });
        }
    }

    /**
     * プレーンテキストとしてレンダリング
     * @param {string} content - テキストコンテンツ
     * @param {HTMLElement} container - コンテナ
     */
    #renderPlainText(content, container) {
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordBreak = 'break-word';
        pre.style.padding = 'var(--spacing-md)';
        pre.style.backgroundColor = 'var(--background-tertiary)';
        pre.style.borderRadius = 'var(--border-radius-sm)';
        pre.textContent = content;
        container.appendChild(pre);
    }

    /**
     * コードプレビューをレンダリング（JavaScript, TypeScript, Python, C++用）
     * @param {Object} artifact - アーティファクト
     * @param {HTMLElement} container - コンテナ
     */
    #renderCodePreview(artifact, container) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('artifact-code-preview');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.height = '100%';
        wrapper.style.gap = 'var(--spacing-md)';

        // 説明メッセージ
        const infoDiv = document.createElement('div');
        infoDiv.style.padding = 'var(--spacing-md)';
        infoDiv.style.backgroundColor = 'var(--background-tertiary)';
        infoDiv.style.borderRadius = 'var(--border-radius-sm)';
        infoDiv.style.display = 'flex';
        infoDiv.style.alignItems = 'center';
        infoDiv.style.gap = 'var(--spacing-sm)';
        infoDiv.style.color = 'var(--text-secondary)';
        infoDiv.style.fontSize = 'var(--font-size-sm)';
        infoDiv.innerHTML = `
            <i class="fas fa-play-circle" style="color: var(--accent-success);"></i>
            <span>上部の <strong>実行ボタン</strong> を押してコードを実行できます</span>
        `;
        wrapper.appendChild(infoDiv);

        // コードブロック
        const pre = document.createElement('pre');
        pre.style.flex = '1';
        pre.style.margin = '0';
        pre.style.padding = 'var(--spacing-md)';
        pre.style.backgroundColor = 'var(--code-bg)';
        pre.style.borderRadius = 'var(--border-radius-sm)';
        pre.style.overflow = 'auto';

        const code = document.createElement('code');
        const prismLang = this.#getPrismLanguage(artifact.type);
        code.classList.add(`language-${prismLang}`);
        code.textContent = artifact.content;

        pre.appendChild(code);
        wrapper.appendChild(pre);
        container.appendChild(wrapper);

        // Prismによるシンタックスハイライト
        if (typeof Prism !== 'undefined') {
            Prism.highlightElement(code);
        }
    }

    /**
     * Prism用の言語名を取得
     * @param {string} type - アーティファクトタイプ
     * @returns {string} Prism言語名
     */
    #getPrismLanguage(type) {
        const langMap = {
            'javascript': 'javascript',
            'typescript': 'typescript',
            'python': 'python',
            'cpp': 'cpp'
        };
        return langMap[type] || type;
    }

    /**
     * エラー表示をレンダリング
     * @param {string} message - エラーメッセージ
     * @param {HTMLElement} container - コンテナ
     */
    #renderError(message, container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.padding = 'var(--spacing-lg)';
        errorDiv.style.backgroundColor = 'var(--code-bg-error)';
        errorDiv.style.color = 'var(--code-text-error)';
        errorDiv.style.borderRadius = 'var(--border-radius-sm)';
        errorDiv.style.textAlign = 'center';

        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: var(--spacing-sm);"></i>
            <p style="margin: 0;">レンダリングエラー: ${this.#escapeHTML(message)}</p>
        `;

        container.appendChild(errorDiv);
    }

    /**
     * HTMLエスケープ
     * @param {string} text - テキスト
     * @returns {string} エスケープされたテキスト
     */
    #escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * コードをレンダリング（コードタブ用）
     * @param {Object} artifact - アーティファクト
     * @param {HTMLElement} container - コンテナ
     */
    renderCode(artifact, container) {
        if (!artifact || !container) return;

        container.innerHTML = '';

        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.padding = 'var(--spacing-md)';
        pre.style.backgroundColor = 'var(--code-bg)';
        pre.style.overflow = 'auto';
        pre.style.height = '100%';

        const code = document.createElement('code');
        code.classList.add(`language-${artifact.language || artifact.type}`);
        code.textContent = artifact.content;

        pre.appendChild(code);
        container.appendChild(pre);

        // Prismによるシンタックスハイライト
        if (typeof Prism !== 'undefined') {
            Prism.highlightElement(code);
        }
    }
}
