/**
 * config.js
 * アプリケーション全体で使用される設定値を管理します
 */

// グローバルスコープに設定オブジェクトを公開
window.CONFIG = {
    /**
     * APIリクエストの設定
     */
    API: {
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
            code: ['text/javascript', 'text/html', 'text/css', 'application/json']
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
            PROMPT_TEMPLATES: 'promptTemplates',
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
    PROMPTS: {
        // デフォルトのシステムプロンプト
        DEFAULT_SYSTEM_PROMPT: 'あなたは親切で誠実なAIアシスタントです。ユーザーの要求に対して、簡潔かつ有益な回答を提供してください。',
        
        // プロンプトテンプレート
        TEMPLATES: {
            'general': 'あなたは親切で誠実なAIアシスタントです。ユーザーの要求に対して、簡潔かつ有益な回答を提供してください。',
            'creative': 'あなたはクリエイティブで革新的なアイデアを提案できるAIアシスタントです。ユーザーの要望に対して、独創的で実現可能なソリューションを提供してください。',
            'technical': 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）'
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