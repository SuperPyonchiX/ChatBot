/**
 * ArtifactDetector
 * AIレスポンスからアーティファクト（プレビュー可能なコード）を検出するクラス
 */
class ArtifactDetector {
    static #instance = null;

    // アーティファクトタグのパターン
    #artifactTagPattern = /<artifact\s+([^>]*)>([\s\S]*?)<\/artifact>/gi;

    // コードブロックのパターン（プレビュー可能な言語のみ）
    #codeBlockPattern = /```(html|svg|mermaid|markdown|md)([\s\S]*?)```/gi;

    // サポートする言語タイプ
    #supportedTypes = ['html', 'svg', 'markdown', 'md', 'mermaid'];

    constructor() {
        if (ArtifactDetector.#instance) {
            return ArtifactDetector.#instance;
        }
        ArtifactDetector.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ArtifactDetector.#instance) {
            ArtifactDetector.#instance = new ArtifactDetector();
        }
        return ArtifactDetector.#instance;
    }

    /**
     * メッセージからアーティファクトを検出
     * @param {string} message - AIレスポンスメッセージ
     * @returns {Array<Object>} 検出されたアーティファクトの配列
     */
    detectArtifacts(message) {
        if (!message || typeof message !== 'string') {
            return [];
        }

        const artifacts = [];

        // <artifact>タグを検索
        const tagArtifacts = this.#parseArtifactTags(message);
        artifacts.push(...tagArtifacts);

        // コードブロックを検索（タグで見つからなかった場合のフォールバック）
        if (artifacts.length === 0) {
            const codeBlockArtifacts = this.#parseCodeBlocks(message);
            artifacts.push(...codeBlockArtifacts);
        }

        return artifacts;
    }

    /**
     * <artifact>タグを解析
     * @param {string} message - メッセージ
     * @returns {Array<Object>} アーティファクトの配列
     */
    #parseArtifactTags(message) {
        const artifacts = [];
        let match;

        // パターンをリセット
        this.#artifactTagPattern.lastIndex = 0;

        while ((match = this.#artifactTagPattern.exec(message)) !== null) {
            const attributes = match[1];
            const content = match[2].trim();

            const artifact = this.#parseAttributes(attributes, content);
            if (artifact) {
                artifacts.push(artifact);
            }
        }

        return artifacts;
    }

    /**
     * 属性を解析してアーティファクトオブジェクトを作成
     * @param {string} attributes - 属性文字列
     * @param {string} content - コンテンツ
     * @returns {Object|null} アーティファクトオブジェクト
     */
    #parseAttributes(attributes, content) {
        // 属性を解析
        const typeMatch = attributes.match(/type\s*=\s*["']([^"']+)["']/i);
        const titleMatch = attributes.match(/title\s*=\s*["']([^"']+)["']/i);

        const type = typeMatch ? typeMatch[1].toLowerCase() : this.#detectTypeFromContent(content);
        const title = titleMatch ? titleMatch[1] : this.#generateTitle(type);

        // サポートされているタイプかチェック
        const normalizedType = this.#normalizeType(type);
        if (!normalizedType) {
            return null;
        }

        return {
            id: this.#generateId(),
            type: normalizedType,
            title: title,
            content: content,
            language: type,
            timestamp: Date.now()
        };
    }

    /**
     * コードブロックを解析
     * @param {string} message - メッセージ
     * @returns {Array<Object>} アーティファクトの配列
     */
    #parseCodeBlocks(message) {
        const artifacts = [];
        let match;

        // パターンをリセット
        this.#codeBlockPattern.lastIndex = 0;

        while ((match = this.#codeBlockPattern.exec(message)) !== null) {
            const language = match[1].toLowerCase();
            const content = match[2].trim();

            // 空のコードブロックはスキップ
            if (!content) {
                continue;
            }

            const normalizedType = this.#normalizeType(language);
            if (!normalizedType) {
                continue;
            }

            artifacts.push({
                id: this.#generateId(),
                type: normalizedType,
                title: this.#generateTitle(normalizedType),
                content: content,
                language: language,
                timestamp: Date.now()
            });
        }

        return artifacts;
    }

    /**
     * コンテンツからタイプを検出
     * @param {string} content - コンテンツ
     * @returns {string} 検出されたタイプ
     */
    #detectTypeFromContent(content) {
        // HTMLかどうかチェック
        if (/<(!DOCTYPE|html|head|body|div|span|p|h[1-6]|script|style)/i.test(content)) {
            return 'html';
        }

        // SVGかどうかチェック
        if (/<svg[\s>]/i.test(content)) {
            return 'svg';
        }

        // Mermaidかどうかチェック
        if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey)/m.test(content)) {
            return 'mermaid';
        }

        // デフォルトはmarkdown
        return 'markdown';
    }

    /**
     * タイプを正規化
     * @param {string} type - タイプ
     * @returns {string|null} 正規化されたタイプ、サポートされていない場合はnull
     */
    #normalizeType(type) {
        if (!type) return null;

        const typeMap = {
            'html': 'html',
            'htm': 'html',
            'svg': 'svg',
            'markdown': 'markdown',
            'md': 'markdown',
            'mermaid': 'mermaid'
        };

        return typeMap[type.toLowerCase()] || null;
    }

    /**
     * ユニークIDを生成
     * @returns {string} ユニークID
     */
    #generateId() {
        return `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * タイトルを生成
     * @param {string} type - タイプ
     * @returns {string} タイトル
     */
    #generateTitle(type) {
        const titles = {
            'html': 'HTMLドキュメント',
            'svg': 'SVG画像',
            'markdown': 'Markdownドキュメント',
            'mermaid': 'Mermaid図'
        };

        return titles[type] || 'アーティファクト';
    }

    /**
     * サポートされているタイプかどうかチェック
     * @param {string} language - 言語
     * @returns {boolean} サポートされているかどうか
     */
    isSupportedType(language) {
        return this.#normalizeType(language) !== null;
    }

    /**
     * サポートされているタイプの一覧を取得
     * @returns {Array<string>} サポートされているタイプの配列
     */
    getSupportedTypes() {
        return ['html', 'svg', 'markdown', 'mermaid'];
    }
}
