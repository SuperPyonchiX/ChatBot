/**
 * グローバル型定義ファイル
 * このファイルはプロジェクト全体で使用されるグローバル変数とライブラリの型定義を提供します
 */

// ========================================
// グローバルライブラリの型定義
// ========================================

/**
 * Prism.js - シンタックスハイライトライブラリ
 */
declare const Prism: {
    highlightAll(): void;
    highlightElement(element: Element): void;
    highlightAllUnder(element: Element): void;
    languages: Record<string, any>;
    plugins: Record<string, any>;
};

/**
 * Mermaid.js - 図表レンダリングライブラリ
 */
declare const mermaid: {
    initialize(config: any): void;
    run(config?: any): Promise<void>;
    render(id: string, text: string): Promise<{ svg: string }>;
};

/**
 * marked.js - Markdownパーサー
 */
declare const marked: {
    parse(markdown: string, options?: any): string;
    setOptions(options: any): void;
};

// ========================================
// アプリケーショングローバル状態
// ========================================

/**
 * アプリケーション全体の状態管理
 */
interface AppState {
    /** 会話リスト */
    conversations: Conversation[];
    /** 現在の会話ID */
    currentConversationId: string | null;
    /** システムプロンプトテンプレート */
    systemPromptTemplates: Record<string, SystemPromptTemplate>;
    /** ユーザープロンプト */
    userPrompts: UserPrompt[];
    /** 現在の添付ファイル */
    currentAttachments: any[];
    /** API設定 */
    apiSettings: any;
    /** システムプロンプト */
    systemPrompt: string;
    /** 会話をIDで取得 */
    getConversationById(id: string): Conversation | undefined;
    /** 現在のモデルを取得 */
    getCurrentModel(): string;
}

/**
 * 会話データ構造
 */
interface Conversation {
    /** 会話の一意ID */
    id: string;
    /** 会話のタイトル */
    title: string;
    /** 使用モデル */
    model: string;
    /** 作成/更新タイムスタンプ */
    timestamp: number;
    /** メッセージリスト */
    messages: Message[];
    /** システムプロンプトキー（オプション） */
    systemPromptKey?: string;
}

/**
 * メッセージデータ構造
 */
interface Message {
    /** メッセージの役割 */
    role: 'system' | 'user' | 'assistant';
    /** メッセージ内容（文字列または配列） */
    content: string | ContentPart[];
    /** タイムスタンプ（オプション） */
    timestamp?: number;
}

/**
 * コンテンツパート（マルチモーダル対応）
 */
interface ContentPart {
    /** コンテンツタイプ */
    type: 'text' | 'image_url';
    /** テキスト内容 */
    text?: string;
    /** 画像URL */
    image_url?: {
        url: string;
    };
}

/**
 * システムプロンプトテンプレート
 */
interface SystemPromptTemplate {
    /** テンプレート名 */
    name: string;
    /** プロンプト内容 */
    content: string;
    /** 説明（オプション） */
    description?: string;
}

/**
 * ユーザープロンプト
 */
interface UserPrompt {
    /** プロンプトID */
    id: string;
    /** プロンプトタイトル */
    title: string;
    /** プロンプト内容 */
    content: string;
    /** 作成タイムスタンプ */
    timestamp: number;
}

/**
 * Window インターフェースの拡張
 */
interface Window {
    /** アプリケーション状態 */
    AppState: AppState;
    /** 設定オブジェクト */
    CONFIG: any;
    /** DOM要素キャッシュ */
    Elements: any;
}

// ========================================
// シングルトンクラスの型定義
// ========================================

/**
 * AppStorage クラス（ブラウザ組み込みStorageとの競合を避けるため）
 * 実際のクラス名はStorageだが、型定義ではAppStorageとして定義
 */
interface AppStorage {
    loadConversations(): Conversation[];
    saveConversations(): void;
    saveConversations(conversations: Conversation[]): void;
    loadApiSettings(): any;
    saveApiSettings(settings: any): void;
    loadCategoryStates(): Record<string, boolean>;
    saveCategoryState(category: string, isExpanded: boolean): void;
    saveCurrentConversationId(id: string): void;
    loadCurrentConversationId(): string | null;
}

interface AppStorageConstructor {
    new (): AppStorage;
    readonly getInstance: AppStorage;
    _instance: AppStorage | undefined;
}

// Storageをグローバル変数として再宣言（ブラウザ組み込みを上書き）
declare var Storage: AppStorageConstructor;

/**
 * Markdown クラスのシングルトンパターン
 */
interface AppMarkdown {
    renderMarkdown(content: string): Promise<string> | string;
}

interface AppMarkdownConstructor {
    new (): AppMarkdown;
    readonly getInstance: AppMarkdown;
}

declare const Markdown: AppMarkdownConstructor;

/**
 * ChatRenderer クラスのシングルトンパターン
 */
interface AppChatRenderer {
    addUserMessage(content: string, container: HTMLElement, attachments: any[], timestamp?: number): Promise<void>;
    addBotMessage(content: string, container: HTMLElement, timestamp?: number, isStreaming?: boolean): Promise<void>;
}

interface AppChatRendererConstructor {
    new (): AppChatRenderer;
    readonly getInstance: AppChatRenderer;
}

declare const ChatRenderer: AppChatRendererConstructor;

/**
 * ChatUI クラスのシングルトンパターン
 */
interface AppChatUI {
    createElement(tag: string, options?: any): HTMLElement;
}

interface AppChatUIConstructor {
    new (): AppChatUI;
    readonly getInstance: AppChatUI;
}

declare const ChatUI: AppChatUIConstructor;

/**
 * FileAttachment クラスのシングルトンパターン
 */
interface AppFileAttachment {
    displaySavedAttachments(conversationId: string, container: HTMLElement): void;
}

interface AppFileAttachmentConstructor {
    new (): AppFileAttachment;
    readonly getInstance: AppFileAttachment;
}

declare const FileAttachment: AppFileAttachmentConstructor;

// ========================================
// DOM型の拡張（必要に応じて）
// ========================================

/**
 * Element インターフェースの拡張
 * dataset と style プロパティを追加
 */
interface Element {
    dataset: DOMStringMap;
    style: CSSStyleDeclaration;
}
