/**
 * documentChunker.js
 * ドキュメントをチャンク（断片）に分割するクラス
 * テキスト抽出には既存のFileConverterを使用
 */

class DocumentChunker {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得
     * @returns {DocumentChunker}
     */
    static get getInstance() {
        if (!DocumentChunker.#instance) {
            DocumentChunker.#instance = new DocumentChunker();
        }
        return DocumentChunker.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (DocumentChunker.#instance) {
            throw new Error('DocumentChunker is a singleton. Use DocumentChunker.getInstance instead.');
        }
    }

    /**
     * ファイルからテキストを抽出してチャンクに分割
     * @param {File} file - 処理するファイル
     * @returns {Promise<{text: string, chunks: string[]}>}
     */
    async chunkDocument(file) {
        // FileConverterでテキストを抽出
        const attachments = await FileConverter.getInstance.convertFilesToAttachments([file]);

        if (!attachments || attachments.length === 0) {
            throw new Error('ファイルからテキストを抽出できませんでした');
        }

        const attachment = attachments[0];

        if (attachment.type === 'error') {
            throw new Error(attachment.error || 'ファイル変換エラー');
        }

        // テキストコンテンツを取得
        let text = '';

        if (attachment.content) {
            text = attachment.content;
        } else if (attachment.type === 'image') {
            // 画像の場合はファイル名のみ（テキスト抽出不可）
            throw new Error('画像ファイルはRAGナレッジベースに追加できません。テキストベースのファイルを使用してください。');
        }

        // ヘッダー部分を除去（「=== ファイル名 ===」などの形式）
        text = this.#removeHeaders(text);

        // テキストをチャンクに分割
        const chunks = this.chunkText(text);

        return { text, chunks };
    }

    /**
     * テキストをチャンクに分割
     * @param {string} text - 分割するテキスト
     * @param {number} [chunkSize] - チャンクサイズ（文字数）
     * @param {number} [overlap] - オーバーラップ（文字数）
     * @returns {string[]} チャンク配列
     */
    chunkText(text, chunkSize, overlap) {
        const config = window.CONFIG.RAG.EMBEDDING;
        const size = chunkSize || config.CHUNK_SIZE;
        const overlapSize = overlap || config.CHUNK_OVERLAP;

        if (!text || text.trim().length === 0) {
            return [];
        }

        // テキストを正規化
        const normalizedText = this.#normalizeText(text);

        // 段落で分割を試みる
        const paragraphs = this.#splitByParagraphs(normalizedText);

        // チャンクを生成
        const chunks = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            // 段落が大きすぎる場合は文で分割
            if (paragraph.length > size) {
                // 現在のチャンクがあれば先に追加
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }

                // 大きな段落を文で分割
                const sentenceChunks = this.#splitBySentences(paragraph, size, overlapSize);
                chunks.push(...sentenceChunks);
            } else if (currentChunk.length + paragraph.length + 1 > size) {
                // 現在のチャンクに追加すると超過する場合
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                // オーバーラップ部分を保持
                currentChunk = this.#getOverlapText(currentChunk, overlapSize) + paragraph;
            } else {
                // 現在のチャンクに追加
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        // 残りのチャンクを追加
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        // 空のチャンクを除去し、最小長を確保
        return chunks.filter(chunk => chunk.length >= 20);
    }

    /**
     * テキストを正規化
     * @param {string} text
     * @returns {string}
     */
    #normalizeText(text) {
        return text
            // 連続する空白行を2つの改行に
            .replace(/\n{3,}/g, '\n\n')
            // タブをスペースに
            .replace(/\t/g, '    ')
            // 行末の空白を削除
            .replace(/[ \t]+$/gm, '')
            .trim();
    }

    /**
     * ヘッダー部分を除去
     * @param {string} text
     * @returns {string}
     */
    #removeHeaders(text) {
        // 「=== ファイル名 ===」形式のヘッダーを除去
        return text
            .replace(/^===.*===\s*\n+/gm, '')
            .replace(/^--- ページ \d+ ---\s*\n+/gm, '')
            .trim();
    }

    /**
     * 段落で分割
     * @param {string} text
     * @returns {string[]}
     */
    #splitByParagraphs(text) {
        // 空行で段落を分割
        return text
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
    }

    /**
     * 文で分割してチャンクを生成
     * @param {string} text
     * @param {number} maxSize
     * @param {number} overlap
     * @returns {string[]}
     */
    #splitBySentences(text, maxSize, overlap) {
        // 日本語と英語の文末を考慮
        const sentenceEndings = /([。．！？.!?]+[\s]*)/g;
        const sentences = text.split(sentenceEndings).filter(s => s.trim());

        // 文末記号と本文を結合
        const completeSentences = [];
        for (let i = 0; i < sentences.length; i++) {
            if (sentences[i].match(sentenceEndings)) {
                // 前の要素に文末記号を追加
                if (completeSentences.length > 0) {
                    completeSentences[completeSentences.length - 1] += sentences[i];
                }
            } else {
                completeSentences.push(sentences[i]);
            }
        }

        const chunks = [];
        let currentChunk = '';

        for (const sentence of completeSentences) {
            if (currentChunk.length + sentence.length > maxSize) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                // オーバーラップを適用
                currentChunk = this.#getOverlapText(currentChunk, overlap) + sentence;
            } else {
                currentChunk += sentence;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        // チャンクがまだ大きすぎる場合は強制分割
        return chunks.flatMap(chunk => {
            if (chunk.length > maxSize * 1.5) {
                return this.#forceSplit(chunk, maxSize, overlap);
            }
            return [chunk];
        });
    }

    /**
     * 強制的に分割（最終手段）
     * @param {string} text
     * @param {number} maxSize
     * @param {number} overlap
     * @returns {string[]}
     */
    #forceSplit(text, maxSize, overlap) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = start + maxSize;

            // 単語の途中で切らないよう調整
            if (end < text.length) {
                // 空白または句読点を探す
                const breakPoint = text.substring(start, end).lastIndexOf(' ');
                const jpBreakPoint = text.substring(start, end).search(/[、。，．]/);

                if (breakPoint > maxSize * 0.7) {
                    end = start + breakPoint;
                } else if (jpBreakPoint > maxSize * 0.7) {
                    end = start + jpBreakPoint + 1;
                }
            }

            chunks.push(text.substring(start, end).trim());
            start = end - overlap;
        }

        return chunks;
    }

    /**
     * オーバーラップテキストを取得
     * @param {string} text
     * @param {number} overlapSize
     * @returns {string}
     */
    #getOverlapText(text, overlapSize) {
        if (!text || text.length <= overlapSize) {
            return '';
        }

        // 末尾からoverlapSize分を取得
        const overlap = text.substring(text.length - overlapSize);

        // 文の途中からの場合は最初の区切りまでスキップ
        const firstBreak = overlap.search(/[。．.!?！？\s]/);
        if (firstBreak > 0 && firstBreak < overlapSize * 0.5) {
            return overlap.substring(firstBreak + 1).trim() + ' ';
        }

        return overlap.trim() + ' ';
    }

    /**
     * チャンク情報の統計を取得
     * @param {string[]} chunks
     * @returns {Object}
     */
    getChunkStats(chunks) {
        if (!chunks || chunks.length === 0) {
            return {
                count: 0,
                totalLength: 0,
                avgLength: 0,
                minLength: 0,
                maxLength: 0
            };
        }

        const lengths = chunks.map(c => c.length);
        const totalLength = lengths.reduce((a, b) => a + b, 0);

        return {
            count: chunks.length,
            totalLength,
            avgLength: Math.round(totalLength / chunks.length),
            minLength: Math.min(...lengths),
            maxLength: Math.max(...lengths)
        };
    }
}

// グローバルに公開
window.DocumentChunker = DocumentChunker;
