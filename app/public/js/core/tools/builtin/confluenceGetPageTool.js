/** Read-only enterprise tool. */
class ConfluenceGetPageTool {
    static #instance = null;
    name = 'confluence_get_page';
    description = 'Confluenceページの本文・コメント・Jira参照を読み取ります。関連課題はjira_get_issueで取得してください。 設定した接続先にアクセスし、結果を選択中のAIへ返します。取得失敗時に公開Web検索へ切り替えないでください。';
    parameters = {
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "description": "課題キーまたはページID"
        },
        "url": {
            "type": "string",
            "description": "登録済み接続先の課題URLまたはpageId付きページURL（idの代わりに指定可）"
        }
    }
};
    constructor() { if (ConfluenceGetPageTool.#instance) return ConfluenceGetPageTool.#instance; ConfluenceGetPageTool.#instance = this; }
    static get getInstance() { return ConfluenceGetPageTool.#instance || new ConfluenceGetPageTool(); }
    /** @param {Object} params @returns {Promise<Object>} @throws {Error} None (errors returned). */
    async execute(params) { return EnterpriseClient.getInstance.execute('confluence', 'get', params); }
}
window.ConfluenceGetPageTool = ConfluenceGetPageTool;
