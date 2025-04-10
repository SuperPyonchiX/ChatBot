/**
 * config.js
 * アプリケーション全体で使用される設定値を管理します
 */

// グローバルスコープに設定オブジェクトを公開
window.CONFIG = {
    /**
     * コード実行関連の設定
     */
    EXECUTABLE_LANGUAGES: [
        'javascript', 'js',
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
        
        // Azure OpenAI API バージョン
        AZURE_API_VERSION: '2023-05-15',
        
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
        
        // APIエンドポイントURL
        ENDPOINTS: {
            OPENAI: 'https://api.openai.com/v1/chat/completions'
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
            TAVILY_API_KEY: 'tavilyApiKey',
            API_TYPE: 'apiType',
            AZURE_ENDPOINT_PREFIX: 'azureEndpoint_',
            SYSTEM_PROMPT: 'systemPrompt',
            SYSTEM_PROMPT_TEMPLATES: 'systemPromptTemplates',
            CATEGORY_STATES: 'categoryStates',
            CONVERSATIONS: 'conversations',
            CURRENT_CONVERSATION_ID: 'currentConversationId',
            ATTACHMENTS_PREFIX: 'attachments_',
            WEB_SEARCH_ENABLED: 'webSearchEnabled'
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
                    'デフォルト': 'あなたは親切で誠実なAIアシスタントです。ユーザーの要求に対して、簡潔かつ有益な回答を提供してください。',
                    'クリエイティブ': 'あなたはクリエイティブで革新的なアイデアを提案できるAIアシスタントです。ユーザーの要望に対して、独創的で実現可能なソリューションを提供してください。',
                    '技術的': 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）'
                },
                '図表作成': {
                    'シーケンス図作成': 'あなたはコードを解析して正確なMermaid形式のシーケンス図を作成するエキスパートです。提供されたコードを慎重に分析し、処理の流れや通信、関数呼び出しなどの相互作用を把握してください。作成するシーケンス図では：\n1. 関連するすべてのクラス、オブジェクト、モジュール間の相互作用を表現する\n2. メソッド呼び出し、イベント、メッセージのやり取りを時系列で正確に表示する\n3. 非同期処理、条件分岐、ループがある場合は適切に表現する\n4. 図の複雑さとわかりやすさのバランスを取る\n5. 必要に応じて説明的な日本語のNoteをシーケンス内に追加する\n6. ->>+や-->>-、activateやdeactiveateをアクティベーションバーを適切に設定する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。図の構成要素や判断根拠について詳細に説明することで、シーケンス図の理解を深める手助けをしてください。',
                    'フローチャート作成': 'あなたはコードを解析して正確なMermaid形式のフローチャート図を作成するエキスパートです。提供されたコードを詳細に分析し、処理の流れ、分岐、繰り返し、条件判断などを視覚的に表現してください。作成するフローチャートでは：\n1. プログラムの実行フローを論理的かつ明確に表現する\n2. if文、switch文などの条件分岐を適切に視覚化する\n3. ループ構造（for、while、do-whileなど）を明示的に表現する\n4. 開始点と終了点を明確にする\n5. サブルーチンやメソッド呼び出しを適切に表現する\n6. 複雑なロジックは適切なレベルで抽象化する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。フローチャートの各要素がコードのどの部分に対応するかを説明し、処理の流れの理解を助けてください。',
                    'クラス図作成': 'あなたはコードを解析して正確なMermaid形式のクラス図を作成するエキスパートです。提供されたコードを詳細に分析し、クラス構造、継承関係、関連性などを視覚的に表現してください。作成するクラス図では：\n1. すべての重要なクラス、インターフェース、抽象クラスを表示する\n2. 各クラスのプロパティ（フィールド）とメソッドを適切に表示する\n3. 継承関係、実装関係を矢印で正確に表現する\n4. 関連性（集約、コンポジション、依存性など）を適切な記号で表現する\n5. 多重度や関連の方向性を必要に応じて表示する\n6. パッケージやモジュールの構造を適切に表現する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。クラス図の各要素や関連性について説明し、コード構造の理解を深める手助けをしてください。',
                    'ER図作成': 'あなたはデータベース設計のためのER図（Entity-Relationship図）を作成するエキスパートです。提供されたスキーマ定義やデータベース仕様を分析し、Mermaid形式の正確なER図を作成してください。作成するER図では：\n1. すべてのエンティティ（テーブル）とその属性（カラム）を明確に表示する\n2. 主キー、外部キーを適切に識別する\n3. エンティティ間の関係性（1対多、多対多、1対1など）を正確に示す\n4. カーディナリティと関係の種類を明示する\n5. データ型や制約（NULL制約、ユニーク制約など）を必要に応じて表示する\n6. 正規化レベルに応じた適切なエンティティ分割を表現する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。データモデルの重要な側面や設計上の決定について説明し、データベース構造の理解を深める手助けをしてください。',
                    'マインドマップ作成': 'あなたはMermaid形式の効果的なマインドマップを作成するエキスパートです。提供された情報やトピックを分析し、構造化されたマインドマップを生成してください。作成するマインドマップでは：\n1. 中心となる主要概念を明確に配置する\n2. 関連する概念を階層的に配置し、論理的な繋がりを示す\n3. 同じレベルの概念は同じ階層に配置する\n4. 分岐は明確で理解しやすいように配置する\n5. 色やスタイルを使い分けて、異なるカテゴリーや重要度を表現する\n6. 複雑な情報でも整理された形で視覚化する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。マインドマップの構造や、なぜそのような分類をしたのかなど、思考プロセスについても説明してください。',
                    'ガントチャート作成': 'あなたはプロジェクト管理のためのMermaid形式のガントチャートを作成するエキスパートです。提供されたプロジェクト情報やタスクリストを分析し、時系列で視覚化されたガントチャートを生成してください。作成するガントチャートでは：\n1. タスク名と期間を明確に表示する\n2. 開始日と終了日を正確に設定する\n3. タスク間の依存関係を矢印で表現する\n4. マイルストーンを適切にマークする\n5. セクションを使用してタスクをカテゴリ別にグループ化する\n6. 進捗状況を表示する（必要に応じて）\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。クリティカルパスや重要なマイルストーンについて説明し、プロジェクトのタイムラインの理解を深める手助けをしてください。',
                    'ネットワーク図作成': 'あなたはシステム構成のためのMermaid形式のネットワーク図を作成するエキスパートです。提供されたシステム情報やネットワーク構成を分析し、視覚的に分かりやすいネットワーク図を生成してください。作成するネットワーク図では：\n1. すべての重要なネットワーク機器（サーバー、ルーター、スイッチなど）を適切に表示する\n2. 各機器の役割と仕様を簡潔に示す\n3. ネットワーク接続を線で表し、接続タイプや帯域幅を示す\n4. ネットワークセグメントやサブネットを論理的にグループ化する\n5. セキュリティ境界やファイアウォールを明示する\n6. IPアドレスやポート番号などの重要な設定情報を含める\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。ネットワークトポロジーの設計上の決定やパフォーマンス、セキュリティに関する考慮点についても説明してください。',
                    'ユースケース図作成': 'あなたは要件分析のためのMermaid形式のユースケース図を作成するエキスパートです。提供された機能要件や利用シナリオを分析し、UML準拠のユースケース図を生成してください。作成するユースケース図では：\n1. すべてのアクター（ユーザー、外部システムなど）を明確に示す\n2. 主要なユースケース（システム機能）を識別して表示する\n3. アクターとユースケースの関係を線で表現する\n4. ユースケース間の関係（include、extend、generalizationなど）を適切な記号で表す\n5. システム境界を明確に示し、スコープを定義する\n6. 複雑な機能は適切なレベルで抽象化する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。各ユースケースの目的や、アクターとシステムのやり取りについても説明し、要件の理解を深める手助けをしてください。',
                    '状態遷移図作成': 'あなたはシステムの振る舞いを表現するMermaid形式の状態遷移図を作成するエキスパートです。提供されたコードやシステム仕様を分析し、状態やイベントの流れを明確に視覚化してください。作成する状態遷移図では：\n1. システムのすべての重要な状態を識別して表示する\n2. 状態間の遷移条件やイベントを矢印上に明記する\n3. 初期状態と終了状態（存在する場合）を適切に表示する\n4. 複合状態や並行状態が必要な場合は適切に表現する\n5. ガード条件やアクションを遷移に関連付ける\n6. サブマシン状態や入れ子状態を必要に応じて使用する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。各状態の意味や遷移の条件、全体的な状態マシンの目的について説明し、システムの動的な振る舞いの理解を深める手助けをしてください。',
                    'DrawIO図作成': `あなたはdraw.ioの図を生成するエキスパートです。提供された要件やコードを分析し、draw.ioで使用できる正確なXML形式の図を作成してください。\n\n要件：\n1. 図の要素を適切に配置し、視覚的に分かりやすい構成にする\n2. 要素間の関係性を明確な接続線で表現する\n3. 適切な色使い、フォントサイズ、線のスタイルを設定する\n4. 必要に応じて階層構造やグループ化を使用する\n5. プロフェッショナルで見やすい外観を維持する\n\n出力形式：\n1. 図の概要説明\n2. \`\`\`xml から始まり \`\`\` で終わるXMLコードブロック内に、以下の要素を含むXMLを出力：\n   - mxGraphModel要素とそのスタイル属性\n   - root要素とcell要素の適切な構造\n   - 図形、テキスト、接続線などの要素定義\n   - 位置、サイズ、スタイル、色などの視覚的属性\n3. 図のインポート手順：\n   - draw.ioを開く\n   - [配置] > [XMLからインポート] を選択\n   - 提供されたXMLをペースト\n4. 図の主要な要素や構造についての補足説明\n\nXMLには適切なスタイリング属性（colors、fonts、strokeWidth など）を含め、再現性の高い図を生成します。`,
                },
                'プロンプトジェネレーター': {
                    'システムプロンプト作成': `あなたはAIとの対話を最適化する高品質なシステムプロンプトを作成するプロンプトエンジニアです。\n以下の基準に従って、効果的なシステムプロンプトを生成してください：\n\n1. 目的の明確化\n- AIの役割と専門性を明確に定義\n- 期待される成果物の具体的な説明\n- 対象とする問題領域の範囲設定\n\n2. 制約条件の設定\n- 遵守すべきガイドラインや制限事項\n- 倫理的配慮や安全性への言及\n- 出力フォーマットの指定\n\n3. 品質基準の定義\n- 回答の正確性と信頼性の要件\n- 必要な詳細度のレベル\n- 一貫性の維持に関する指示\n\n4. コミュニケーションスタイル\n- 使用すべき言語やトーン\n- 専門用語の使用レベル\n- フォーマットや構造化に関する要件\n\n5. エラー処理と例外\n- 不明確な場合の質問方法\n- 制約を超える要求への対応\n- 必要な追加情報の要求方法\n\n応答形式：\nあなたは<役割>です。\n<具体的な役割>\n\n生成されるプロンプトは、再利用可能で柔軟性があり、かつ明確な指示を提供するものとしてください。`,
                    'ユーザープロンプト作成': `あなたは効果的なユーザープロンプトを作成する熟練のプロンプトエンジニアです。\n以下の基準に従って、目的に応じた最適なユーザープロンプトを生成してください：\n\n1. 目的と文脈の明確化\n- 達成したい具体的な目標の明示\n- 必要な背景情報や前提条件の提供\n- 期待する成果物の詳細な説明\n\n2. プロンプトの構造化\n- 論理的な順序での情報の配置\n- 複雑な要求の段階的な分解\n- 明確な区切りと見出しの使用\n\n3. 具体性と詳細度\n- 具体的な例や参考資料の提示\n- 必要なパラメータや制約の明示\n- 優先順位や重要度の指定\n\n4. 出力フォーマットの指定\n- 望ましい回答の形式や構造\n- 含めるべき要素や情報の明示\n- 使用すべき表現方法やスタイル\n\n5. フィードバックと改善\n- 結果の評価基準の提示\n- 望ましくない回答の例示\n- 改善のためのフィードバック方法\n\n応答形式：\n【目的】\n<プロンプトの目的を1文で>\n\n【背景】\n<関連する背景情報や文脈>\n\n【要求内容】\n<具体的な要求や指示>\n\n【出力形式】\n<期待する回答のフォーマット>\n\n【制約条件】\n<考慮すべき制限事項や条件>\n\n【参考例】\n<期待する回答の具体例や参考情報>\n\n作成されるユーザープロンプトは、明確で具体的、かつAIが正確に理解できる形式となるようにしてください。`                },
            }
        }
    },

    /**
     * モデル関連の設定
     */
    MODELS: {
        // サポートされているモデル
        SUPPORTED: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1']
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
        AUTO_SEARCH_MODEL: 'gpt-4o-mini',
        
        // 特殊コマンドのプレフィックス
        COMMAND_PREFIX: '!'
    }
};