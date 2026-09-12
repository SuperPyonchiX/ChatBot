/** Read-only enterprise tool. */
class JiraGetIssueTool {
    static #instance = null;
    name = 'jira_get_issue';
    description = 'Jira課題の本文・状態・コメント・関連課題を読み取ります。 設定した接続先にアクセスし、結果を選択中のAIへ返します。取得失敗時に公開Web検索へ切り替えないでください。';
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
    constructor() { if (JiraGetIssueTool.#instance) return JiraGetIssueTool.#instance; JiraGetIssueTool.#instance = this; }
    static get getInstance() { return JiraGetIssueTool.#instance || new JiraGetIssueTool(); }
    /** @param {Object} params @returns {Promise<Object>} @throws {Error} None (errors returned). */
    async execute(params) { return EnterpriseClient.getInstance.execute('jira', 'get', params); }
}
window.JiraGetIssueTool = JiraGetIssueTool;
