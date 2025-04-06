/**
 * markdown.js
 * マークダウンのレンダリングとコードハイライト関連の機能を提供します
 * @class Markdown
 */
class Markdown {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {Markdown} Markdownのインスタンス
     */
    static get getInstance() {
        if (!Markdown.#instance) {
            Markdown.#instance = new Markdown();
        }
        return Markdown.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (Markdown.#instance) {
            throw new Error('Markdownクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }

        /**
         * ライブラリの準備状況
         * @private
         * @type {Object}
         */
        this._libraryStatus = {
            marked: false,
            prism: false
        };
    }

    /**
     * Markdownテキストをレンダリングします
     * @param {string} text - レンダリングするマークダウンテキスト
     * @returns {string} レンダリングされたHTML
     */
    async renderMarkdown(text) {
        if (!text) return '';
        
        try {
            // markedライブラリが利用可能かチェック
            if (typeof marked !== 'undefined') {
                // マークダウンオプションが設定されていなければ初期化
                if (!this._libraryStatus.marked) {
                    this.initializeMarkdown();
                }
                
                // Mermaidのサポートが有効で、mermaidブロックが検出された場合はmermaidライブラリをロード
                if (text.includes('```mermaid')) {
                    await this.#loadMermaid();
                }
                
                // マークダウンをレンダリング
                let renderedHtml = marked.parse(text);
                
                // mermaidブロックを探して処理
                if (typeof mermaid !== 'undefined') {
                    renderedHtml = await this.#processMermaidBlocks(renderedHtml);
                }
                
                return renderedHtml;
            } else {
                console.warn('マークダウンライブラリが読み込まれていません');
                return this.escapeHtml(text).replace(/\n/g, '<br>');
            }
        } catch (error) {
            console.error('マークダウンレンダリングエラー:', error);
            // エラー時はプレーンテキストとして表示
            return this.escapeHtml(text).replace(/\n/g, '<br>');
        }
    }
            
    /**
     * 特殊文字をHTMLエスケープします
     * @param {string} text - エスケープするテキスト
     * @returns {string} エスケープされたテキスト
     */
    escapeHtml(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * 外部スクリプトを動的に読み込みます
     * @param {string} src - スクリプトのURL
     * @param {Object} attributes - 追加の属性
     * @returns {Promise} スクリプト読み込み後に解決するPromise
     */
    loadScript(src, attributes = {}) {
        return new Promise((resolve, reject) => {
            // 既に読み込まれている場合はそのまま解決
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            
            // 追加の属性を設定
            Object.entries(attributes).forEach(([key, value]) => {
                script.setAttribute(key, value);
            });
            
            // イベントハンドラを設定
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`スクリプトの読み込みに失敗しました: ${src}`));
            
            // 読み込みタイムアウト
            const timeoutId = setTimeout(() => {
                reject(new Error(`スクリプトの読み込みがタイムアウトしました: ${src}`));
            }, 10000); // 10秒
            
            script.onload = () => {
                clearTimeout(timeoutId);
                resolve();
            };
            
            // DOMに追加
            document.head.appendChild(script);
        });
    }
    
    /**
     * マークダウンライブラリを初期化します
     * 構文ハイライトなどの設定を行います
     */
    initializeMarkdown() {
        // ライブラリのステータスを更新
        this._libraryStatus.marked = true;
        
        // マークダウンが未ロードの場合は何もしない
        if (typeof marked === 'undefined') {
            console.warn('マークダウンライブラリが読み込まれていません。ライブラリ読み込み後にこのメソッドを呼び出してください。');
            return;
        }
        
        // マークダウンのレンダリングオプション設定
        const options = {
            breaks: true,        // 改行を認識
            gfm: true,           // GitHub Flavored Markdown
            headerIds: false,    // ヘッダーIDを無効化
            mangle: false,       // リンクを難読化しない
            sanitize: false,     // HTMLタグを許可
        };
        
        // Prismが利用可能ならハイライト関数を設定
        if (typeof Prism !== 'undefined') {
            options.highlight = this.#highlightCode;
            this._libraryStatus.prism = true;
        }
        
        marked.setOptions(options);
    }
    
    /**
     * レンダリング済みHTMLからmermaidブロックを探して処理します
     * @private
     * @param {string} html - 処理するHTML
     * @returns {Promise<string>} 処理後のHTML
     */
    async #processMermaidBlocks(html) {
        if (!html || typeof mermaid === 'undefined') return html;
        
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            const mermaidBlocks = tempDiv.querySelectorAll('pre code.language-mermaid');
            
            if (!mermaidBlocks || mermaidBlocks.length === 0) return html;
            
            // イベントハンドラを保持するための配列
            const handlers = [];
            
            for (let i = 0; i < mermaidBlocks.length; i++) {
                const codeBlock = mermaidBlocks[i];
                const preElement = codeBlock.parentElement;
                if (!preElement) continue;
                
                const parentElement = preElement.parentElement;
                if (!parentElement) continue;

                // 現在の位置を記録
                const nextSibling = preElement.nextSibling;
                
                try {
                    const mermaidCode = codeBlock.textContent;
                    if (!mermaidCode.trim()) continue;
                    
                    // 要素を作成
                    const wrapperContainer = document.createElement('div');
                    wrapperContainer.classList.add('mermaid-wrapper');
                    wrapperContainer.setAttribute('data-mermaid-index', i);
                    
                    // ツールバーを作成
                    const toolbar = document.createElement('div');
                    toolbar.classList.add('mermaid-toolbar');

                    // テキストラベルを作成
                    const toolbarLabel = document.createElement('span');
                    toolbarLabel.textContent = 'mermaid出力';
                    toolbarLabel.style.marginRight = 'auto'; // 右側の余白を自動で取る
                    toolbarLabel.style.color = '#666';
                    toolbarLabel.style.fontSize = '0.9em';
                    toolbar.appendChild(toolbarLabel);

                    // ダウンロードボタンを追加
                    const downloadButton = document.createElement('button');
                    downloadButton.classList.add('mermaid-download');
                    downloadButton.setAttribute('type', 'button');
                    downloadButton.setAttribute('data-mermaid-index', i);
                    downloadButton.innerHTML = '<i class="fas fa-download"></i> SVG保存';
                    downloadButton.title = 'SVGファイルとして保存';
                    downloadButton.style.display = 'none'; // 初期状態では非表示
                    
                    const previewButton = document.createElement('button');
                    previewButton.classList.add('mermaid-preview-toggle');
                    previewButton.setAttribute('type', 'button');
                    previewButton.setAttribute('data-mermaid-index', i);
                    previewButton.innerHTML = '<i class="fas fa-eye"></i> プレビュー表示';
                    previewButton.title = 'プレビュー表示/コード表示を切り替え';
                    
                    // 順序を変更：ダウンロードボタンを先に追加
                    toolbar.appendChild(downloadButton);
                    toolbar.appendChild(previewButton);
                    
                    const codeContainer = document.createElement('div');
                    codeContainer.classList.add('mermaid-code-container');
                    codeContainer.setAttribute('data-mermaid-index', i);
                    
                    // ダイアグラム表示用の要素を作成
                    const diagramContainer = document.createElement('div');
                    diagramContainer.classList.add('mermaid-diagram', 'hidden');
                    diagramContainer.setAttribute('data-mermaid-index', i);
                    
                    const renderedDiagramId = `mermaid-diagram-${Date.now()}-${i}`;
                    diagramContainer.setAttribute('data-diagram-id', renderedDiagramId);
                    
                    const loadingElement = document.createElement('div');
                    loadingElement.classList.add('mermaid-loading');
                    loadingElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ダイアグラムを生成中...';
                    loadingElement.style.display = 'none';
                    loadingElement.setAttribute('data-mermaid-index', i);
                    
                    const errorElement = document.createElement('div');
                    errorElement.classList.add('mermaid-error');
                    errorElement.style.display = 'none';
                    errorElement.setAttribute('data-mermaid-index', i);
                    
                    // DOMツリーを構築
                    toolbar.appendChild(previewButton);
                    wrapperContainer.appendChild(toolbar);
                    wrapperContainer.appendChild(codeContainer);
                    wrapperContainer.appendChild(diagramContainer);
                    wrapperContainer.appendChild(loadingElement);
                    wrapperContainer.appendChild(errorElement);
                    
                    // 元のpreElementを移動
                    preElement.remove();
                    codeContainer.appendChild(preElement);
                    
                    // 元の位置に新しい要素を挿入（nextSiblingがnullの場合は最後に追加）
                    parentElement.insertBefore(wrapperContainer, nextSibling);
                    
                    // イベントハンドラを作成
                    const togglePreview = async (e) => {
                        const button = e.target.closest('.mermaid-preview-toggle');
                        if (!button) return;
                        
                        // ボタンを一時的に無効化して連打を防止
                        button.disabled = true;
                        
                        const index = button.getAttribute('data-mermaid-index');
                        const wrapper = button.closest('.mermaid-wrapper');
                        if (!wrapper) {
                            button.disabled = false;
                            return;
                        }
                        
                        const diagramContainer = wrapper.querySelector('.mermaid-diagram');
                        const codeContainer = wrapper.querySelector('.mermaid-code-container');
                        const loadingElement = wrapper.querySelector('.mermaid-loading');
                        const errorElement = wrapper.querySelector('.mermaid-error');
                        
                        if (!diagramContainer || !codeContainer || !loadingElement || !errorElement) {
                            button.disabled = false;
                            return;
                        }
                        
                        try {
                            const isPreviewMode = !diagramContainer.classList.contains('hidden');
                            
                            if (isPreviewMode) {
                                // プレビューモードから通常モードへ
                                await new Promise(resolve => {
                                    // CSSトランジションが完了するのを待つ
                                    requestAnimationFrame(() => {
                                        diagramContainer.classList.add('hidden');
                                        codeContainer.classList.remove('hidden');
                                        button.innerHTML = '<i class="fas fa-eye"></i> プレビュー表示';
                                        resolve();
                                    });
                                });
                            } else {
                                // 通常モードからプレビューモードへ
                                codeContainer.classList.add('hidden');
                                loadingElement.style.display = 'block';
                                button.innerHTML = '<i class="fas fa-code"></i> コード表示';
                                
                                // requestAnimationFrameを使用して画面の更新を待つ
                                await new Promise(resolve => {
                                    requestAnimationFrame(async () => {
                                        try {
                                            diagramContainer.classList.remove('hidden');
                                            
                                            // まだレンダリングされていないダイアグラムの場合
                                            if (!diagramContainer.hasAttribute('data-rendered')) {
                                                const diagramId = diagramContainer.getAttribute('data-diagram-id');
                                                const mermaidCode = wrapper.querySelector('pre code').textContent;
                                                
                                                // mermaidのレンダリングを待つ
                                                const { svg } = await mermaid.render(diagramId, mermaidCode);
                                                
                                                // 画面更新を待ってから要素を更新
                                                await new Promise(resolve => {
                                                    requestAnimationFrame(() => {
                                                        diagramContainer.innerHTML = svg;
                                                        resolve();
                                                    });
                                                });
                                                
                                                // SVGのスタイルを調整
                                                const svgElement = diagramContainer.querySelector('svg');
                                                if (svgElement) {
                                                    svgElement.style.maxWidth = '100%';
                                                    svgElement.style.height = 'auto';
                                                    
                                                    // エラー表示のSVGをチェックして非表示にする
                                                    if (svgElement.getAttribute('aria-roledescription') === 'error') {
                                                        svgElement.style.display = 'none';
                                                    } else {
                                                        // エラーでない場合はダウンロードボタンを表示
                                                        const downloadBtn = wrapper.querySelector('.mermaid-download');
                                                        if (downloadBtn) {
                                                            downloadBtn.style.display = 'flex';
                                                            
                                                            // ダウンロードボタンのクリックイベント
                                                            downloadBtn.addEventListener('click', (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                
                                                                // SVGをシリアライズ
                                                                const serializer = new XMLSerializer();
                                                                const source = serializer.serializeToString(svgElement);
                                                                
                                                                // SVGをBlobに変換
                                                                const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
                                                                const url = URL.createObjectURL(blob);
                                                                
                                                                // ダウンロードリンクを作成
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `diagram-${Date.now()}.svg`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                
                                                                // BlobURLを解放
                                                                setTimeout(() => URL.revokeObjectURL(url), 100);
                                                            });
                                                        }
                                                    }
                                                    
                                                    // クリック時の全画面表示用のスタイルとイベントを追加
                                                    svgElement.style.cursor = 'pointer';
                                                    svgElement.title = 'クリックで全画面表示';
                                                    
                                                    svgElement.addEventListener('click', (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        
                                                        // モーダル要素を作成
                                                        const modal = document.createElement('div');
                                                        modal.classList.add('mermaid-modal');
                                                        modal.style.cssText = `
                                                            position: fixed;
                                                            top: 0;
                                                            left: 0;
                                                            width: 100vw;
                                                            height: 100vh;
                                                            background: rgba(0, 0, 0, 0.8);
                                                            display: flex;
                                                            justify-content: center;
                                                            align-items: center;
                                                            z-index: 10000;
                                                            padding: 20px;
                                                            box-sizing: border-box;
                                                        `;
                                                        
                                                        // SVGのクローンを作成
                                                        const clonedSvg = svgElement.cloneNode(true);
                                                        clonedSvg.style.cssText = `
                                                            max-width: 95%;
                                                            max-height: 95%;
                                                            width: auto;
                                                            height: auto;
                                                            background: white;
                                                            padding: 20px;
                                                            border-radius: 8px;
                                                            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                                                        `;
                                                        
                                                        modal.appendChild(clonedSvg);
                                                        
                                                        // モーダルクリックで閉じる
                                                        modal.addEventListener('click', () => {
                                                            modal.remove();
                                                        });
                                                        
                                                        // ESCキーでも閉じる
                                                        document.addEventListener('keydown', function closeOnEsc(e) {
                                                            if (e.key === 'Escape') {
                                                                modal.remove();
                                                                document.removeEventListener('keydown', closeOnEsc);
                                                            }
                                                        });
                                                        
                                                        document.body.appendChild(modal);
                                                    });
                                                }
                                                
                                                diagramContainer.setAttribute('data-rendered', 'true');
                                            }
                                            errorElement.style.display = 'none';
                                        } catch (error) {
                                            console.error('Mermaidレンダリングエラー:', error);
                                            errorElement.style.display = 'block';
                                            errorElement.innerHTML = `
                                                <div class="error-message">
                                                    <i class="fas fa-exclamation-circle"></i>
                                                    ダイアグラムの生成に失敗しました: ${error.message || 'エラーが発生しました'}
                                                </div>
                                            `;
                                            diagramContainer.classList.add('hidden');
                                            codeContainer.classList.remove('hidden');
                                        } finally {
                                            loadingElement.style.display = 'none';
                                            resolve();
                                        }
                                    });
                                });
                            }
                        } finally {
                            // 処理完了後にボタンを再度有効化
                            button.disabled = false;
                        }
                    };
                    
                    // イベントハンドラをキャッシュ
                    handlers.push({ button: previewButton, handler: togglePreview });
                    
                } catch (blockError) {
                    console.error('mermaidブロック処理エラー:', blockError);
                    continue;
                }
            }
            
            const resultHtml = tempDiv.innerHTML;
            
            // イベントハンドラを実際のDOM要素に適用
            requestAnimationFrame(() => {
                handlers.forEach(({ handler }) => {
                    const buttons = document.querySelectorAll('.mermaid-preview-toggle');
                    buttons.forEach(button => {
                        button.addEventListener('click', handler);
                    });
                });
            });
            
            return resultHtml;
            
        } catch (error) {
            console.error('mermaidブロック処理中にエラーが発生しました:', error);
            return html;
        }
    }

    /**
     * コードブロックの構文ハイライトを行います
     * @private
     * @param {string} code - ハイライトするコード
     * @param {string} lang - 言語識別子
     * @returns {string} ハイライトされたHTML
     */
    #highlightCode(code, lang) {
        if (!code) return '';
        
        // Prismが利用可能で言語が指定されている場合のみハイライト
        if (typeof Prism !== 'undefined' && Prism.languages && lang && Prism.languages[lang]) {
            try {
                return Prism.highlight(code, Prism.languages[lang], lang);
            } catch (error) {
                console.error('構文ハイライトエラー:', error);
            }
        }
        
        // 失敗時やサポートされていない言語の場合はそのまま返す
        return code;
    }
    
    /**
     * Mermaidライブラリを読み込みます
     * @returns {Promise} ロード完了後に解決するPromise
     */
    async #loadMermaid() {
        try {
            // すでにロードされている場合は何もしない
            if (typeof mermaid !== 'undefined') {
                return Promise.resolve(true);
            }
            
            // mermaidライブラリをロード
            await this.loadScript('https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js');
            
            // 初期化
            await this.#initializeMermaid();
            
            return true;
        } catch (error) {
            console.error('Mermaidライブラリのロードに失敗しました:', error);
            return false;
        }
    }
    
    /**
     * Mermaidライブラリを初期化します
     */
    #initializeMermaid() {
        if (typeof mermaid === 'undefined') {
            console.warn('Mermaidライブラリが読み込まれていません');
            return Promise.resolve(false);
        }
        
        try {
            // Mermaidの初期設定
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'strict',
                suppressErrors: true, // エラーメッセージを抑制
                logLevel: 'fatal', // 最小限のログ出力
                flowchart: {
                    htmlLabels: true,
                    useMaxWidth: true
                },
                er: {
                    useMaxWidth: true
                },
                sequence: {
                    useMaxWidth: true
                },
                gantt: {
                    useMaxWidth: true
                }
            });

            // エラーハンドラーをオーバーライド
            mermaid.parseError = (err, hash) => {
                // エラーの表示を完全に抑制
                console.debug('Mermaid構文エラー:', err);
                return '';
            };
            
            return Promise.resolve(true);
        } catch (error) {
            console.error('Mermaidの初期化に失敗しました:', error);
            return Promise.resolve(false);
        }
    }
}
