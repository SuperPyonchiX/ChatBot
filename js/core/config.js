/**
 * config.js
 * アプリケーション全体で使用される設定値を管理します
 */

// グローバルスコープに設定オブジェクトを公開
window.CONFIG = {
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
        
        // 許可されるファイルタイプ
        ALLOWED_FILE_TYPES: {
            // 画像ファイル
            image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
            // テキストファイル
            text: ['text/plain', 'text/markdown', 'text/csv'],
            // PDFファイル
            pdf: ['application/pdf'],
            // コード関連
            code: [
                'text/javascript', 'text/html', 'text/css', 'application/json',
                'text/x-python', 'text/x-c', 'text/x-cpp',
                'text/x-java', 'text/x-csharp', 'text/x-ruby',
                'text/x-php', 'text/x-typescript'
            ],
            // Office関連
            office: [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel.sheet.macroEnabled.12',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ]
        },

        // MIMEタイプから拡張子へのマッピング
        MIME_TO_EXTENSION_MAP: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
            'image/svg+xml': ['.svg'],
            'text/plain': ['.txt'],
            'text/markdown': ['.md'],
            'text/csv': ['.csv'],
            'application/pdf': ['.pdf'],
            'text/javascript': ['.js'],
            'text/html': ['.html', '.htm'],
            'text/css': ['.css'],
            'application/json': ['.json'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-powerpoint': ['.ppt'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
            // プログラミング言語ファイル
            'text/x-python': ['.py', '.pyw'],
            'text/x-c': ['.c', '.h'],
            'text/x-cpp': ['.cpp', '.hpp', '.cc', '.hh'],
            'text/x-java': ['.java'],
            'text/x-csharp': ['.cs'],
            'text/x-ruby': ['.rb'],
            'text/x-php': ['.php'],
            'text/x-typescript': ['.ts', '.tsx']
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
            API_TYPE: 'apiType',
            AZURE_ENDPOINT_PREFIX: 'azureEndpoint_',
            SYSTEM_PROMPT: 'systemPrompt',
            SYSTEM_PROMPT_TEMPLATES: 'systemPromptTemplates',
            CATEGORY_STATES: 'categoryStates',
            CONVERSATIONS: 'conversations',
            CURRENT_CONVERSATION_ID: 'currentConversationId',
            ATTACHMENTS_PREFIX: 'attachments_'
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
                    'シーケンス図作成': 'あなたはコードを解析して正確なMermaid形式のシーケンス図を作成するエキスパートです。提供されたコードを慎重に分析し、処理の流れや通信、関数呼び出しなどの相互作用を把握してください。作成するシーケンス図では：\n1. 関連するすべてのクラス、オブジェクト、モジュール間の相互作用を表現する\n2. メソッド呼び出し、イベント、メッセージのやり取りを時系列で正確に表示する\n3. 非同期処理、条件分岐、ループがある場合は適切に表現する\n4. 図の複雑さとわかりやすさのバランスを取る\n5. 必要に応じて説明的な日本語のNoteをシーケンス内に追加する\n6. activate, deactiveateを適切に記述する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。図の構成要素や判断根拠について詳細に説明することで、シーケンス図の理解を深める手助けをしてください。',
                    'フローチャート作成': 'あなたはコードを解析して正確なMermaid形式のフローチャート図を作成するエキスパートです。提供されたコードを詳細に分析し、処理の流れ、分岐、繰り返し、条件判断などを視覚的に表現してください。作成するフローチャートでは：\n1. プログラムの実行フローを論理的かつ明確に表現する\n2. if文、switch文などの条件分岐を適切に視覚化する\n3. ループ構造（for、while、do-whileなど）を明示的に表現する\n4. 開始点と終了点を明確にする\n5. サブルーチンやメソッド呼び出しを適切に表現する\n6. 複雑なロジックは適切なレベルで抽象化する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。フローチャートの各要素がコードのどの部分に対応するかを説明し、処理の流れの理解を助けてください。',
                    'クラス図作成': 'あなたはコードを解析して正確なMermaid形式のクラス図を作成するエキスパートです。提供されたコードを詳細に分析し、クラス構造、継承関係、関連性などを視覚的に表現してください。作成するクラス図では：\n1. すべての重要なクラス、インターフェース、抽象クラスを表示する\n2. 各クラスのプロパティ（フィールド）とメソッドを適切に表示する\n3. 継承関係、実装関係を矢印で正確に表現する\n4. 関連性（集約、コンポジション、依存性など）を適切な記号で表現する\n5. 多重度や関連の方向性を必要に応じて表示する\n6. パッケージやモジュールの構造を適切に表現する\n回答は```mermaid で始まり、``` で終わるコードブロックを含め、必要に応じて簡潔な説明を付け加えてください。クラス図の各要素や関連性について説明し、コード構造の理解を深める手助けをしてください。',
                    'DrawIO図作成': `あなたはdraw.ioの図を生成するエキスパートです。提供された要件やコードを分析し、draw.ioで使用できる正確なXML形式の図を作成してください。\n\n要件：\n1. 図の要素を適切に配置し、視覚的に分かりやすい構成にする\n2. 要素間の関係性を明確な接続線で表現する\n3. 適切な色使い、フォントサイズ、線のスタイルを設定する\n4. 必要に応じて階層構造やグループ化を使用する\n5. プロフェッショナルで見やすい外観を維持する\n\n出力形式：\n1. 図の概要説明\n2. \`\`\`xml から始まり \`\`\` で終わるXMLコードブロック内に、以下の要素を含むXMLを出力：\n   - mxGraphModel要素とそのスタイル属性\n   - root要素とcell要素の適切な構造\n   - 図形、テキスト、接続線などの要素定義\n   - 位置、サイズ、スタイル、色などの視覚的属性\n3. 図のインポート手順：\n   - draw.ioを開く\n   - [配置] > [XMLからインポート] を選択\n   - 提供されたXMLをペースト\n4. 図の主要な要素や構造についての補足説明\n\nXMLには適切なスタイリング属性（colors、fonts、strokeWidth など）を含め、再現性の高い図を生成します。`
                }
            },
            
            // カテゴリの表示順序
            CATEGORY_ORDER: ['基本', '図表作成']
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
    }
};