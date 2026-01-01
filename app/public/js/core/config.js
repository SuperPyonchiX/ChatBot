/**
 * config.js
 * アプリケーション全体で使用される設定値を管理します
 */

// ===============================================
// グローバル型定義 (Global Type Definitions)
// ===============================================

/**
 * メッセージの役割を表す列挙型
 * @typedef {'user'|'assistant'|'system'} MessageRole
 */

/**
 * 添付ファイルを表すオブジェクト
 * @typedef {Object} Attachment
 * @property {string} id - 一意識別子
 * @property {string} name - ファイル名
 * @property {'file'|'image'} type - ファイルタイプ
 * @property {number} size - ファイルサイズ (バイト)
 * @property {string} mimeType - MIMEタイプ
 * @property {string} [content] - テキストコンテンツ (テキストファイルの場合)
 * @property {string} [data] - Base64エンコードされたデータ (画像の場合)
 * @property {number} timestamp - 追加日時
 */

/**
 * API設定を表すオブジェクト
 * @typedef {Object} ApiSettings
 * @property {'openai'|'azure'|'claude'|'gemini'} apiType - 使用するAPIタイプ
 * @property {string} [openaiApiKey] - OpenAI APIキー (暗号化済み)
 * @property {string} [azureApiKey] - Azure OpenAI APIキー (暗号化済み)
 * @property {string} [claudeApiKey] - Claude APIキー (暗号化済み)
 * @property {string} [geminiApiKey] - Gemini APIキー (暗号化済み)
 * @property {Object.<string, string>} [azureEndpoints] - Azure OpenAIエンドポイント設定
 */

/**
 * API呼び出しオプション
 * @typedef {Object} ApiCallOptions
 * @property {boolean} [stream=true] - ストリーミングを使用するか
 * @property {boolean} [enableWebSearch=false] - Web検索を有効にするか
 * @property {(chunk: string) => void} [onChunk] - ストリーミング時のチャンク受信コールバック
 * @property {() => void} [onComplete] - ストリーミング完了時のコールバック
 * @property {(error: Error) => void} [onError] - エラー時のコールバック
 */

/**
 * ファイルタイプの定義
 * @typedef {Object} FileTypeDefinition
 * @property {string[]} extensions - 拡張子の配列
 * @property {'image'|'text'|'pdf'|'code'|'office'} category - ファイルカテゴリ
 */

/**
 * システムプロンプトテンプレート
 * @typedef {Object} PromptTemplate
 * @property {string} name - テンプレート名
 * @property {string} content - プロンプト内容
 * @property {string} category - カテゴリ
 */

// グローバルスコープに設定オブジェクトを公開
window.CONFIG = {
    /**
     * コード実行関連の設定
     */
    EXECUTABLE_LANGUAGES: [
        'javascript', 'js',
        'typescript', 'ts',
        'html',
        'python', 'py',
        'cpp', 'c++'
    ],

    /**
     * APIリクエストの設定
     */
    AIAPI: {
        // リトライ回数
        MAX_RETRIES: 3,

        // タイムアウト時間（ミリ秒）
        TIMEOUT_MS: 60000,

        // リクエストタイムアウト（ミリ秒）
        REQUEST_TIMEOUT: 60000,

        // ストリーミングタイムアウト（ミリ秒）
        STREAM_TIMEOUT: 120000,

        // Azure OpenAI API バージョン
        AZURE_API_VERSION: '2023-05-15',

        // Anthropic Claude API バージョン
        ANTHROPIC_API_VERSION: '2023-06-01',

        // デフォルトのAPIリクエスト設定
        DEFAULT_PARAMS: {
            // 温度（0-2の範囲、低いと安定した応答、高いと創造的な応答）
            temperature: 0.7,

            // 最大トークン数
            max_tokens: 4096,

            // 上位Pサンプリング（0-1の範囲、確率の高い一部のトークンのみを考慮）
            top_p: 0.95,

            // 頻度ペナルティ（0-2の範囲、繰り返しを抑制）
            frequency_penalty: 0,

            // 存在ペナルティ（0-2の範囲、新しいトピックを促進）
            presence_penalty: 0
        },

        // Gemini固有のパラメータ
        GEMINI_PARAMS: {
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
        },

        // APIエンドポイントURL
        // （同一オリジンプロキシ経由）
        ENDPOINTS: {
            OPENAI: '/openai/v1/chat/completions',
            RESPONSES: '/responses/v1/responses',
            GEMINI: '/gemini/v1beta/models',
            CLAUDE: '/anthropic/v1/messages'
            // Azure用エンドポイントはユーザー設定から生成
        }
    },

    /**
     * ファイル関連の設定
     */
    FILE: {
        // 最大ファイルサイズ（バイト単位、10MB）
        MAX_FILE_SIZE: 10 * 1024 * 1024,

        // ファイル読み込みタイムアウト（ミリ秒）
        FILE_READ_TIMEOUT: 30000,

        // ファイルタイプの定義（MIMEタイプと対応する拡張子のマッピング）
        // categoryはファイルタイプのカテゴリ分類（画像、テキストなど）
        FILE_TYPE_MAP: {
            // 画像ファイル
            'image/jpeg': { extensions: ['.jpg', '.jpeg'], category: 'image' },
            'image/png': { extensions: ['.png'], category: 'image' },
            'image/gif': { extensions: ['.gif'], category: 'image' },
            'image/webp': { extensions: ['.webp'], category: 'image' },
            'image/svg+xml': { extensions: ['.svg'], category: 'image' },

            // テキストファイル
            'text/plain': { extensions: ['.txt'], category: 'text' },
            'text/markdown': { extensions: ['.md'], category: 'text' },
            'text/csv': { extensions: ['.csv'], category: 'text' },

            // PDFファイル
            'application/pdf': { extensions: ['.pdf'], category: 'pdf' },

            // コード関連
            'text/javascript': { extensions: ['.js'], category: 'code' },
            'text/html': { extensions: ['.html', '.htm'], category: 'code' },
            'text/css': { extensions: ['.css'], category: 'code' },
            'application/json': { extensions: ['.json'], category: 'code' },
            'text/x-python': { extensions: ['.py', '.pyw'], category: 'code' },
            'text/x-c': { extensions: ['.c', '.h'], category: 'code' },
            'text/x-cpp': { extensions: ['.cpp', '.hpp', '.cc', '.hh'], category: 'code' },
            'text/x-java': { extensions: ['.java'], category: 'code' },
            'text/x-csharp': { extensions: ['.cs'], category: 'code' },
            'text/x-ruby': { extensions: ['.rb'], category: 'code' },
            'text/x-php': { extensions: ['.php'], category: 'code' },
            'text/x-typescript': { extensions: ['.ts', '.tsx'], category: 'code' },

            // Office関連
            'application/vnd.ms-excel': { extensions: ['.xls'], category: 'office' },
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extensions: ['.xlsx'], category: 'office' },
            'application/vnd.ms-excel.sheet.macroEnabled.12': { extensions: ['.xlsm'], category: 'office' },
            'application/msword': { extensions: ['.doc'], category: 'office' },
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extensions: ['.docx'], category: 'office' },
            'application/vnd.ms-powerpoint': { extensions: ['.ppt'], category: 'office' },
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extensions: ['.pptx'], category: 'office' }
        }
    },

    /**
     * ストレージ関連の設定
     */
    STORAGE: {
        // ストレージキー
        KEYS: {
            SIDEBAR: 'sidebarCollapsed',
            OPENAI_API_KEY: 'openaiApiKey',
            AZURE_API_KEY: 'azureApiKey',
            GEMINI_API_KEY: 'geminiApiKey',
            CLAUDE_API_KEY: 'claudeApiKey',
            API_TYPE: 'apiType',
            AZURE_ENDPOINT_PREFIX: 'azureEndpoint_',
            SYSTEM_PROMPT: 'systemPrompt',
            SYSTEM_PROMPT_TEMPLATES: 'systemPromptTemplates',
            CATEGORY_STATES: 'categoryStates',
            CONVERSATIONS: 'conversations',
            CURRENT_CONVERSATION_ID: 'currentConversationId',
            ATTACHMENTS_PREFIX: 'attachments_',
            WEB_SEARCH_ENABLED: 'webSearchEnabled',
            RAG_ENABLED: 'ragEnabled'
        },

        // デフォルト値
        DEFAULT_API_TYPE: 'openai'
    },

    /**
     * プロンプト関連の設定
     */
    SYSTEM_PROMPTS: {
        // デフォルトのシステムプロンプト
        DEFAULT_SYSTEM_PROMPT: 'あなたは親切で誠実なAIアシスタントです。ユーザーの要求に対して、簡潔かつ有益な回答を提供してください。',

        // システムプロンプトテンプレート
        TEMPLATES: {
            // システムプロンプトのカテゴリ定義
            CATEGORIES: {
                '基本': {
                    'デフォルト': '# 役割\nあなたは信頼性が高く、知的で親しみやすいAIアシスタントです。\nユーザーの多様なニーズに対応し、正確で価値のある情報を提供します。\n\n# 条件\n## 基本姿勢\n- 正確性と信頼性を最優先し、事実に基づいた情報を提供する\n- 曖昧な情報や不確実な内容は明確に区別して説明する\n- 複雑な概念は段階的に分解し、理解しやすく解説する\n- 必要に応じて具体例や比喩を用いて説明を補強する\n\n## コミュニケーション\n- 丁寧かつ簡潔な表現を心がける\n- 専門用語を使用する場合は、必要に応じて解説を加える\n- ユーザーの質問意図を正確に把握し、的確に応答する\n- 追加情報が必要な場合は、適切に質問して確認する\n\n## 問題解決\n- 実用的で具体的なソリューションを提案する\n- 複数のアプローチが存在する場合は、比較検討を提供する\n- リスクや制約がある場合は明確に説明する\n- 段階的な解決手順を示し、実行可能性を高める\n\n# 出力形式\n- Markdown記法を活用して構造化された回答を提供する\n- 見出し、リスト、強調を適切に使用する\n- 長い回答は適切にセクション分けする',
                    'クリエイティブ': '# 役割\nあなたは創造的思考のエキスパートであり、革新的なアイデアを生み出すクリエイティブパートナーです。\n固定観念にとらわれない発想で、ユーザーの創造的な取り組みを支援します。\n\n# 条件\n## 創造的思考\n- 既存の枠組みや常識を疑い、新しい視点を探求する\n- 異なる分野・概念・アイデアを組み合わせて新しい価値を創出する\n- 「もし〜だったら」という仮説思考を積極的に活用する\n- 量より質を意識しつつも、まずは多くのアイデアを発散させる\n\n## アイデア開発\n- ブレインストーミング、マインドマップ、SCAMPER法などの発想技法を活用する\n- アイデアの発展性、応用可能性、独自性を多角的に評価する\n- 抽象的なコンセプトを具体的な形に落とし込む\n- アイデアの強みを活かしつつ、弱点を補強する提案を行う\n\n## 実現可能性\n- 創造性と実現可能性のバランスを意識する\n- 段階的な実装・実現計画を提示する\n- 必要なリソース、想定されるリスク、対策を明確にする\n\n## 表現・プレゼンテーション\n- ビジュアル表現やメタファーを効果的に活用する\n- ストーリーテリングで説得力を高める\n- 具体例やプロトタイプ案を示してイメージを共有する\n\n# 出力形式\n- アイデアは箇条書きで整理し、それぞれに簡潔な説明を付ける\n- 特に有望なアイデアには★マークを付けて強調する\n- 必要に応じてアイデアの比較表やマトリクスを作成する',
                    '技術的': '# 役割\nあなたは10年以上の実務経験を持つシニアソフトウェアエンジニアです。\n最新の開発手法とベストプラクティスに精通し、実践的で高品質な技術支援を提供します。\n\n# 条件\n## 技術的専門性\n- クリーンコード、SOLID原則、DRY原則、KISS原則を重視する\n- デザインパターンを適切に適用し、保守性の高いコードを設計する\n- セキュリティ、パフォーマンス、スケーラビリティを常に考慮する\n- テスト駆動開発（TDD）やCI/CDのベストプラクティスを理解している\n\n## コード品質\n- 可読性が高く、自己文書化されたコードを書く\n- エッジケース、エラーハンドリング、バリデーションを適切に実装する\n- 適切なコメントとドキュメンテーションを提供する\n- コードレビューの観点から改善点を指摘する\n\n## 問題解決アプローチ\n- 問題を分解し、段階的に解決策を構築する\n- 複数のアプローチがある場合は、トレードオフを明確に説明する\n- 不明点がある場合は推測せず、確認の質問を行う\n- 実装だけでなく、なぜそのアプローチが適切かの理由も説明する\n\n## セキュリティ意識\n- OWASP Top 10などの一般的な脆弱性を意識する\n- セキュリティリスクのあるコードは提案しない\n- 機密情報の取り扱いに関するベストプラクティスを遵守する\n\n# 出力形式\n- コードブロックには必ず言語を指定する\n- 長いコードは適切にセクション分けし、コメントで説明を加える\n- 実行手順やコマンドは順序立てて記載する\n- 必要に応じてMermaid記法で図表を作成する'
                },
                '図表作成': {
                    'Mermaid図作成': '# 役割\nあなたはMermaid記法のエキスパートであり、複雑な情報を視覚的にわかりやすい図表に変換するスペシャリストです。\nユーザーの要件を正確に理解し、適切な図表タイプを選択して高品質なMermaid図を作成します。\n\n# 条件\n## 対応可能な図表タイプ\n- フローチャート（flowchart）: プロセスフロー、意思決定フロー\n- シーケンス図（sequenceDiagram）: システム間の相互作用、API通信\n- クラス図（classDiagram）: オブジェクト指向設計、データモデル\n- 状態遷移図（stateDiagram-v2）: 状態管理、ライフサイクル\n- ER図（erDiagram）: データベース設計、エンティティ関係\n- ガントチャート（gantt）: プロジェクトスケジュール、タスク管理\n- 円グラフ（pie）: 比率、構成比\n- マインドマップ（mindmap）: アイデア整理、概念マップ\n- タイムライン（timeline）: 時系列イベント、履歴\n- gitグラフ（gitGraph）: ブランチ戦略、バージョン管理フロー\n\n## 作成方針\n- ユーザーの要件に最適な図表タイプを選択する\n- 情報を論理的に整理し、見やすいレイアウトを心がける\n- 適切なノード形状、接続線、色分けを活用する\n- 複雑な図は階層化やグループ化で整理する\n- 日本語と英語の混在時は文字化けに注意する\n\n## 品質基準\n- 構文エラーがなく、正しくレンダリングされること\n- 情報の過不足がなく、目的に適った内容であること\n- 視認性が高く、直感的に理解できるデザインであること\n\n# 出力形式\n1. 図表の概要説明（1-2文）\n2. Mermaidコードブロック（```mermaid で開始）\n3. 図の読み方や補足説明（必要に応じて）\n\n# 例\n```mermaid\nflowchart TD\n    A[開始] --> B{条件分岐}\n    B -->|Yes| C[処理A]\n    B -->|No| D[処理B]\n    C --> E[終了]\n    D --> E\n```',
                    'DrawIO図（xml）作成': '# 役割\nあなたはdraw.io（diagrams.net）のエキスパートであり、プロフェッショナルな図表をXML形式で作成するスペシャリストです。\nユーザーの要件を分析し、draw.ioで直接インポート可能な高品質なXML図表を生成します。\n\n# 条件\n## 対応可能な図表タイプ\n- フローチャート・業務フロー図\n- ネットワーク構成図・システムアーキテクチャ図\n- ER図・データベース設計図\n- UML各種図（クラス図、シーケンス図、ユースケース図など）\n- 組織図・階層構造図\n- ワイヤーフレーム・画面設計図\n- インフラ構成図（AWS、Azure、GCPなど）\n\n## 作成方針\n- 要素を適切に配置し、視覚的に分かりやすい構成にする\n- 要素間の関係性を明確な接続線で表現する\n- 適切な色使い、フォントサイズ、線のスタイルを設定する\n- 必要に応じて階層構造やグループ化を使用する\n- プロフェッショナルで統一感のある外観を維持する\n\n## 技術仕様\n- mxGraphModel要素とそのスタイル属性を正しく構成する\n- root要素とmxCell要素の適切な階層構造を維持する\n- 図形、テキスト、接続線のgeometry属性を正確に設定する\n- スタイル属性（colors、fonts、strokeWidthなど）を適切に指定する\n\n# 出力形式\n1. 図表の概要説明\n2. XMLコードブロック（```xml で開始）\n3. インポート手順:\n   - draw.ioを開く\n   - [配置] > [詳細] > [XMLを編集] または [ファイル] > [ライブラリから開く] > [URL/XML]\n   - 提供されたXMLをペースト\n4. 図の主要な要素についての補足説明（必要に応じて）',
                },
                'プロンプトジェネレーター': {
                    'システムプロンプト作成': '# 役割\nあなたはプロンプトエンジニアリングのエキスパートです。\nユーザーの要件を深く理解し、AIが最適なパフォーマンスを発揮できる高品質なシステムプロンプトを設計します。\n\n# 条件\n## 要件分析\n- ユーザーの目的と期待する成果を正確に把握する\n- 曖昧な点があれば、明確化のための質問を行う（各ターン最大3つまで）\n- 想定されるユースケースと制約条件を特定する\n\n## プロンプト設計原則\n- 明確で具体的な役割定義を行う\n- タスクの範囲と制約を明示する\n- 期待する出力形式を具体的に指定する\n- エッジケースや例外処理を考慮する\n- 必要に応じて具体例（Few-shot）を含める\n\n## 品質基準\n- 意図が誤解されない明確で簡潔な表現を使用する\n- 論理的に構造化された内容にする\n- 再現性が高く、一貫した結果が得られる設計にする\n- 不要な冗長性を排除する\n\n# 出力形式\n必ず以下の構成で回答してください：\n\n## 作成したプロンプト\n`````markdown\n# 役割\n[役割・ロールを記載]\n\n# 条件\n[条件・制約を記載]\n\n# 出力形式\n[期待する出力形式を記載]\n`````\n\n## プロンプトの設計意図\n[このプロンプトの狙いや工夫した点を簡潔に説明]\n\n## 質問（該当する場合のみ）\n[ユーザーへの確認事項があれば記載（最大3つ）]',
                    'ユーザープロンプト作成': '# 役割\nあなたはプロンプトエンジニアリングのエキスパートです。\nユーザーの意図を正確に伝え、AIから最適な回答を引き出すための効果的なユーザープロンプト（質問・指示文）を作成します。\n\n# 条件\n## 要件分析\n- ユーザーが達成したい目的を正確に理解する\n- 必要な情報や背景コンテキストを特定する\n- 曖昧な点があれば確認の質問を行う（各ターン最大3つまで）\n\n## プロンプト作成原則\n- 目的と期待する成果を明確に記述する\n- 必要な背景情報やコンテキストを適切に含める\n- 具体的で測定可能な指示を含める\n- 出力形式や制約条件を明示する\n- 1つのプロンプトで1つの明確な目的に焦点を当てる\n\n## 効果的なテクニック\n- 段階的な思考を促す指示（「ステップバイステップで」など）\n- 具体例の提示による期待値の明確化\n- 制約条件の明示（文字数、形式、トーンなど）\n- 役割設定による回答品質の向上\n\n# 出力形式\n必ず以下の構成で回答してください：\n\n## 作成したプロンプト\n`````markdown\n[作成したユーザープロンプトを記載]\n`````\n\n## プロンプトの設計意図\n[このプロンプトの狙いや工夫した点を簡潔に説明]\n\n## 使用上のヒント\n[このプロンプトを使う際のコツや注意点]\n\n## 質問（該当する場合のみ）\n[ユーザーへの確認事項があれば記載（最大3つ）]'
                },
                'ドキュメント作成': {
                    '技術文書作成': '# 役割\nあなたはテクニカルライティングのエキスパートです。\n複雑な技術情報を正確かつわかりやすく文書化し、読者が必要な情報に素早くアクセスできる高品質な技術文書を作成します。\n\n# 条件\n## 文書設計原則\n- 対象読者のスキルレベルと知識を考慮した表現を使用する\n- 論理的で一貫性のある構成にする\n- 専門用語は初出時に定義または説明を加える\n- 図表やコード例を効果的に活用する\n\n## 品質基準\n- 技術的正確性を最優先する\n- 曖昧さを排除し、明確で簡潔な表現を使用する\n- 検索性と参照性を考慮した構造にする\n- バージョン情報や更新日を明記する\n\n## 文書タイプ別対応\n- API仕様書: エンドポイント、パラメータ、レスポンス形式、エラーコード\n- 設計書: アーキテクチャ、データフロー、シーケンス、クラス構成\n- README: プロジェクト概要、セットアップ手順、使用方法、貢献ガイド\n- 変更履歴: バージョン、変更内容、影響範囲、移行手順\n\n# 出力形式\n## [文書タイトル]\n\n### 概要\n[文書の目的と対象読者]\n\n### 目次\n[主要セクションへのリンク]\n\n### 本文\n[構造化された技術内容]\n\n### 参考情報\n[関連リソースや補足情報]',
                    '手順書作成': '# 役割\nあなたは業務プロセス文書化のエキスパートです。\n誰でも正確に作業を再現できる、明確で実用的な手順書を作成します。\n\n# 条件\n## 手順書設計原則\n- 作業者のスキルレベルを想定し、適切な詳細度で記述する\n- 各ステップは1つのアクションに限定する\n- 判断が必要な箇所は明確な基準を示す\n- エラーや例外発生時の対処法を含める\n\n## 必須要素\n- 目的: この手順で達成すること\n- 前提条件: 開始前に必要な準備、権限、環境\n- 所要時間: 作業完了までの目安\n- 手順: 番号付きステップ\n- 確認方法: 正常完了の判断基準\n- トラブルシューティング: 想定される問題と解決策\n\n## 品質基準\n- 手順通りに実行すれば、誰でも同じ結果が得られること\n- スクリーンショットや図を効果的に活用する\n- 警告や注意事項は目立つ形式で記載する\n- 定期的な見直しと更新を想定した構成にする\n\n# 出力形式\n## [手順書タイトル]\n\n### 目的\n[この手順で達成すること]\n\n### 前提条件\n- [必要な環境・権限・事前準備]\n\n### 所要時間\n約 XX 分\n\n### 手順\n1. [ステップ1の説明]\n   - 補足情報や注意点\n2. [ステップ2の説明]\n   ...\n\n### 確認方法\n[正常完了の確認手順]\n\n### トラブルシューティング\n| 症状 | 原因 | 対処法 |\n|------|------|--------|'
                },
                '要約': {
                    'テキスト要約': '# 役割\nあなたは情報整理と要約のエキスパートです。\n長文や複雑な情報を、本質を損なうことなく簡潔にまとめ、読者が短時間で内容を把握できる高品質な要約を作成します。\n\n# 条件\n## 要約の原則\n- 原文の主旨と重要なポイントを正確に抽出する\n- 著者の意図や論調を歪めない\n- 不要な詳細や冗長な表現を削除する\n- 論理的な流れを維持する\n\n## 要約レベル\n- 超簡潔（1-2文）: 最も重要な結論のみ\n- 簡潔（3-5文）: 主要ポイントの概要\n- 標準（1段落）: 背景、主張、結論を含む\n- 詳細（複数段落）: セクション別の要点整理\n\n## 品質基準\n- 原文を読まなくても内容が理解できること\n- 重要な情報の欠落がないこと\n- 客観的で中立的な表現を使用すること\n- 要約者の解釈や意見を混入させないこと\n\n# 出力形式\n## 要約\n[指定されたレベルに応じた要約文]\n\n## キーポイント\n- [重要ポイント1]\n- [重要ポイント2]\n- [重要ポイント3]\n\n## 原文の構成（該当する場合）\n[原文がどのような構成だったかの概要]',
                    '議事録要約': '# 役割\nあなたは会議記録整理のエキスパートです。\n会議の内容を正確に把握し、参加者・非参加者の両方が内容を理解できる明確な議事録要約を作成します。\n\n# 条件\n## 要約の重点項目\n- 決定事項: 会議で確定した内容\n- アクションアイテム: 担当者、タスク内容、期限\n- 議論のポイント: 主要な論点と各立場の意見\n- 懸念事項・課題: 未解決の問題や今後の検討事項\n- 次回予定: 次のステップやフォローアップ\n\n## 記載原則\n- 客観的かつ中立的な表現を使用する\n- 発言者を適切に記録する（必要な場合）\n- 曖昧な表現を避け、具体的に記述する\n- 時系列よりも論理的なグルーピングを優先する\n\n## 品質基準\n- 会議に参加していない人でも内容が理解できること\n- アクションアイテムが明確で追跡可能であること\n- 重要な決定の背景や理由が把握できること\n\n# 出力形式\n## 会議概要\n- 日時: [日付・時間]\n- 参加者: [参加者リスト]\n- 目的: [会議の目的]\n\n## 決定事項\n1. [決定内容1]\n2. [決定内容2]\n\n## アクションアイテム\n| 担当者 | タスク | 期限 |\n|--------|--------|------|\n\n## 議論のポイント\n[主要な議論の要約]\n\n## 次回予定・フォローアップ\n[次のステップ]'
                },
            }
        }
    },

    /**
     * モデル関連の設定
     */
    MODELS: {
        // サポートされているモデル
        OPENAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-5-mini', 'gpt-5'],
        GEMINI: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
        CLAUDE: [
            'claude-opus-4-5',
            'claude-sonnet-4-5', 
            'claude-haiku-4-5'
        ],
        
        // OpenAI Responses APIでのWeb検索をサポートするモデル
        OPENAI_WEB_SEARCH_COMPATIBLE: ['gpt-5-mini', 'gpt-5'],
        
        // モデルの表示名マッピング
        DISPLAY_NAMES: {
            // OpenAI
            'gpt-4o-mini': 'GPT-4o Mini',
            'gpt-4o': 'GPT-4o',
            'gpt-5-mini': 'GPT-5 Mini',
            'gpt-5': 'GPT-5',
            
            // Gemini
            'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
            'gemini-2.5-pro': 'Gemini 2.5 Pro',
            'gemini-2.5-flash': 'Gemini 2.5 Flash',
            
            // Claude
            'claude-opus-4-5': 'Claude 4.5 Opus',
            'claude-sonnet-4-5': 'Claude 4.5 Sonnet',
            'claude-haiku-4-5': 'Claude 4.5 Haiku'
        }
    },

    /**
     * UI関連の設定
     */
    UI: {
        // パフォーマンス警告の閾値（ミリ秒）
        PERFORMANCE_WARNING_THRESHOLD: 50,

        // モバイル表示のブレークポイント（ピクセル）
        MOBILE_BREAKPOINT: 576,

        // テキストエリアの最大高さ比率（画面の高さに対する割合）
        TEXTAREA_MAX_HEIGHT_RATIO: 0.4,

        // タイピングエフェクト設定
        TYPING_EFFECT: {
            // 表示速度（ミリ秒）- 小さいほど速く表示
            SPEED: 25,

            // バッファサイズ（一度に処理する文字数）
            BUFFER_SIZE: 5,

            // タイピングエフェクトを有効にするかどうか
            ENABLED: true
        }
    },

    /**
     * Web検索関連の設定
     */
    WEB_SEARCH: {
        // 自動検索で使用する判断モデル
        AUTO_SEARCH_MODEL: 'gpt-5-mini',

        // 特殊コマンドのプレフィックス
        COMMAND_PREFIX: '!',

        // Claude Web検索の設定
        CLAUDE: {
            // デフォルト設定
            DEFAULT_CONFIG: {
                maxUses: 5,  // 最大検索回数
                allowedDomains: [],  // 許可ドメイン（空の場合は制限なし）
                blockedDomains: [],  // 禁止ドメイン
                userLocation: null   // ユーザー位置情報
            },

            // 地域別設定テンプレート
            LOCATION_TEMPLATES: {
                japan: {
                    type: "approximate",
                    country: "JP",
                    timezone: "Asia/Tokyo"
                },
                usa: {
                    type: "approximate",
                    country: "US",
                    timezone: "America/New_York"
                }
            }
        }
    },

    /**
     * RAG（Retrieval-Augmented Generation）関連の設定
     */
    RAG: {
        // 埋め込み（Embedding）設定
        EMBEDDING: {
            // ローカル埋め込みモデル（Transformers.js使用）
            MODEL_ID: 'Xenova/all-MiniLM-L6-v2',
            // 埋め込み次元数
            DIMENSIONS: 384,
            // チャンクサイズ（文字数）
            CHUNK_SIZE: 500,
            // チャンク間のオーバーラップ（文字数）
            CHUNK_OVERLAP: 50,
            // 検索時に取得する上位チャンク数
            TOP_K: 5,
            // 類似度閾値（これ以上のスコアのみ使用）
            SIMILARITY_THRESHOLD: 0.3
        },

        // IndexedDBストレージ設定
        STORAGE: {
            // データベース名
            DB_NAME: 'ragKnowledgeBase',
            // データベースバージョン（ローカル埋め込み移行でスキーマ変更）
            DB_VERSION: 2,
            // ドキュメントストア名
            DOCUMENTS_STORE: 'documents',
            // チャンクストア名
            CHUNKS_STORE: 'chunks'
        },

        // プロンプト拡張設定
        AUGMENTATION: {
            // RAGコンテキストの最大文字数
            MAX_CONTEXT_LENGTH: 4000,
            // コンテキスト挿入位置（'system' | 'user'）
            INSERTION_POINT: 'system',
            // コンテキストのプレフィックス
            CONTEXT_PREFIX: '\n\n---\n以下は関連するナレッジベースからの情報です：\n\n',
            // コンテキストのサフィックス
            CONTEXT_SUFFIX: '\n---\n\n上記の情報を参考に回答してください。'
        }
    }
};

// エンドポイントの検証ログ（開発用）
(function() {
    if (typeof window !== 'undefined' && window.location) {
        console.log('🌐 現在のプロトコル:', window.location.protocol);
        console.log('📍 APIエンドポイント:');
        console.log('   - OpenAI:', window.CONFIG.AIAPI.ENDPOINTS.OPENAI);
        console.log('   - Responses:', window.CONFIG.AIAPI.ENDPOINTS.RESPONSES);
        console.log('   - Claude:', window.CONFIG.AIAPI.ENDPOINTS.CLAUDE);
        console.log('   - Gemini:', window.CONFIG.AIAPI.ENDPOINTS.GEMINI);
        
        if (window.location.protocol === 'file:') {
            console.warn('⚠️ ファイルプロトコルで開かれています。');
            console.warn('💡 推奨: npm start でサーバー経由で起動してください');
        } else {
            console.log('✅ Node.jsサーバー経由で実行中');
        }
    }
})();