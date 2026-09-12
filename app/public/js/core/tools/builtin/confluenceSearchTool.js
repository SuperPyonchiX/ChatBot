/** Read-only enterprise tool. */
class ConfluenceSearchTool {
    static #instance = null;
    name = 'confluence_search';
    description = 'Confluence内をキーワード検索します。社内ページの検索には公開Web検索ではなくこのツールを使ってください。 設定した接続先にアクセスし、結果を選択中のAIへ返します。取得失敗時に公開Web検索へ切り替えないでください。';
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
        "start": {
            "type": "number",
            "description": "続きの検索開始位置。前の結果のnextStartを指定。"
        }
    },
    "required": [
        "query"
    ]
};
    constructor() { if (ConfluenceSearchTool.#instance) return ConfluenceSearchTool.#instance; ConfluenceSearchTool.#instance = this; }
    static get getInstance() { return ConfluenceSearchTool.#instance || new ConfluenceSearchTool(); }
    /** @param {Object} params @returns {Promise<Object>} @throws {Error} None (errors returned). */
    async execute(params) { return EnterpriseClient.getInstance.execute('confluence', 'search', params); }
}
window.ConfluenceSearchTool = ConfluenceSearchTool;
