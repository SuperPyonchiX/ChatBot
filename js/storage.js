/**
 * storage.js
 * ローカルストレージの読み書き機能を提供します
 */

// グローバルスコープに関数を公開
window.Storage = {
    // サイドバーの状態を保存
    saveSidebarState: function(isCollapsed) {
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    },

    // サイドバーの状態を読み込む
    loadSidebarState: function() {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    },

    // APIキー設定を読み込む
    loadApiSettings: function() {
        return {
            openaiApiKey: localStorage.getItem('openaiApiKey') || '',
            azureApiKey: localStorage.getItem('azureApiKey') || '',
            apiType: localStorage.getItem('apiType') || 'openai',
            azureEndpoints: {
                'gpt-4o-mini': localStorage.getItem('azureEndpoint_gpt-4o-mini') || '',
                'gpt-4o': localStorage.getItem('azureEndpoint_gpt-4o') || '',
                'o1-mini': localStorage.getItem('azureEndpoint_o1-mini') || '',
                'o1': localStorage.getItem('azureEndpoint_o1') || ''
            }
        };
    },

    // API設定を保存
    saveApiSettings: function(apiSettings) {
        localStorage.setItem('openaiApiKey', apiSettings.openaiApiKey || '');
        localStorage.setItem('azureApiKey', apiSettings.azureApiKey || '');
        localStorage.setItem('apiType', apiSettings.apiType || 'openai');
        localStorage.setItem('azureEndpoint_gpt-4o-mini', apiSettings.azureEndpoints['gpt-4o-mini'] || '');
        localStorage.setItem('azureEndpoint_gpt-4o', apiSettings.azureEndpoints['gpt-4o'] || '');
        localStorage.setItem('azureEndpoint_o1-mini', apiSettings.azureEndpoints['o1-mini'] || '');
        localStorage.setItem('azureEndpoint_o1', apiSettings.azureEndpoints['o1'] || '');
    },

    // システムプロンプトを読み込む
    loadSystemPrompt: function() {
        return localStorage.getItem('systemPrompt') || 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）';
    },

    // システムプロンプトを保存
    saveSystemPrompt: function(systemPrompt) {
        localStorage.setItem('systemPrompt', systemPrompt);
    },

    // プロンプトテンプレートを読み込む
    loadPromptTemplates: function() {
        const savedTemplates = localStorage.getItem('promptTemplates');
        return savedTemplates ? JSON.parse(savedTemplates) : {
            'default': 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）',
            'creative': 'あなたはクリエイティブで革新的なアイデアを提案できるAIアシスタントです。ユーザーの要望に対して、独創的で実現可能なソリューションを提供してください。',
            'technical': 'あなたは技術的な専門知識を持つエキスパートエンジニアです。コードの品質、セキュリティ、パフォーマンスを重視し、ベストプラクティスに基づいたアドバイスを提供してください。'
        };
    },

    // プロンプトテンプレートを保存
    savePromptTemplates: function(promptTemplates) {
        localStorage.setItem('promptTemplates', JSON.stringify(promptTemplates));
    },

    // 会話履歴をローカルストレージから読み込む
    loadConversations: function() {
        const savedConversations = localStorage.getItem('conversations');
        return savedConversations ? JSON.parse(savedConversations) : [];
    },

    // 会話履歴をローカルストレージに保存
    saveConversations: function(conversations) {
        localStorage.setItem('conversations', JSON.stringify(conversations));
    },

    // 現在の会話IDをローカルストレージから読み込む
    loadCurrentConversationId: function() {
        return localStorage.getItem('currentConversationId');
    },

    // 現在の会話IDをローカルストレージに保存
    saveCurrentConversationId: function(currentConversationId) {
        localStorage.setItem('currentConversationId', currentConversationId);
    }
};