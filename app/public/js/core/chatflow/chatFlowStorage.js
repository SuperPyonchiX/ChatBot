/**
 * ChatFlowStorage - チャットフロー定義の永続化
 * @description チャットフロー定義のインポート/エクスポート機能
 */
class ChatFlowStorage {
    static #instance = null;

    constructor() {
        if (ChatFlowStorage.#instance) {
            return ChatFlowStorage.#instance;
        }
        ChatFlowStorage.#instance = this;
    }

    static get getInstance() {
        if (!ChatFlowStorage.#instance) {
            ChatFlowStorage.#instance = new ChatFlowStorage();
        }
        return ChatFlowStorage.#instance;
    }

    /**
     * チャットフローをエクスポート
     * @param {string} flowId
     * @returns {string} JSON文字列
     */
    exportFlow(flowId) {
        const flow = ChatFlowEngine.getInstance.getChatFlow(flowId);
        if (!flow) {
            throw new Error(`チャットフローが見つかりません: ${flowId}`);
        }

        const exportData = {
            version: '1.0',
            type: 'chatflow',
            exportedAt: new Date().toISOString(),
            flow: {
                ...flow,
                id: undefined // IDは再インポート時に新しく生成
            }
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 全チャットフローをエクスポート
     * @returns {string} JSON文字列
     */
    exportAllFlows() {
        const flows = ChatFlowEngine.getInstance.getAllChatFlows();

        const exportData = {
            version: '1.0',
            type: 'chatflow-collection',
            exportedAt: new Date().toISOString(),
            flows: flows.map(flow => ({
                ...flow,
                id: undefined
            }))
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * チャットフローをインポート
     * @param {string} jsonString
     * @returns {Promise<Object>} インポートされたフロー
     */
    async importFlow(jsonString) {
        const data = JSON.parse(jsonString);

        if (data.type !== 'chatflow' && data.type !== 'chatflow-collection') {
            throw new Error('無効なチャットフローデータです');
        }

        if (data.type === 'chatflow') {
            return await this.#importSingleFlow(data.flow);
        } else {
            const imported = [];
            for (const flow of data.flows) {
                const result = await this.#importSingleFlow(flow);
                imported.push(result);
            }
            return imported;
        }
    }

    /**
     * 単一フローをインポート
     * @param {Object} flowData
     * @returns {Promise<Object>}
     */
    async #importSingleFlow(flowData) {
        const flow = {
            ...flowData,
            id: `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            importedAt: Date.now()
        };

        return await ChatFlowEngine.getInstance.registerChatFlow(flow);
    }

    /**
     * ファイルからインポート
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const result = await this.importFlow(e.target.result);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * ファイルとしてダウンロード
     * @param {string} flowId
     * @param {string} [filename]
     */
    downloadFlow(flowId, filename) {
        const flow = ChatFlowEngine.getInstance.getChatFlow(flowId);
        if (!flow) {
            throw new Error(`チャットフローが見つかりません: ${flowId}`);
        }

        const json = this.exportFlow(flowId);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `chatflow-${flow.name || flowId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 全フローをダウンロード
     */
    downloadAllFlows() {
        const json = this.exportAllFlows();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `chatflows-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// グローバルに公開
window.ChatFlowStorage = ChatFlowStorage;
