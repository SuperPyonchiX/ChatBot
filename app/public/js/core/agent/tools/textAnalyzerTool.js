/**
 * textAnalyzerTool.js
 * テキスト分析ツール
 * 文字数カウント、要約、キーワード抽出、感情分析などをサポート
 */

/**
 * @typedef {Object} TextAnalysisResult
 * @property {boolean} success - 成功したかどうか
 * @property {string} operation - 実行した操作
 * @property {Object} result - 分析結果
 * @property {string} [error] - エラーメッセージ
 */

class TextAnalyzerTool {
    static #instance = null;

    /** @type {string} */
    name = 'text_analyzer';

    /** @type {string} */
    description = 'テキストを分析します。文字数カウント、単語頻度、キーワード抽出、統計情報などを取得できます。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: '分析するテキスト'
            },
            operation: {
                type: 'string',
                enum: ['stats', 'keywords', 'frequency', 'summary', 'all'],
                description: '実行する分析操作（stats: 統計, keywords: キーワード抽出, frequency: 単語頻度, summary: 要約, all: すべて）'
            },
            options: {
                type: 'object',
                description: 'オプション設定',
                properties: {
                    topN: {
                        type: 'number',
                        description: '上位N件を返す（デフォルト: 10）'
                    },
                    minWordLength: {
                        type: 'number',
                        description: '最小単語長（デフォルト: 2）'
                    }
                }
            }
        },
        required: ['text']
    };

    /** @type {string[]} */
    keywords = ['分析', '解析', 'テキスト', '文字数', 'カウント', '要約', 'キーワード', '頻度', 'analyze', 'text', 'count'];

    /** @type {Set<string>} */
    #stopWordsJa = new Set([
        'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
        'ある', 'いる', 'も', 'な', 'する', 'から', 'だ', 'こと', 'として', 'い',
        'や', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう', 'また',
        'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だっ', 'それ',
        'によって', 'により', 'おり', 'より', 'による', 'ず', 'なり', 'られる', 'において',
        'ば', 'なかっ', 'なく', 'しかし', 'について', 'せ', 'だけ', 'でも', 'ん', 'できる'
    ]);

    /** @type {Set<string>} */
    #stopWordsEn = new Set([
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
        'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
        'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
        'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did'
    ]);

    /**
     * @constructor
     */
    constructor() {
        if (TextAnalyzerTool.#instance) {
            return TextAnalyzerTool.#instance;
        }
        TextAnalyzerTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {TextAnalyzerTool}
     */
    static get getInstance() {
        if (!TextAnalyzerTool.#instance) {
            TextAnalyzerTool.#instance = new TextAnalyzerTool();
        }
        return TextAnalyzerTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.text - 分析するテキスト
     * @param {string} [params.operation='all'] - 操作タイプ
     * @param {Object} [params.options] - オプション
     * @returns {Promise<TextAnalysisResult>}
     */
    async execute(params) {
        const { text, operation = 'all', options = {} } = params;

        if (!text || typeof text !== 'string') {
            return {
                success: false,
                operation: operation,
                error: 'テキストが指定されていません'
            };
        }

        try {
            let result = {};

            switch (operation) {
                case 'stats':
                    result = this.#analyzeStats(text);
                    break;
                case 'keywords':
                    result = this.#extractKeywords(text, options);
                    break;
                case 'frequency':
                    result = this.#analyzeFrequency(text, options);
                    break;
                case 'summary':
                    result = this.#generateSummary(text, options);
                    break;
                case 'all':
                default:
                    result = {
                        stats: this.#analyzeStats(text),
                        keywords: this.#extractKeywords(text, options),
                        frequency: this.#analyzeFrequency(text, options),
                        summary: this.#generateSummary(text, options)
                    };
                    break;
            }

            return {
                success: true,
                operation: operation,
                result: result
            };
        } catch (error) {
            console.error('[TextAnalyzerTool] 分析エラー:', error);
            return {
                success: false,
                operation: operation,
                error: `分析エラー: ${error.message}`
            };
        }
    }

    /**
     * テキスト統計を分析
     * @param {string} text
     * @returns {Object}
     */
    #analyzeStats(text) {
        const charCount = text.length;
        const charCountNoSpace = text.replace(/\s/g, '').length;

        // 単語分割（日本語と英語に対応）
        const words = this.#tokenize(text);
        const wordCount = words.length;

        // 文分割
        const sentences = text.split(/[。.!?！？]+/).filter(s => s.trim().length > 0);
        const sentenceCount = sentences.length;

        // 段落分割
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const paragraphCount = paragraphs.length;

        // 行数
        const lines = text.split(/\n/).filter(l => l.trim().length > 0);
        const lineCount = lines.length;

        // 平均
        const avgWordLength = wordCount > 0
            ? (words.reduce((sum, w) => sum + w.length, 0) / wordCount).toFixed(2)
            : 0;
        const avgSentenceLength = sentenceCount > 0
            ? (wordCount / sentenceCount).toFixed(2)
            : 0;

        // 読了時間（日本語: 400字/分、英語: 200語/分）
        const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
        const readingTimeMinutes = isJapanese
            ? (charCountNoSpace / 400).toFixed(1)
            : (wordCount / 200).toFixed(1);

        return {
            characters: charCount,
            charactersNoSpaces: charCountNoSpace,
            words: wordCount,
            sentences: sentenceCount,
            paragraphs: paragraphCount,
            lines: lineCount,
            averageWordLength: parseFloat(avgWordLength),
            averageSentenceLength: parseFloat(avgSentenceLength),
            estimatedReadingTime: `${readingTimeMinutes}分`,
            language: isJapanese ? 'Japanese' : 'English/Other'
        };
    }

    /**
     * キーワードを抽出
     * @param {string} text
     * @param {Object} options
     * @returns {Object}
     */
    #extractKeywords(text, options) {
        const { topN = 10, minWordLength = 2 } = options;

        const words = this.#tokenize(text);
        const frequency = {};

        // 頻度カウント（ストップワード除外）
        for (const word of words) {
            if (word.length < minWordLength) continue;
            if (this.#isStopWord(word)) continue;

            const lower = word.toLowerCase();
            frequency[lower] = (frequency[lower] || 0) + 1;
        }

        // TF-IDF風のスコアリング（単純化版）
        const totalWords = words.length;
        const scored = Object.entries(frequency).map(([word, count]) => ({
            word,
            count,
            score: (count / totalWords) * Math.log(totalWords / count + 1)
        }));

        // スコアでソート
        scored.sort((a, b) => b.score - a.score);

        return {
            keywords: scored.slice(0, topN).map(item => ({
                word: item.word,
                count: item.count,
                relevance: (item.score * 100).toFixed(2) + '%'
            })),
            totalUniqueWords: Object.keys(frequency).length
        };
    }

    /**
     * 単語頻度を分析
     * @param {string} text
     * @param {Object} options
     * @returns {Object}
     */
    #analyzeFrequency(text, options) {
        const { topN = 20, minWordLength = 1 } = options;

        const words = this.#tokenize(text);
        const frequency = {};

        for (const word of words) {
            if (word.length < minWordLength) continue;
            const lower = word.toLowerCase();
            frequency[lower] = (frequency[lower] || 0) + 1;
        }

        // 頻度でソート
        const sorted = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN);

        // 文字タイプ別統計
        const charTypes = {
            hiragana: (text.match(/[\u3040-\u309F]/g) || []).length,
            katakana: (text.match(/[\u30A0-\u30FF]/g) || []).length,
            kanji: (text.match(/[\u4E00-\u9FFF]/g) || []).length,
            alphabetic: (text.match(/[a-zA-Z]/g) || []).length,
            numeric: (text.match(/[0-9０-９]/g) || []).length,
            punctuation: (text.match(/[.,!?;:、。！？；：]/g) || []).length
        };

        return {
            topWords: sorted.map(([word, count]) => ({ word, count })),
            uniqueWords: Object.keys(frequency).length,
            totalWords: words.length,
            characterTypes: charTypes
        };
    }

    /**
     * 要約を生成（抽出型）
     * @param {string} text
     * @param {Object} options
     * @returns {Object}
     */
    #generateSummary(text, options) {
        const { sentenceCount = 3 } = options;

        // 文分割
        const sentences = text
            .split(/[。.!?！？]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10);

        if (sentences.length === 0) {
            return {
                summary: text.substring(0, 200),
                method: 'truncation',
                originalSentences: 0
            };
        }

        // キーワードを取得
        const keywordsResult = this.#extractKeywords(text, { topN: 20 });
        const keywordSet = new Set(keywordsResult.keywords.map(k => k.word));

        // 各文のスコアを計算
        const scoredSentences = sentences.map((sentence, index) => {
            const words = this.#tokenize(sentence);
            let score = 0;

            // キーワード含有率
            for (const word of words) {
                if (keywordSet.has(word.toLowerCase())) {
                    score += 1;
                }
            }

            // 位置ボーナス（最初と最後の文を重視）
            if (index === 0) score += 2;
            if (index === sentences.length - 1) score += 1;

            // 文の長さペナルティ（極端に短い/長いものは減点）
            if (sentence.length < 20) score -= 1;
            if (sentence.length > 200) score -= 0.5;

            return { sentence, score, index };
        });

        // スコアでソートして上位を選択
        const topSentences = scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, sentenceCount)
            .sort((a, b) => a.index - b.index);  // 元の順序で並べ替え

        const summary = topSentences
            .map(s => s.sentence)
            .join('。') + '。';

        return {
            summary: summary,
            method: 'extractive',
            originalSentences: sentences.length,
            selectedSentences: topSentences.length,
            compressionRatio: ((summary.length / text.length) * 100).toFixed(1) + '%'
        };
    }

    /**
     * テキストをトークン化
     * @param {string} text
     * @returns {string[]}
     */
    #tokenize(text) {
        // 日本語と英語の両方に対応した簡易トークナイザ
        const tokens = [];

        // 英単語を抽出
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        tokens.push(...englishWords);

        // 日本語文字列（ひらがな、カタカナ、漢字の連続）を抽出
        const japaneseWords = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g) || [];

        // 日本語は形態素解析なしで2-4文字のn-gramで分割（簡易版）
        for (const word of japaneseWords) {
            if (word.length <= 4) {
                tokens.push(word);
            } else {
                // 長い単語は分割
                for (let i = 0; i < word.length - 1; i += 2) {
                    const chunk = word.substring(i, Math.min(i + 4, word.length));
                    if (chunk.length >= 2) {
                        tokens.push(chunk);
                    }
                }
            }
        }

        return tokens;
    }

    /**
     * ストップワードかどうかを判定
     * @param {string} word
     * @returns {boolean}
     */
    #isStopWord(word) {
        const lower = word.toLowerCase();
        return this.#stopWordsJa.has(lower) || this.#stopWordsEn.has(lower);
    }

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

// グローバルに公開
window.TextAnalyzerTool = TextAnalyzerTool;
