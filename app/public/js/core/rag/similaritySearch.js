/**
 * similaritySearch.js
 * ベクトル類似度検索を行うクラス
 * コサイン類似度を使用してクエリに類似したチャンクを検索
 */

class SimilaritySearch {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得
     * @returns {SimilaritySearch}
     */
    static get getInstance() {
        if (!SimilaritySearch.#instance) {
            SimilaritySearch.#instance = new SimilaritySearch();
        }
        return SimilaritySearch.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (SimilaritySearch.#instance) {
            throw new Error('SimilaritySearch is a singleton. Use SimilaritySearch.getInstance instead.');
        }
    }

    /**
     * クエリベクトルに類似したチャンクを検索
     * @param {number[]} queryEmbedding - クエリの埋め込みベクトル
     * @param {number} [topK] - 返却する上位チャンク数
     * @param {number} [threshold] - 類似度閾値
     * @returns {Promise<Array<{chunk: Object, similarity: number}>>}
     */
    async findSimilar(queryEmbedding, topK, threshold) {
        const config = window.CONFIG.RAG.EMBEDDING;
        const k = topK || config.TOP_K;
        const similarityThreshold = threshold || config.SIMILARITY_THRESHOLD;

        // 全チャンクを取得
        const allChunks = await VectorStore.getInstance.getAllChunks();

        console.log('🔍 SimilaritySearch: allChunks count:', allChunks?.length || 0);

        if (!allChunks || allChunks.length === 0) {
            console.log('🔍 SimilaritySearch: no chunks found');
            return [];
        }

        // チャンクの埋め込み状態を確認
        const firstChunk = allChunks[0];
        console.log('🔍 SimilaritySearch: first chunk has embedding:', !!firstChunk.embedding,
                    'embedding length:', firstChunk.embedding?.length || 0);
        console.log('🔍 SimilaritySearch: query embedding length:', queryEmbedding?.length || 0);

        // 各チャンクとの類似度を計算
        const similarities = allChunks.map(chunk => ({
            chunk,
            similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // 類似度でソート（降順）
        similarities.sort((a, b) => b.similarity - a.similarity);

        // デバッグ: 最高類似度を表示
        if (similarities.length > 0) {
            console.log('🔍 SimilaritySearch: top similarity:', (similarities[0].similarity * 100).toFixed(2) + '%');
            console.log('🔍 SimilaritySearch: threshold:', (similarityThreshold * 100).toFixed(2) + '%');
        }

        // 閾値以上のもののみフィルタリング
        const filtered = similarities.filter(item => item.similarity >= similarityThreshold);

        console.log('🔍 SimilaritySearch: filtered count:', filtered.length);

        // 上位K件を返却
        return filtered.slice(0, k);
    }

    /**
     * コサイン類似度を計算
     * @param {number[]} vecA - ベクトルA
     * @param {number[]} vecB - ベクトルB
     * @returns {number} 類似度（-1〜1、1に近いほど類似）
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            console.warn('⚠️ ベクトルの次元が一致しません');
            return 0;
        }

        const dotProduct = this.#dotProduct(vecA, vecB);
        const magnitudeA = this.#magnitude(vecA);
        const magnitudeB = this.#magnitude(vecB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * ベクトルの内積を計算
     * @param {number[]} vecA
     * @param {number[]} vecB
     * @returns {number}
     */
    #dotProduct(vecA, vecB) {
        let sum = 0;
        for (let i = 0; i < vecA.length; i++) {
            sum += vecA[i] * vecB[i];
        }
        return sum;
    }

    /**
     * ベクトルの大きさ（ノルム）を計算
     * @param {number[]} vec
     * @returns {number}
     */
    #magnitude(vec) {
        let sum = 0;
        for (let i = 0; i < vec.length; i++) {
            sum += vec[i] * vec[i];
        }
        return Math.sqrt(sum);
    }

    /**
     * ユークリッド距離を計算（参考用）
     * @param {number[]} vecA
     * @param {number[]} vecB
     * @returns {number}
     */
    euclideanDistance(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return Infinity;
        }

        let sum = 0;
        for (let i = 0; i < vecA.length; i++) {
            const diff = vecA[i] - vecB[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    /**
     * 検索結果を整形してコンテキスト文字列を生成
     * @param {Array<{chunk: Object, similarity: number}>} results - 検索結果
     * @param {number} [maxLength] - 最大文字数
     * @returns {string}
     */
    formatResultsAsContext(results, maxLength) {
        const config = window.CONFIG.RAG.AUGMENTATION;
        const limit = maxLength || config.MAX_CONTEXT_LENGTH;

        if (!results || results.length === 0) {
            return '';
        }

        let context = '';
        let currentLength = 0;

        for (const result of results) {
            const chunkText = result.chunk.text;
            const similarity = (result.similarity * 100).toFixed(1);

            // チャンクテキストを追加
            const entry = `[関連度: ${similarity}%]\n${chunkText}\n\n`;

            if (currentLength + entry.length > limit) {
                // 残りの文字数分だけ追加
                const remaining = limit - currentLength;
                if (remaining > 50) {
                    context += entry.substring(0, remaining - 3) + '...';
                }
                break;
            }

            context += entry;
            currentLength += entry.length;
        }

        return context.trim();
    }

    /**
     * 検索結果の統計情報を取得
     * @param {Array<{chunk: Object, similarity: number}>} results
     * @returns {Object}
     */
    getSearchStats(results) {
        if (!results || results.length === 0) {
            return {
                count: 0,
                avgSimilarity: 0,
                maxSimilarity: 0,
                minSimilarity: 0
            };
        }

        const similarities = results.map(r => r.similarity);

        return {
            count: results.length,
            avgSimilarity: similarities.reduce((a, b) => a + b, 0) / similarities.length,
            maxSimilarity: Math.max(...similarities),
            minSimilarity: Math.min(...similarities)
        };
    }

    /**
     * 重複を除去した検索結果を取得
     * @param {Array<{chunk: Object, similarity: number}>} results
     * @param {number} [similarityThreshold=0.95] - この値以上の類似度のチャンクを重複とみなす
     * @returns {Array<{chunk: Object, similarity: number}>}
     */
    deduplicateResults(results, similarityThreshold = 0.95) {
        if (!results || results.length <= 1) {
            return results;
        }

        const deduplicated = [results[0]];

        for (let i = 1; i < results.length; i++) {
            const current = results[i];
            let isDuplicate = false;

            for (const existing of deduplicated) {
                // テキストの類似度をチェック
                const textSimilarity = this.#textSimilarity(
                    current.chunk.text,
                    existing.chunk.text
                );

                if (textSimilarity >= similarityThreshold) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                deduplicated.push(current);
            }
        }

        return deduplicated;
    }

    /**
     * テキストの類似度を計算（簡易版）
     * @param {string} textA
     * @param {string} textB
     * @returns {number}
     */
    #textSimilarity(textA, textB) {
        if (textA === textB) return 1;
        if (!textA || !textB) return 0;

        // 短い方を基準に
        const shorter = textA.length < textB.length ? textA : textB;
        const longer = textA.length < textB.length ? textB : textA;

        // 短いテキストが長いテキストに含まれているか
        if (longer.includes(shorter)) {
            return shorter.length / longer.length;
        }

        // 先頭と末尾の一致をチェック
        const checkLength = Math.min(100, shorter.length);
        const startMatch = shorter.substring(0, checkLength) === longer.substring(0, checkLength);
        const endMatch = shorter.substring(shorter.length - checkLength) ===
                        longer.substring(longer.length - checkLength);

        if (startMatch && endMatch) {
            return 0.9;
        } else if (startMatch || endMatch) {
            return 0.7;
        }

        return 0;
    }
}

// グローバルに公開
window.SimilaritySearch = SimilaritySearch;
