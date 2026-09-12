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
 * @property {string} [azureResponsesEndpoint] - Azure Responses API共通URL
 * @property {Object.<string, string>} [azureDeployments] - モデル別デプロイ名
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
     * アーティファクト機能の設定
     */
    ARTIFACT: {
        // 対応するファイルタイプ
        SUPPORTED_TYPES: ['html', 'svg', 'markdown', 'mermaid', 'drawio'],
        // パネルのデフォルト幅
        PANEL_DEFAULT_WIDTH: '50%',
        // 自動プレビューを有効にするか
        AUTO_PREVIEW: true
    },

    /**
     * APIリクエストの設定
     */
    AIAPI: {
        // リトライ設定
        RETRY: {
            // 最大リトライ回数
            MAX_RETRIES: 3,
            // 基本遅延時間（ミリ秒）
            BASE_DELAY: 1000,
            // リトライ対象のHTTPステータスコード
            RETRYABLE_STATUS_CODES: [429, 500, 502, 503, 504]
        },

        // リトライ回数（後方互換性のため残す）
        MAX_RETRIES: 3,

        // タイムアウト時間（ミリ秒）
        TIMEOUT_MS: 60000,

        // リクエストタイムアウト（ミリ秒）
        REQUEST_TIMEOUT: 60000,

        // ストリーミングタイムアウト（ミリ秒）
        STREAM_TIMEOUT: 120000,

        // Azure OpenAI API バージョン
        AZURE_API_VERSION: '2023-05-15',
        AZURE_RESPONSES_ENDPOINT_PLACEHOLDER: 'https://your-resource.openai.azure.com/openai/responses?api-version=2025-04-01-preview',

        // Azure エンドポイント入力欄のプレースホルダー
        AZURE_ENDPOINT_PLACEHOLDER: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-05-15',

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
            CLAUDE: '/anthropic/v1/messages',
            // Azureの転送先URLはユーザー設定から生成し、このプロキシに渡す
            AZURE_PROXY: '/azure-openai'
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
            AZURE_RESPONSES_ENDPOINT: 'azureResponsesEndpoint',
            AZURE_DEPLOYMENTS: 'azureDeployments',
            SYSTEM_PROMPT: 'systemPrompt',
            CATEGORY_STATES: 'categoryStates',
            CONVERSATIONS: 'conversations',
            CURRENT_CONVERSATION_ID: 'currentConversationId',
            ATTACHMENTS_PREFIX: 'attachments_',
            WEB_SEARCH_ENABLED: 'webSearchEnabled',
            CODEX_ENABLED: 'codexEnabled',
            TOOL_SETTINGS: 'tool_settings',
            // 埋め込みAPI設定
            // Confluence Data Center設定
            CONFLUENCE_BASE_URL: 'confluenceBaseUrl',
            CONFLUENCE_AUTH_TYPE: 'confluenceAuthType',
            CONFLUENCE_AUTH_DATA: 'confluenceAuthData',
            JIRA_BASE_URL: 'jiraBaseUrl',
            JIRA_AUTH_TYPE: 'jiraAuthType',
            JIRA_AUTH_DATA: 'jiraAuthData'
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

    },

    /**
     * モデル関連の設定
     */
    MODELS: {
        // 既定で選択されるモデル
        DEFAULT: 'gpt-5.6-luna',

        // サポートされているモデル
        OPENAI: ['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5', 'gpt-5.4-mini'],
        GEMINI: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
        CLAUDE: [
            'claude-fable-5-1',
            'claude-opus-5',
            'claude-sonnet-5',
            'claude-haiku-4-5'
        ],

        // OpenAI Responses APIでのWeb検索をサポートするモデル
        OPENAI_WEB_SEARCH_COMPATIBLE: ['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5', 'gpt-5.4-mini'],
        
        // モデルの表示名マッピング
        DISPLAY_NAMES: {
            // OpenAI
            'gpt-5.6-luna': 'GPT-5.6 Luna',
            'gpt-5.6-sol': 'GPT-5.6 Sol',
            'gpt-5.6-terra': 'GPT-5.6 Terra',
            'gpt-5.5': 'GPT-5.5',
            'gpt-5.4-mini': 'GPT-5.4 Mini',

            // Gemini
            'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
            'gemini-2.5-pro': 'Gemini 2.5 Pro',
            'gemini-2.5-flash': 'Gemini 2.5 Flash',

            // Claude
            'claude-fable-5-1': 'Claude Fable 5.1',
            'claude-opus-5': 'Claude Opus 5',
            'claude-sonnet-5': 'Claude Sonnet 5',
            'claude-haiku-4-5': 'Claude Haiku 4.5'
        }
    },

    /**
     * UI関連の設定
     */
    UI: {
        // パフォーマンス警告の閾値（ミリ秒）
        PERFORMANCE_WARNING_THRESHOLD: 50,

        // モバイル表示のブレークポイント（ピクセル）
        // layouts/layout.css のドロワー切替と同じ値にすること
        MOBILE_BREAKPOINT: 768,

        // テキストエリアの最大高さ比率（画面の高さに対する割合）
        TEXTAREA_MAX_HEIGHT_RATIO: 0.4,

        // ストリーミング中の待機表示
        STREAMING: {
            RING_SIZE_PX: 18,
            RING_DURATION_MS: 1600,
            SHIMMER_DURATION_MS: 2400,
            EXIT_DURATION_MS: 160,
            FADE_DURATION_MS: 180,
            ENTER_DISTANCE_PX: 4,
            SCROLL_THRESHOLD_PX: 50,
            // 経過時間を表示し始めるしきい値（ミリ秒）。短い応答でちらつかせない
            ELAPSED_MIN_MS: 3000,

            // 新しく届いたテキストをフェードインさせるか
            WORD_FADE_ENABLED: true,

            // 一度にフェード対象とする最大文字数（大きなチャンクが来たときの保険）
            MAX_FADE_CHARS: 120,

            // 通常待機と、実際の処理に対応するラベル
            LABELS: {
                WAITING: '応答を準備中',
                WEB_SEARCH: 'ウェブを検索しています',
                WEB_SEARCH_ANALYZE: '検索結果を読んでいます',
                TOOL_RUNNING: '{name}を実行しています',
                RAG: 'ナレッジベースを参照しています'
            }
        },

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
     * ツール機能の設定（モデルが自分で呼ぶ Function Calling ツール）
     */
    TOOLS: {
        // 1 回の送信でツール呼び出し → 結果返却 → 再生成を繰り返す最大往復数
        MAX_ROUNDS: 8,

        // モデルに返すツール結果の最大文字数（超えた分は切り詰める）
        RESULT_MAX_CHARS: 12000,

        // 初期状態で無効にしておくツール（ホスト OS に触るものは明示的に有効化してもらう）
        DEFAULT_DISABLED: ['codex_task', 'file_write', 'shell_execute'],

        // UI に出すツールの表示名
        DISPLAY_NAMES: {
            generate_powerpoint: 'PowerPointスライド生成',
            process_excel: 'Excel処理',
            render_canvas: 'Canvas描画',
            web_search: 'Web検索',
            url_fetch: 'URL取得',
            jira_search: 'Jira検索',
            jira_get_issue: 'Jira課題取得',
            confluence_search: 'Confluence検索',
            confluence_get_page: 'Confluenceページ取得',
            calculator: '計算',
            code_execute: 'コード実行',
            codex_task: 'Codex サブエージェント',
            file_write: 'ファイル書き込み',
            shell_execute: 'コマンド実行'
        },

        // ツール設定モーダルでの分類
        CATEGORIES: {
            generate_powerpoint: 'generate',
            process_excel: 'generate',
            render_canvas: 'generate',
            web_search: 'info',
            url_fetch: 'info',
            jira_search: 'info',
            jira_get_issue: 'info',
            confluence_search: 'info',
            confluence_get_page: 'info',
            calculator: 'exec',
            code_execute: 'exec',
            codex_task: 'workspace',
            file_write: 'workspace',
            shell_execute: 'workspace'
        },
        CATEGORY_LABELS: {
            generate: 'ファイル生成',
            info: '情報取得',
            exec: '計算・実行',
            workspace: 'ワークスペース操作（ホスト OS に触る）',
            custom: 'カスタムツール',
            other: 'その他'
        },

        // カスタムツール（ユーザー定義の JavaScript ツール）
        CUSTOM: {
            ENABLED: true,
            MAX_TOOLS: 50,
            STORAGE_KEY: 'agent_custom_tools',
            DB_NAME: 'AgentCustomToolsDB',
            DB_STORE: 'tools',
            SANDBOX_TIMEOUT: 5000,
            ALLOWED_APIS: ['fetch', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'console']
        },

        // ツール対応モデル
        COMPATIBLE_MODELS: {
            CLAUDE: ['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
            OPENAI: ['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5', 'gpt-5.4-mini'],
            GEMINI: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash']
        },

        // PowerPoint設定
        POWERPOINT: {
            MAX_SLIDES: 50,
            DEFAULT_THEME: 'default',
            THEMES: ['default', 'dark', 'corporate', 'minimal']
        },

        // Excel設定
        EXCEL: {
            MAX_ROWS: 10000,
            MAX_COLUMNS: 100
        },

        // Canvas設定
        CANVAS: {
            MAX_WIDTH: 4096,
            MAX_HEIGHT: 4096,
            DEFAULT_FORMAT: 'png'
        }
    },

    /**
     * ファイルストレージ関連の設定（ツール生成ファイルの永続化）
     */
    FILE_STORAGE: {
        // IndexedDBデータベース名
        DB_NAME: 'ChatBotFileStorage',
        // ストア名
        STORE_NAME: 'generatedFiles',
        // 保持日数（7日経過したファイルは自動削除）
        RETENTION_DAYS: 7,
        // 最大合計サイズ（500MB）
        MAX_TOTAL_SIZE: 500 * 1024 * 1024,
        // DBバージョン
        DB_VERSION: 1
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
     * Draw.io図解設定
     */
    DRAWIO: {
        // Draw.io埋め込みURL
        EMBED_URL: 'https://embed.diagrams.net/',
        // iframeパラメータ
        PARAMS: {
            embed: 1,
            spin: 1,
            proto: 'json',
            configure: 1
        }
    },

    /**
     * Codex CLI 連携設定
     * サーバーで OpenAI Codex CLI（codex exec --json）を子プロセス起動し、
     * サーバー側ワークスペース（app/workspace）でファイル作成・コマンド実行を行う
     */
    CODEX: {
        // Codex 連携の有効/無効（無効にすると入力欄の Codex トグルを隠す）
        ENABLED: true,

        // サーバーエンドポイント（app/server/codexRoutes.js）
        ENDPOINTS: {
            RUN: '/api/codex/run',
            CANCEL: '/api/codex/cancel',
            WORKSPACE_FILES: '/api/workspace/files',
            WORKSPACE_FILE: '/api/workspace/file',
            WORKSPACE_EXEC: '/api/workspace/exec'
        },

        // サンドボックス ('read-only' | 'workspace-write' | 'danger-full-access')
        DEFAULT_SANDBOX: 'workspace-write',

        // Codex に渡すモデル（null なら CLI 側の既定）
        DEFAULT_MODEL: null,

        // `-c key=value` で渡す追加設定（Windows でサンドボックスが効かない場合などに使う）
        EXTRA_CONFIG: [],

        // codex_task ツールの並列上限（サーバー側 CODEX_MAX_PARALLEL と揃える）
        MAX_PARALLEL: 3,

        // 1 実行のタイムアウト（ミリ秒）
        TIMEOUT_MS: 600000,

        // ワークスペース関連
        WORKSPACE: {
            // shell_execute のタイムアウト（ミリ秒）
            EXEC_TIMEOUT_MS: 60000,
            // プレビューで表示する最大バイト数
            MAX_FILE_PREVIEW: 1048576,
            // Codex 完了時にワークスペース一覧を自動更新するか
            REFRESH_ON_COMPLETE: true
        },

        // UI
        UI: {
            // item.type ごとのアイコン
            ITEM_ICONS: {
                reasoning: '💭',
                command_execution: '⌨️',
                file_change: '📝',
                agent_message: '🤖',
                mcp_tool_call: '🔌',
                error: '❌'
            },
            // コマンド出力の表示上限（行）
            MAX_OUTPUT_LINES: 200,
            // 履歴復元カードを折りたたんだ状態で出すか
            RESTORED_COLLAPSED: true
        }
    }
};

// エンドポイントの検証（開発用）
(function() {
    if (typeof window !== 'undefined' && window.location) {
        if (window.location.protocol === 'file:') {
            console.warn('⚠️ ファイルプロトコルで開かれています。');
            console.warn('💡 推奨: npm start でサーバー経由で起動してください');
        }
    }
})();
