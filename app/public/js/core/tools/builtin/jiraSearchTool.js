/** Read-only enterprise tool. */
class JiraSearchTool {
    static #instance = null;
    name = 'jira_search';
    description = 'Jira内をキーワード検索します。社内課題の検索には公開Web検索ではなくこのツールを使ってください。 設定した接続先にアクセスし、結果を選択中のAIへ返します。取得失敗時に公開Web検索へ切り替えないでください。';
    parameters = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "検索キーワード（JQL/CQL構文ではなく自然文の語句）"
        },
        "scope": {
            "type": "string",
            "description": "任意のプロジェクトキーまたはスペースキー"
        },
        "jql": {
            "type": "string",
            "description": "ConfluenceのJiraマクロから取得したJQLなど。queryの代わりに指定可能。読み取り検索のみ。"
        },
        "start": {
            "type": "number",
            "description": "続きの検索開始位置。前の結果のnextStartを指定。"
        }
    }
};
    constructor() { if (JiraSearchTool.#instance) return JiraSearchTool.#instance; JiraSearchTool.#instance = this; }
    static get getInstance() { return JiraSearchTool.#instance || new JiraSearchTool(); }
    /** @param {Object} params @returns {Promise<Object>} @throws {Error} None (errors returned). */
    async execute(params) { return EnterpriseClient.getInstance.execute('jira', 'search', params); }
}
window.JiraSearchTool = JiraSearchTool;
