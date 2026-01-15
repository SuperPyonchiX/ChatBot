/**
 * agentToolSelector.js
 * タスクに基づいてツールを自動選択するセレクター
 */

/**
 * ツールスコアの型定義
 * @typedef {Object} ToolScore
 * @property {string} toolName - ツール名
 * @property {number} score - 関連度スコア (0-1)
 * @property {string} reason - スコアの理由
 */

class AgentToolSelector {
    static #instance = null;

    /**
     * ツールカテゴリとキーワードのマッピング
     */
    #categoryKeywords = {
        search: {
            keywords: ['検索', '調べ', '探し', '見つけ', 'search', 'find', 'look up', 'query'],
            tools: ['web_search', 'rag_search']
        },
        code: {
            keywords: ['実行', 'コード', 'プログラム', '計算', 'execute', 'run', 'code', 'calculate', 'compute'],
            tools: ['code_execute']
        },
        data: {
            keywords: ['データ', '分析', '処理', 'ファイル', 'data', 'analyze', 'process', 'file'],
            tools: ['rag_search', 'code_execute']
        },
        interaction: {
            keywords: ['確認', '質問', 'ユーザー', 'confirm', 'ask', 'user', 'input'],
            tools: ['ask_user']
        },
        web: {
            keywords: ['ウェブ', 'インターネット', '最新', 'ニュース', 'web', 'internet', 'latest', 'news', 'current'],
            tools: ['web_search']
        },
        knowledge: {
            keywords: ['知識', 'ナレッジ', 'ドキュメント', '資料', 'knowledge', 'document', 'reference'],
            tools: ['rag_search']
        }
    };

    /**
     * @constructor
     */
    constructor() {
        if (AgentToolSelector.#instance) {
            return AgentToolSelector.#instance;
        }
        AgentToolSelector.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentToolSelector}
     */
    static get getInstance() {
        if (!AgentToolSelector.#instance) {
            AgentToolSelector.#instance = new AgentToolSelector();
        }
        return AgentToolSelector.#instance;
    }

    // ========================================
    // メインメソッド
    // ========================================

    /**
     * タスクに基づいてツールを選択
     * @param {string} task - タスク説明
     * @param {Array} availableTools - 利用可能なツール
     * @param {Object} [options={}] - オプション
     * @param {number} [options.maxTools=5] - 選択する最大ツール数
     * @param {number} [options.threshold=0.3] - 最小スコア閾値
     * @returns {Array} 選択されたツール
     */
    selectTools(task, availableTools, options = {}) {
        const {
            maxTools = window.CONFIG?.AGENT?.TOOLS?.MAX_TOOLS_PER_CALL || 5,
            threshold = 0.3
        } = options;

        if (!task || !availableTools || availableTools.length === 0) {
            return [];
        }

        // 各ツールをスコアリング
        const scores = this.rankTools(task, availableTools);

        // 閾値以上のツールをフィルタリング
        const filteredScores = scores.filter(s => s.score >= threshold);

        // 上位N個を選択
        const selectedScores = filteredScores.slice(0, maxTools);

        // 選択されたツールを返す
        const selectedToolNames = new Set(selectedScores.map(s => s.toolName));
        const selectedTools = availableTools.filter(t => selectedToolNames.has(t.name));

        console.log(`[AgentToolSelector] ${selectedTools.length}個のツールを選択:`,
            selectedTools.map(t => t.name));

        return selectedTools;
    }

    /**
     * ツールをランク付け
     * @param {string} task - タスク説明
     * @param {Array} tools - ツール配列
     * @returns {ToolScore[]} スコア付きツール配列（降順ソート済み）
     */
    rankTools(task, tools) {
        const scores = tools.map(tool => this.#scoreTool(task, tool));

        // スコアの降順でソート
        scores.sort((a, b) => b.score - a.score);

        return scores;
    }

    /**
     * インテントにマッチするツールを取得
     * @param {string} intent - ユーザーの意図
     * @param {Array} tools - ツール配列
     * @returns {Array} マッチしたツール
     */
    matchToolToIntent(intent, tools) {
        const intentLower = intent.toLowerCase();

        // カテゴリを特定
        const matchedCategories = [];
        for (const [category, data] of Object.entries(this.#categoryKeywords)) {
            const hasMatch = data.keywords.some(keyword =>
                intentLower.includes(keyword.toLowerCase())
            );
            if (hasMatch) {
                matchedCategories.push(category);
            }
        }

        // マッチしたカテゴリのツールを収集
        const matchedToolNames = new Set();
        for (const category of matchedCategories) {
            const categoryTools = this.#categoryKeywords[category].tools;
            categoryTools.forEach(t => matchedToolNames.add(t));
        }

        // 利用可能なツールからフィルタ
        return tools.filter(tool => matchedToolNames.has(tool.name));
    }

    /**
     * 関連度スコアを計算
     * @param {Object} tool - ツール
     * @param {string} task - タスク
     * @returns {number} スコア (0-1)
     */
    calculateRelevanceScore(tool, task) {
        return this.#scoreTool(task, tool).score;
    }

    // ========================================
    // プライベートメソッド
    // ========================================

    /**
     * 単一ツールをスコアリング
     * @param {string} task - タスク説明
     * @param {Object} tool - ツール
     * @returns {ToolScore}
     */
    #scoreTool(task, tool) {
        const taskLower = task.toLowerCase();
        const toolName = tool.name.toLowerCase();
        const toolDesc = (tool.description || '').toLowerCase();

        let score = 0;
        const reasons = [];

        // 1. ツール名がタスクに含まれているか
        if (taskLower.includes(toolName.replace(/_/g, ' '))) {
            score += 0.4;
            reasons.push('ツール名がタスクに含まれる');
        }

        // 2. キーワードマッチング
        for (const [category, data] of Object.entries(this.#categoryKeywords)) {
            if (data.tools.includes(tool.name)) {
                const matchedKeywords = data.keywords.filter(kw =>
                    taskLower.includes(kw.toLowerCase())
                );
                if (matchedKeywords.length > 0) {
                    score += 0.2 * Math.min(matchedKeywords.length, 3);
                    reasons.push(`カテゴリ「${category}」キーワードマッチ`);
                }
            }
        }

        // 3. 説明文とタスクの類似度
        const descSimilarity = this.#calculateTextSimilarity(taskLower, toolDesc);
        if (descSimilarity > 0.1) {
            score += descSimilarity * 0.3;
            reasons.push('説明文との類似度');
        }

        // 4. 特定のツールに対する追加ルール
        score += this.#applyToolSpecificRules(task, tool);

        // スコアを0-1の範囲に正規化
        score = Math.min(1, Math.max(0, score));

        return {
            toolName: tool.name,
            score,
            reason: reasons.join(', ') || 'デフォルトスコア'
        };
    }

    /**
     * テキスト類似度を計算（簡易版）
     * @param {string} text1
     * @param {string} text2
     * @returns {number}
     */
    #calculateTextSimilarity(text1, text2) {
        const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
        const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));

        if (words1.size === 0 || words2.size === 0) {
            return 0;
        }

        let matchCount = 0;
        for (const word of words1) {
            if (words2.has(word)) {
                matchCount++;
            }
        }

        return matchCount / Math.max(words1.size, words2.size);
    }

    /**
     * ツール固有のルールを適用
     * @param {string} task
     * @param {Object} tool
     * @returns {number} 追加スコア
     */
    #applyToolSpecificRules(task, tool) {
        const taskLower = task.toLowerCase();
        let additionalScore = 0;

        switch (tool.name) {
            case 'web_search':
                // 最新情報、ニュース、現在の状況に関する質問
                if (/最新|現在|今日|ニュース|latest|current|today|news/i.test(task)) {
                    additionalScore += 0.3;
                }
                // URLやWebサイトへの言及
                if (/https?:|www\.|\.com|\.jp|サイト|ウェブ/i.test(task)) {
                    additionalScore += 0.2;
                }
                break;

            case 'rag_search':
                // ドキュメント、資料、内部情報への言及
                if (/ドキュメント|資料|マニュアル|document|manual|reference|社内|内部/i.test(task)) {
                    additionalScore += 0.3;
                }
                break;

            case 'code_execute':
                // コード、実行、計算への言及
                if (/コード|プログラム|スクリプト|関数|code|program|script|function/i.test(task)) {
                    additionalScore += 0.3;
                }
                // 数値計算
                if (/計算|合計|平均|統計|calculate|sum|average|statistics/i.test(task)) {
                    additionalScore += 0.2;
                }
                break;

            case 'ask_user':
                // 確認、質問への言及
                if (/確認|質問|選択|どちら|confirm|question|choice|which/i.test(task)) {
                    additionalScore += 0.2;
                }
                break;
        }

        return additionalScore;
    }

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * カテゴリキーワードを追加
     * @param {string} category - カテゴリ名
     * @param {string[]} keywords - キーワード配列
     * @param {string[]} tools - ツール名配列
     */
    addCategoryKeywords(category, keywords, tools) {
        if (this.#categoryKeywords[category]) {
            this.#categoryKeywords[category].keywords.push(...keywords);
            this.#categoryKeywords[category].tools.push(...tools);
        } else {
            this.#categoryKeywords[category] = { keywords, tools };
        }
    }

    /**
     * すべてのカテゴリを取得
     * @returns {Object}
     */
    getCategories() {
        return { ...this.#categoryKeywords };
    }

    // ========================================
    // コンテキストベースの学習機能
    // ========================================

    /**
     * 実行履歴からツール使用パターンを学習
     * @param {Array} taskHistory - タスク履歴
     * @returns {Object} 学習されたパターン
     */
    learnFromHistory(taskHistory) {
        const patterns = {
            toolUsageCount: {},
            taskToolMapping: {},
            successfulCombinations: []
        };

        if (!taskHistory || taskHistory.length === 0) {
            return patterns;
        }

        for (const task of taskHistory) {
            if (!task.success || !task.toolsUsed) continue;

            // ツール使用回数をカウント
            for (const tool of task.toolsUsed) {
                patterns.toolUsageCount[tool] = (patterns.toolUsageCount[tool] || 0) + 1;
            }

            // タスクキーワードとツールのマッピング
            const keywords = this.#extractKeywords(task.goal || '');
            for (const keyword of keywords) {
                if (!patterns.taskToolMapping[keyword]) {
                    patterns.taskToolMapping[keyword] = {};
                }
                for (const tool of task.toolsUsed) {
                    patterns.taskToolMapping[keyword][tool] =
                        (patterns.taskToolMapping[keyword][tool] || 0) + 1;
                }
            }

            // 成功した組み合わせを記録
            if (task.toolsUsed.length > 1) {
                patterns.successfulCombinations.push({
                    tools: task.toolsUsed,
                    taskType: this.#classifyTask(task.goal || '')
                });
            }
        }

        console.log('[AgentToolSelector] 履歴から学習完了:', patterns);
        return patterns;
    }

    /**
     * 学習済みパターンを使用してツール選択を改善
     * @param {string} task - タスク
     * @param {Array} tools - 利用可能なツール
     * @param {Object} learnedPatterns - 学習済みパターン
     * @returns {Array} 改善されたツールスコア
     */
    selectToolsWithLearning(task, tools, learnedPatterns) {
        const scores = this.rankTools(task, tools);

        if (!learnedPatterns || Object.keys(learnedPatterns).length === 0) {
            return scores;
        }

        const keywords = this.#extractKeywords(task);

        // 学習パターンに基づいてスコアを調整
        for (const score of scores) {
            // 過去の使用頻度に基づくボーナス
            const usageCount = learnedPatterns.toolUsageCount?.[score.toolName] || 0;
            if (usageCount > 0) {
                const usageBonus = Math.min(0.15, usageCount * 0.02);
                score.score = Math.min(1, score.score + usageBonus);
                score.reason += ', 使用履歴ボーナス';
            }

            // キーワードマッチングに基づくボーナス
            for (const keyword of keywords) {
                const mapping = learnedPatterns.taskToolMapping?.[keyword];
                if (mapping && mapping[score.toolName]) {
                    const mappingBonus = Math.min(0.1, mapping[score.toolName] * 0.03);
                    score.score = Math.min(1, score.score + mappingBonus);
                    score.reason += ', キーワード履歴マッチ';
                }
            }
        }

        // 再ソート
        scores.sort((a, b) => b.score - a.score);
        return scores;
    }

    /**
     * テキストからキーワードを抽出
     * @param {string} text
     * @returns {string[]}
     */
    #extractKeywords(text) {
        const stopWords = new Set([
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
            'の', 'を', 'に', 'は', 'が', 'で', 'と', 'て', 'から', 'まで'
        ]);

        return text.toLowerCase()
            .split(/[\s、。,.\-_]+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }

    /**
     * タスクを分類
     * @param {string} task
     * @returns {string}
     */
    #classifyTask(task) {
        const taskLower = task.toLowerCase();

        if (/検索|調べ|探/.test(taskLower)) return 'search';
        if (/計算|分析|集計/.test(taskLower)) return 'analysis';
        if (/作成|生成|作って/.test(taskLower)) return 'creation';
        if (/確認|チェック/.test(taskLower)) return 'verification';
        if (/説明|教えて/.test(taskLower)) return 'explanation';

        return 'general';
    }

    // ========================================
    // ツール優先度設定
    // ========================================

    /** @type {Object} */
    #toolPriorities = {};

    /**
     * ツールの優先度を設定
     * @param {string} toolName - ツール名
     * @param {number} priority - 優先度 (0-1)
     */
    setToolPriority(toolName, priority) {
        this.#toolPriorities[toolName] = Math.max(0, Math.min(1, priority));
        console.log(`[AgentToolSelector] ツール優先度設定: ${toolName} = ${priority}`);
    }

    /**
     * ツールの優先度を取得
     * @param {string} toolName
     * @returns {number}
     */
    getToolPriority(toolName) {
        return this.#toolPriorities[toolName] ?? 0.5;
    }

    /**
     * 全ツール優先度を取得
     * @returns {Object}
     */
    getAllPriorities() {
        return { ...this.#toolPriorities };
    }

    /**
     * 優先度を適用してツールを選択
     * @param {string} task
     * @param {Array} tools
     * @param {Object} [options={}]
     * @returns {Array}
     */
    selectToolsWithPriority(task, tools, options = {}) {
        const scores = this.rankTools(task, tools);

        // 優先度を適用
        for (const score of scores) {
            const priority = this.getToolPriority(score.toolName);
            // 優先度によるスコア調整（-0.1 〜 +0.1の範囲）
            const adjustment = (priority - 0.5) * 0.2;
            score.score = Math.max(0, Math.min(1, score.score + adjustment));
            if (adjustment !== 0) {
                score.reason += `, 優先度調整(${adjustment > 0 ? '+' : ''}${adjustment.toFixed(2)})`;
            }
        }

        // 再ソート
        scores.sort((a, b) => b.score - a.score);

        // フィルタリングと制限
        const {
            maxTools = window.CONFIG?.AGENT?.TOOLS?.MAX_TOOLS_PER_CALL || 5,
            threshold = 0.3
        } = options;

        const filtered = scores.filter(s => s.score >= threshold).slice(0, maxTools);
        const selectedToolNames = new Set(filtered.map(s => s.toolName));

        return tools.filter(t => selectedToolNames.has(t.name));
    }

    // ========================================
    // 推奨ツール機能
    // ========================================

    /**
     * タスクに対する推奨ツールを取得（詳細説明付き）
     * @param {string} task - タスク
     * @param {Array} tools - 利用可能なツール
     * @returns {Array<{tool: Object, score: number, reason: string, recommendation: string}>}
     */
    getToolRecommendations(task, tools) {
        const scores = this.rankTools(task, tools);
        const toolMap = new Map(tools.map(t => [t.name, t]));

        return scores.map(score => {
            const tool = toolMap.get(score.toolName);
            let recommendation = '';

            if (score.score >= 0.7) {
                recommendation = '強く推奨: このタスクに最適なツールです';
            } else if (score.score >= 0.5) {
                recommendation = '推奨: このタスクに役立つ可能性が高いです';
            } else if (score.score >= 0.3) {
                recommendation = '任意: 補助的に使用できる可能性があります';
            } else {
                recommendation = '非推奨: このタスクにはあまり適していません';
            }

            return {
                tool,
                score: score.score,
                reason: score.reason,
                recommendation
            };
        });
    }

    /**
     * デバッグ用: ツール選択の詳細を出力
     * @param {string} task
     * @param {Array} tools
     */
    debugToolSelection(task, tools) {
        console.group('[AgentToolSelector] ツール選択デバッグ');
        console.log('タスク:', task);
        console.log('利用可能ツール:', tools.map(t => t.name));

        const scores = this.rankTools(task, tools);
        console.table(scores);

        const recommendations = this.getToolRecommendations(task, tools);
        console.log('推奨:', recommendations.filter(r => r.score >= 0.3).map(r => ({
            name: r.tool?.name,
            score: r.score.toFixed(2),
            recommendation: r.recommendation
        })));

        console.groupEnd();
    }
}

// グローバルに公開
window.AgentToolSelector = AgentToolSelector;
