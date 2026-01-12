/**
 * ragManager.js
 * RAG（Retrieval-Augmented Generation）機能の統合マネージャー
 * ドキュメント追加、検索、プロンプト拡張を統括
 */

class RAGManager {
    static #instance = null;

    /** @type {boolean} */
    #enabled = false;

    /** @type {boolean} */
    #initialized = false;

    /**
     * シングルトンインスタンスを取得
     * @returns {RAGManager}
     */
    static get getInstance() {
        if (!RAGManager.#instance) {
            RAGManager.#instance = new RAGManager();
        }
        return RAGManager.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (RAGManager.#instance) {
            throw new Error('RAGManager is a singleton. Use RAGManager.getInstance instead.');
        }
    }

    /**
     * RAGシステムを初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        try {
            // VectorStoreを初期化
            await VectorStore.getInstance.initialize();

            // 保存されたRAG有効状態を復元
            const savedEnabled = Storage.getInstance.getItem(window.CONFIG.STORAGE.KEYS.RAG_ENABLED);
            this.#enabled = savedEnabled === 'true';

            this.#initialized = true;
            console.log(`✅ RAGManager initialized (enabled: ${this.#enabled})`);
        } catch (error) {
            console.error('❌ RAGManager initialization error:', error);
            throw error;
        }
    }

    /**
     * RAGが有効かどうか
     * @returns {boolean}
     */
    get isEnabled() {
        return this.#enabled;
    }

    /**
     * RAGの有効/無効を設定
     * @param {boolean} value
     */
    set isEnabled(value) {
        this.#enabled = value;
        Storage.getInstance.setItem(window.CONFIG.STORAGE.KEYS.RAG_ENABLED, value.toString());
        console.log(`📚 RAG ${value ? 'enabled' : 'disabled'}`);
    }

    /**
     * ドキュメントをナレッジベースに追加
     * @param {File} file - 追加するファイル
     * @param {function} [onProgress] - 進捗コールバック (stage, current, total)
     * @returns {Promise<{docId: string, chunkCount: number}>}
     */
    async addDocument(file, onProgress) {
        await this.#ensureInitialized();

        const docId = this.#generateId();

        try {
            // ステージ1: テキスト抽出とチャンキング
            if (onProgress) onProgress('chunking', 0, 1);
            const { text, chunks } = await DocumentChunker.getInstance.chunkDocument(file);

            if (chunks.length === 0) {
                throw new Error('ファイルからテキストを抽出できませんでした');
            }

            console.log(`📄 Extracted ${chunks.length} chunks from ${file.name}`);

            // チャンクにファイル名メタデータを追加（検索精度向上のため）
            const chunksWithMetadata = chunks.map(text =>
                `[ドキュメント: ${file.name}]\n${text}`
            );

            // ステージ2: 埋め込みベクトルの取得（メタデータ付きテキストから生成）
            const embeddings = await EmbeddingAPI.getInstance.getEmbeddings(
                chunksWithMetadata,
                (current, total) => {
                    if (onProgress) onProgress('embedding', current, total);
                }
            );

            // ステージ3: データベースに保存
            if (onProgress) onProgress('saving', 0, 1);

            // ドキュメントメタデータを保存
            await VectorStore.getInstance.addDocument({
                id: docId,
                name: file.name,
                type: file.type,
                size: file.size,
                chunkCount: chunks.length
            });

            // チャンクを保存
            const chunkRecords = chunksWithMetadata.map((text, index) => ({
                id: `${docId}_${index}`,
                docId: docId,
                text: text,
                embedding: embeddings[index],
                position: index
            }));

            await VectorStore.getInstance.addChunks(chunkRecords);

            if (onProgress) onProgress('complete', 1, 1);

            console.log(`✅ Document added: ${file.name} (${chunks.length} chunks)`);

            return { docId, chunkCount: chunks.length };
        } catch (error) {
            // エラー時はドキュメントを削除（部分的に保存されている可能性）
            try {
                await VectorStore.getInstance.deleteDocument(docId);
            } catch {
                // 削除失敗は無視
            }
            console.error('❌ Failed to add document:', error);
            throw error;
        }
    }

    /**
     * ドキュメントをナレッジベースから削除
     * @param {string} docId - ドキュメントID
     * @returns {Promise<void>}
     */
    async removeDocument(docId) {
        await this.#ensureInitialized();
        await VectorStore.getInstance.deleteDocument(docId);
        console.log(`🗑️ Document removed: ${docId}`);
    }

    /**
     * Confluenceスペースからドキュメントを追加（差分更新対応）
     * @param {string} spaceKey - スペースキー
     * @param {string} [spaceName] - スペース名（省略時はspaceKeyを使用）
     * @param {function} [onProgress] - 進捗コールバック (progressInfo)
     * @returns {Promise<{pageCount: number, chunkCount: number, newCount: number, updateCount: number, skipCount: number}>}
     */
    async addConfluenceSpace(spaceKey, spaceName, onProgress) {
        await this.#ensureInitialized();

        // ConfluenceDataSourceが利用可能か確認
        if (typeof ConfluenceDataSource === 'undefined') {
            throw new Error('ConfluenceDataSource が利用できません');
        }

        const confluence = ConfluenceDataSource.getInstance;
        if (!confluence.isConfigured()) {
            throw new Error('Confluence接続設定が完了していません');
        }

        let totalChunks = 0;
        const failedPages = [];

        try {
            // ページ取得フェーズ
            if (onProgress) onProgress({
                stage: 'fetching',
                current: 0,
                total: 0,
                message: 'ページ一覧を取得中...'
            });

            const pages = await confluence.getSpacePages(spaceKey, (current, total) => {
                if (onProgress) onProgress({
                    stage: 'fetching',
                    current,
                    total,
                    message: `ページを取得中: ${current}/${total}`
                });
            });

            if (pages.length === 0) {
                throw new Error('スペース内にページが見つかりません');
            }

            console.log(`📄 Confluenceスペース ${spaceKey}: ${pages.length}ページを取得`);

            // 既存のConfluenceドキュメントを取得してマップを作成
            if (onProgress) onProgress({
                stage: 'analyzing',
                current: 0,
                total: pages.length,
                message: '既存ドキュメントを分析中...'
            });

            const existingDocs = await VectorStore.getInstance.getConfluenceDocuments();
            const existingMap = new Map();
            for (const doc of existingDocs) {
                // confluencePageIdを優先、なければsourceUrlから抽出
                const pageId = doc.confluencePageId || this.#extractPageIdFromUrl(doc.sourceUrl);
                if (pageId) {
                    existingMap.set(pageId, {
                        id: doc.id,
                        lastModified: doc.lastModified
                    });
                }
            }

            // 各ページを分類（新規 / 更新 / 未変更 / 空）
            const toProcess = [];  // { page, action: 'new' | 'update', existingDocId? }
            const skipped = [];    // 未変更ページ（差分更新でスキップ）
            const emptyPages = []; // 空ページ（コンテンツなし）

            for (const page of pages) {
                // 空のページは別カウント
                if (!page.content || page.content.trim().length === 0) {
                    console.log(`📄 Empty page: ${page.title}`);
                    emptyPages.push(page);
                    continue;
                }

                // pageId（page.id）で既存ドキュメントを検索
                const existing = existingMap.get(page.id);
                if (!existing) {
                    // 新規ページ
                    toProcess.push({ page, action: 'new' });
                } else if (page.lastModified && existing.lastModified) {
                    // 両方にlastModifiedがある場合のみ日時比較
                    const pageModified = new Date(page.lastModified).getTime();
                    const existingModified = new Date(existing.lastModified).getTime();
                    if (pageModified > existingModified) {
                        // Confluenceページが更新されている
                        toProcess.push({ page, action: 'update', existingDocId: existing.id });
                    } else {
                        // 未変更
                        skipped.push({ page, reason: 'unchanged' });
                    }
                } else {
                    // lastModifiedがない場合は既存として扱いスキップ
                    skipped.push({ page, reason: 'no_lastmodified' });
                }
            }

            const newCount = toProcess.filter(p => p.action === 'new').length;
            const updateCount = toProcess.filter(p => p.action === 'update').length;
            const skipCount = skipped.length;
            const emptyCount = emptyPages.length;

            console.log(`📊 分析結果: 新規=${newCount}, 更新=${updateCount}, 未変更=${skipCount}, 空=${emptyCount}`);

            // 分析結果を通知
            if (onProgress) onProgress({
                stage: 'analyzed',
                total: pages.length,
                newCount,
                updateCount,
                skipCount,
                emptyCount,
                message: `分析完了: ${pages.length}ページ`
            });

            // 処理するページがない場合
            if (toProcess.length === 0) {
                if (onProgress) onProgress({
                    stage: 'complete',
                    current: 0,
                    total: 0,
                    newCount: 0,
                    updateCount: 0,
                    skipCount,
                    emptyCount,
                    message: '更新が必要なページはありません'
                });

                return {
                    pageCount: 0,
                    chunkCount: 0,
                    newCount: 0,
                    updateCount: 0,
                    skipCount,
                    emptyCount,
                    failedPages: []
                };
            }

            // 新規/更新ページのみを処理
            let processedCount = 0;
            let successNewCount = 0;
            let successUpdateCount = 0;

            for (const { page, action, existingDocId } of toProcess) {
                const docId = this.#generateId();

                try {
                    // 更新の場合は既存ドキュメントを削除
                    if (action === 'update' && existingDocId) {
                        await VectorStore.getInstance.deleteDocument(existingDocId);
                        console.log(`🔄 Deleted old document for update: ${page.title}`);
                    }

                    // 進捗通知
                    if (onProgress) onProgress({
                        stage: 'embedding',
                        current: processedCount + 1,
                        total: toProcess.length,
                        pageTitle: page.title,
                        action,
                        newCount,
                        updateCount,
                        skipCount,
                        message: `${action === 'new' ? '新規' : '更新'}: ${page.title}`
                    });

                    // チャンキング
                    const chunks = DocumentChunker.getInstance.chunkText(page.content);

                    if (chunks.length === 0) {
                        console.log(`⏭️ Skipping page with no chunks: ${page.title}`);
                        processedCount++;
                        continue;
                    }

                    // メタデータ付きテキスト
                    const chunksWithMetadata = chunks.map(text =>
                        `[Confluence: ${page.title}]\n${text}`
                    );

                    // 埋め込み生成
                    const embeddings = await EmbeddingAPI.getInstance.getEmbeddings(chunksWithMetadata);

                    // 保存（スペース情報とpageIdを含める）
                    await VectorStore.getInstance.addDocument({
                        id: docId,
                        name: page.title,
                        type: 'confluence/page',
                        size: page.content.length,
                        chunkCount: chunks.length,
                        source: 'confluence',
                        sourceUrl: page.url,
                        lastModified: page.lastModified,
                        spaceKey: spaceKey,
                        spaceName: spaceName || spaceKey,
                        confluencePageId: page.id
                    });

                    const chunkRecords = chunksWithMetadata.map((text, index) => ({
                        id: `${docId}_${index}`,
                        docId: docId,
                        text: text,
                        embedding: embeddings[index],
                        position: index
                    }));

                    await VectorStore.getInstance.addChunks(chunkRecords);

                    totalChunks += chunks.length;
                    processedCount++;

                    if (action === 'new') {
                        successNewCount++;
                    } else {
                        successUpdateCount++;
                    }

                    console.log(`✅ Page ${action === 'new' ? 'added' : 'updated'}: ${page.title} (${chunks.length} chunks)`);

                } catch (pageError) {
                    console.error(`❌ Failed to process page: ${page.title}`, pageError);
                    failedPages.push({ title: page.title, error: pageError.message });
                    processedCount++;
                }
            }

            // 完了通知
            if (onProgress) onProgress({
                stage: 'complete',
                current: toProcess.length,
                total: toProcess.length,
                newCount: successNewCount,
                updateCount: successUpdateCount,
                skipCount,
                emptyCount,
                message: '完了'
            });

            // 結果ログ
            if (failedPages.length > 0) {
                console.warn(`⚠️ Confluenceスペース追加完了（一部失敗）: 新規=${successNewCount}, 更新=${successUpdateCount}, 未変更=${skipCount}, 空=${emptyCount}, 失敗=${failedPages.length}`);
            } else {
                console.log(`✅ Confluenceスペース追加完了: 新規=${successNewCount}, 更新=${successUpdateCount}, 未変更=${skipCount}, 空=${emptyCount}, ${totalChunks}チャンク`);
            }

            return {
                pageCount: successNewCount + successUpdateCount,
                chunkCount: totalChunks,
                newCount: successNewCount,
                updateCount: successUpdateCount,
                skipCount,
                emptyCount,
                failedPages
            };

        } catch (error) {
            console.error('❌ Confluence space processing error:', error);
            throw error;
        }
    }

    /**
     * 選択されたConfluenceページをインポート（差分更新対応）
     * @param {Array<{id: string, title: string, content: string, url: string, lastModified: string}>} pages - インポートするページ配列
     * @param {string} spaceKey - スペースキー
     * @param {string} [spaceName] - スペース名
     * @param {function} [onProgress] - 進捗コールバック
     * @returns {Promise<Object>} インポート結果
     */
    async addConfluencePages(pages, spaceKey, spaceName, onProgress) {
        await this.#ensureInitialized();

        if (!pages || pages.length === 0) {
            throw new Error('インポートするページがありません');
        }

        let totalChunks = 0;
        const failedPages = [];

        try {
            // 既存のConfluenceドキュメントを取得してマップを作成
            if (onProgress) onProgress({
                stage: 'analyzing',
                current: 0,
                total: pages.length,
                message: '既存ドキュメントを分析中...'
            });

            const existingDocs = await VectorStore.getInstance.getConfluenceDocuments();
            const existingMap = new Map();
            for (const doc of existingDocs) {
                const pageId = doc.confluencePageId || this.#extractPageIdFromUrl(doc.sourceUrl);
                if (pageId) {
                    existingMap.set(pageId, {
                        id: doc.id,
                        lastModified: doc.lastModified
                    });
                }
            }

            // 各ページを分類（新規 / 更新 / 未変更 / 空）
            const toProcess = [];
            const skipped = [];
            const emptyPages = [];

            for (const page of pages) {
                // 空のページは別カウント
                if (!page.content || page.content.trim().length === 0) {
                    console.log(`📄 Empty page: ${page.title}`);
                    emptyPages.push(page);
                    continue;
                }

                const existing = existingMap.get(page.id);
                if (!existing) {
                    toProcess.push({ page, action: 'new' });
                } else if (page.lastModified && existing.lastModified) {
                    const pageModified = new Date(page.lastModified).getTime();
                    const existingModified = new Date(existing.lastModified).getTime();
                    if (pageModified > existingModified) {
                        toProcess.push({ page, action: 'update', existingDocId: existing.id });
                    } else {
                        skipped.push({ page, reason: 'unchanged' });
                    }
                } else {
                    skipped.push({ page, reason: 'no_lastmodified' });
                }
            }

            const newCount = toProcess.filter(p => p.action === 'new').length;
            const updateCount = toProcess.filter(p => p.action === 'update').length;
            const skipCount = skipped.length;
            const emptyCount = emptyPages.length;

            console.log(`📊 分析結果: 新規=${newCount}, 更新=${updateCount}, 未変更=${skipCount}, 空=${emptyCount}`);

            // 分析結果を通知
            if (onProgress) onProgress({
                stage: 'analyzed',
                total: pages.length,
                newCount,
                updateCount,
                skipCount,
                emptyCount,
                message: `分析完了: ${pages.length}ページ`
            });

            // 処理するページがない場合
            if (toProcess.length === 0) {
                if (onProgress) onProgress({
                    stage: 'complete',
                    current: 0,
                    total: 0,
                    newCount: 0,
                    updateCount: 0,
                    skipCount,
                    emptyCount,
                    message: '更新が必要なページはありません'
                });

                return {
                    pageCount: 0,
                    chunkCount: 0,
                    newCount: 0,
                    updateCount: 0,
                    skipCount,
                    emptyCount,
                    failedPages: []
                };
            }

            // 新規/更新ページのみを処理
            let processedCount = 0;
            let successNewCount = 0;
            let successUpdateCount = 0;

            for (const { page, action, existingDocId } of toProcess) {
                const docId = this.#generateId();

                try {
                    // 更新の場合は既存ドキュメントを削除
                    if (action === 'update' && existingDocId) {
                        await VectorStore.getInstance.deleteDocument(existingDocId);
                        console.log(`🔄 Deleted old document for update: ${page.title}`);
                    }

                    // 進捗通知
                    if (onProgress) onProgress({
                        stage: 'embedding',
                        current: processedCount + 1,
                        total: toProcess.length,
                        pageTitle: page.title,
                        action,
                        newCount,
                        updateCount,
                        skipCount,
                        emptyCount,
                        message: `${action === 'new' ? '新規' : '更新'}: ${page.title}`
                    });

                    // チャンキング
                    const chunks = DocumentChunker.getInstance.chunkText(page.content);

                    if (chunks.length === 0) {
                        console.log(`⏭️ Skipping page with no chunks: ${page.title}`);
                        processedCount++;
                        continue;
                    }

                    // メタデータ付きテキスト
                    const chunksWithMetadata = chunks.map(text =>
                        `[Confluence: ${page.title}]\n${text}`
                    );

                    // 埋め込み生成
                    const embeddings = await EmbeddingAPI.getInstance.getEmbeddings(chunksWithMetadata);

                    // 保存（スペース情報とpageIdを含める）
                    await VectorStore.getInstance.addDocument({
                        id: docId,
                        name: page.title,
                        type: 'confluence/page',
                        size: page.content.length,
                        chunkCount: chunks.length,
                        source: 'confluence',
                        sourceUrl: page.url,
                        lastModified: page.lastModified,
                        spaceKey: spaceKey,
                        spaceName: spaceName || spaceKey,
                        confluencePageId: page.id
                    });

                    const chunkRecords = chunksWithMetadata.map((text, index) => ({
                        id: `${docId}_${index}`,
                        docId: docId,
                        text: text,
                        embedding: embeddings[index],
                        position: index
                    }));

                    await VectorStore.getInstance.addChunks(chunkRecords);

                    totalChunks += chunks.length;
                    processedCount++;

                    if (action === 'new') {
                        successNewCount++;
                    } else {
                        successUpdateCount++;
                    }

                    console.log(`✅ Page ${action === 'new' ? 'added' : 'updated'}: ${page.title} (${chunks.length} chunks)`);

                } catch (pageError) {
                    console.error(`❌ Failed to process page: ${page.title}`, pageError);
                    failedPages.push({ title: page.title, error: pageError.message });
                    processedCount++;
                }
            }

            // 完了通知
            if (onProgress) onProgress({
                stage: 'complete',
                current: toProcess.length,
                total: toProcess.length,
                newCount: successNewCount,
                updateCount: successUpdateCount,
                skipCount,
                emptyCount,
                message: '完了'
            });

            console.log(`✅ Confluenceページ追加完了: 新規=${successNewCount}, 更新=${successUpdateCount}, 未変更=${skipCount}, 空=${emptyCount}, ${totalChunks}チャンク`);

            return {
                pageCount: successNewCount + successUpdateCount,
                chunkCount: totalChunks,
                newCount: successNewCount,
                updateCount: successUpdateCount,
                skipCount,
                emptyCount,
                failedPages
            };

        } catch (error) {
            console.error('❌ Confluence pages processing error:', error);
            throw error;
        }
    }

    /**
     * クエリに関連するコンテキストを検索
     * @param {string} query - 検索クエリ
     * @returns {Promise<string>} 関連コンテキスト
     */
    async search(query) {
        await this.#ensureInitialized();

        if (!query || query.trim().length === 0) {
            return '';
        }

        try {
            // クエリの埋め込みを取得
            const queryEmbedding = await EmbeddingAPI.getInstance.getEmbedding(query);

            // 類似チャンクを検索
            let results = await SimilaritySearch.getInstance.findSimilar(queryEmbedding);

            // 重複を除去
            results = SimilaritySearch.getInstance.deduplicateResults(results);

            // コンテキスト文字列を生成
            const context = SimilaritySearch.getInstance.formatResultsAsContext(results);

            const stats = SimilaritySearch.getInstance.getSearchStats(results);
            console.log(`🔍 RAG search: found ${stats.count} relevant chunks (avg similarity: ${(stats.avgSimilarity * 100).toFixed(1)}%)`);

            return context;
        } catch (error) {
            console.error('❌ RAG search error:', error);
            return '';
        }
    }

    /**
     * クエリに関連するコンテキストと参照資料情報を検索
     * @param {string} query - 検索クエリ
     * @returns {Promise<{context: string, sources: Array<{docName: string, similarity: number}>}>}
     */
    async searchWithDetails(query) {
        await this.#ensureInitialized();

        if (!query || query.trim().length === 0) {
            return { context: '', sources: [] };
        }

        try {
            // クエリの埋め込みを取得
            const queryEmbedding = await EmbeddingAPI.getInstance.getEmbedding(query);

            // 類似チャンクを検索
            let results = await SimilaritySearch.getInstance.findSimilar(queryEmbedding);

            // 重複を除去
            results = SimilaritySearch.getInstance.deduplicateResults(results);

            // コンテキスト文字列を生成
            const context = SimilaritySearch.getInstance.formatResultsAsContext(results);

            // 参照資料情報を抽出（重複するドキュメント名はまとめる）
            const sourceMap = new Map();
            for (const result of results) {
                const docName = this.#extractDocName(result.chunk.text);
                const similarity = Math.round(result.similarity * 100);

                // 同じドキュメントがある場合は最高の類似度を保持
                if (!sourceMap.has(docName) || sourceMap.get(docName) < similarity) {
                    sourceMap.set(docName, similarity);
                }
            }

            const sources = Array.from(sourceMap.entries()).map(([docName, similarity]) => ({
                docName,
                similarity
            })).sort((a, b) => b.similarity - a.similarity);

            const stats = SimilaritySearch.getInstance.getSearchStats(results);
            console.log(`🔍 RAG search with details: found ${stats.count} relevant chunks from ${sources.length} documents`);

            return { context, sources };
        } catch (error) {
            console.error('❌ RAG search error:', error);
            return { context: '', sources: [] };
        }
    }

    /**
     * チャンクテキストからドキュメント名を抽出
     * @param {string} chunkText - チャンクテキスト
     * @returns {string} ドキュメント名
     */
    #extractDocName(chunkText) {
        if (!chunkText) return '不明なドキュメント';

        // [ドキュメント: filename.pdf] の形式から抽出
        const fileMatch = chunkText.match(/^\[ドキュメント:\s*(.+?)\]/);
        if (fileMatch && fileMatch[1]) {
            return fileMatch[1].trim();
        }

        // [Confluence: page title] の形式から抽出
        const confluenceMatch = chunkText.match(/^\[Confluence:\s*(.+?)\]/);
        if (confluenceMatch && confluenceMatch[1]) {
            return `📄 ${confluenceMatch[1].trim()}`;
        }

        return '不明なドキュメント';
    }

    /**
     * メッセージ配列にRAGコンテキストを拡張
     * @param {Array<{role: string, content: string}>} messages - メッセージ配列
     * @param {string} [userQuery] - ユーザークエリ（指定しない場合は最後のユーザーメッセージを使用）
     * @param {Object} [options] - オプション
     * @param {boolean} [options.returnSources=false] - 参照資料情報も返すかどうか
     * @returns {Promise<Array<{role: string, content: string}>|{messages: Array, sources: Array}>}
     */
    async augmentPrompt(messages, userQuery, options = {}) {
        const { returnSources = false } = options;

        // 先に初期化を確認（#enabledの値がストレージから復元される）
        await this.#ensureInitialized();

        console.log('📚 RAG augmentPrompt called, enabled:', this.#enabled);

        const emptyResult = returnSources ? { messages, sources: [] } : messages;

        if (!this.#enabled) {
            console.log('📚 RAG is disabled, skipping augmentation');
            return emptyResult;
        }

        // ナレッジベースが空の場合はそのまま返す
        const docCount = await VectorStore.getInstance.getDocumentCount();
        console.log('📚 RAG document count:', docCount);
        if (docCount === 0) {
            return emptyResult;
        }

        // クエリを決定
        let query = userQuery;
        if (!query) {
            // 最後のユーザーメッセージを使用
            const userMessages = messages.filter(m => m.role === 'user');
            if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1];
                query = typeof lastUserMessage.content === 'string'
                    ? lastUserMessage.content
                    : JSON.stringify(lastUserMessage.content);
            }
        }

        if (!query) {
            return emptyResult;
        }

        // 関連コンテキストを検索（returnSourcesの場合は詳細情報付き）
        console.log('📚 RAG searching for query:', query.substring(0, 50) + '...');

        let context, sources = [];
        if (returnSources) {
            const result = await this.searchWithDetails(query);
            context = result.context;
            sources = result.sources;
        } else {
            context = await this.search(query);
        }

        if (!context) {
            console.log('📚 RAG no context found for query');
            return emptyResult;
        }
        console.log('📚 RAG context found, length:', context.length);

        // メッセージを拡張
        const config = window.CONFIG.RAG.AUGMENTATION;
        const augmentedMessages = [...messages];

        // システムメッセージを探す or 新規作成
        const systemIndex = augmentedMessages.findIndex(m => m.role === 'system');

        if (systemIndex >= 0) {
            // 既存のシステムメッセージにコンテキストを追加
            augmentedMessages[systemIndex] = {
                ...augmentedMessages[systemIndex],
                content: augmentedMessages[systemIndex].content +
                         config.CONTEXT_PREFIX +
                         context +
                         config.CONTEXT_SUFFIX
            };
        } else {
            // 新しいシステムメッセージを先頭に追加
            augmentedMessages.unshift({
                role: 'system',
                content: config.CONTEXT_PREFIX + context + config.CONTEXT_SUFFIX
            });
        }

        console.log('📚 Prompt augmented with RAG context');

        if (returnSources) {
            return { messages: augmentedMessages, sources };
        }
        return augmentedMessages;
    }

    /**
     * 全ドキュメントを取得
     * @returns {Promise<Array<Object>>}
     */
    async getDocuments() {
        await this.#ensureInitialized();
        return VectorStore.getInstance.getAllDocuments();
    }

    /**
     * ナレッジベースの統計情報を取得
     * @returns {Promise<Object>}
     */
    async getStats() {
        await this.#ensureInitialized();

        const docCount = await VectorStore.getInstance.getDocumentCount();
        const chunkCount = await VectorStore.getInstance.getChunkCount();
        const documents = await VectorStore.getInstance.getAllDocuments();

        const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);

        return {
            documentCount: docCount,
            chunkCount: chunkCount,
            totalSize: totalSize,
            embeddingModel: EmbeddingAPI.getInstance.getCurrentModelName()
        };
    }

    /**
     * ナレッジベースをクリア
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.#ensureInitialized();
        await VectorStore.getInstance.clearAll();
        console.log('🧹 Knowledge base cleared');
    }

    /**
     * 埋め込みAPIが利用可能かチェック
     * @returns {Promise<boolean>}
     */
    async isEmbeddingAvailable() {
        return EmbeddingAPI.getInstance.isAvailable();
    }

    /**
     * 初期化を確認
     * @returns {Promise<void>}
     */
    async #ensureInitialized() {
        if (!this.#initialized) {
            await this.initialize();
        }
    }

    /**
     * 一意のIDを生成
     * @returns {string}
     */
    #generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * sourceUrlからConfluence pageIdを抽出
     * @param {string} sourceUrl - ConfluenceページURL
     * @returns {string|null} pageId、抽出できない場合はnull
     */
    #extractPageIdFromUrl(sourceUrl) {
        if (!sourceUrl) return null;
        const match = sourceUrl.match(/pageId=(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * ファイルサイズを人間が読める形式に変換
     * @param {number} bytes
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// グローバルに公開
window.RAGManager = RAGManager;
