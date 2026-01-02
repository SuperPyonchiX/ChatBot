/**
 * ArtifactManager
 * アーティファクトの登録・管理を行うクラス
 */
class ArtifactManager {
    static #instance = null;

    // アーティファクトのキャッシュ
    #artifacts = new Map();

    // 現在選択中のアーティファクトID
    #currentArtifactId = null;

    // イベントリスナー
    #listeners = {
        register: [],
        select: [],
        update: [],
        remove: []
    };

    constructor() {
        if (ArtifactManager.#instance) {
            return ArtifactManager.#instance;
        }
        ArtifactManager.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ArtifactManager.#instance) {
            ArtifactManager.#instance = new ArtifactManager();
        }
        return ArtifactManager.#instance;
    }

    /**
     * アーティファクトを登録
     * @param {Object} artifact - アーティファクトオブジェクト
     * @returns {string} アーティファクトID
     */
    registerArtifact(artifact) {
        if (!artifact || !artifact.id) {
            console.error('[ArtifactManager] Invalid artifact:', artifact);
            return null;
        }

        // アーティファクトを保存
        this.#artifacts.set(artifact.id, {
            ...artifact,
            registeredAt: Date.now()
        });

        // 現在のアーティファクトとして設定
        this.#currentArtifactId = artifact.id;

        // イベントを発火
        this.#emit('register', artifact);

        console.log(`[ArtifactManager] Registered artifact: ${artifact.id} (${artifact.type})`);

        return artifact.id;
    }

    /**
     * 現在のアーティファクトを取得
     * @returns {Object|null} 現在のアーティファクト
     */
    getCurrentArtifact() {
        if (!this.#currentArtifactId) {
            return null;
        }
        return this.#artifacts.get(this.#currentArtifactId) || null;
    }

    /**
     * IDでアーティファクトを取得
     * @param {string} id - アーティファクトID
     * @returns {Object|null} アーティファクト
     */
    getArtifact(id) {
        return this.#artifacts.get(id) || null;
    }

    /**
     * すべてのアーティファクトを取得
     * @returns {Array<Object>} アーティファクトの配列
     */
    getAllArtifacts() {
        return Array.from(this.#artifacts.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * アーティファクトを選択
     * @param {string} id - アーティファクトID
     * @returns {Object|null} 選択されたアーティファクト
     */
    selectArtifact(id) {
        const artifact = this.#artifacts.get(id);
        if (!artifact) {
            console.warn(`[ArtifactManager] Artifact not found: ${id}`);
            return null;
        }

        this.#currentArtifactId = id;

        // イベントを発火
        this.#emit('select', artifact);

        return artifact;
    }

    /**
     * アーティファクトを更新（編集後）
     * @param {string} id - アーティファクトID
     * @param {string} content - 新しいコンテンツ
     * @returns {Object|null} 更新されたアーティファクト
     */
    updateArtifact(id, content) {
        const artifact = this.#artifacts.get(id);
        if (!artifact) {
            console.warn(`[ArtifactManager] Artifact not found: ${id}`);
            return null;
        }

        // コンテンツを更新
        artifact.content = content;
        artifact.isEdited = true;
        artifact.updatedAt = Date.now();

        this.#artifacts.set(id, artifact);

        // イベントを発火
        this.#emit('update', artifact);

        return artifact;
    }

    /**
     * アーティファクトを削除
     * @param {string} id - アーティファクトID
     * @returns {boolean} 削除成功したかどうか
     */
    removeArtifact(id) {
        const artifact = this.#artifacts.get(id);
        if (!artifact) {
            return false;
        }

        this.#artifacts.delete(id);

        // 現在のアーティファクトが削除された場合
        if (this.#currentArtifactId === id) {
            // 最新のアーティファクトを選択
            const artifacts = this.getAllArtifacts();
            this.#currentArtifactId = artifacts.length > 0 ? artifacts[0].id : null;
        }

        // イベントを発火
        this.#emit('remove', artifact);

        return true;
    }

    /**
     * すべてのアーティファクトをクリア
     */
    clearAll() {
        this.#artifacts.clear();
        this.#currentArtifactId = null;
    }

    /**
     * アーティファクトをダウンロード
     * @param {string} id - アーティファクトID
     * @param {string} format - ダウンロード形式（オプション）
     */
    downloadArtifact(id, format = null) {
        const artifact = this.#artifacts.get(id);
        if (!artifact) {
            console.warn(`[ArtifactManager] Artifact not found: ${id}`);
            return;
        }

        const extension = this.#getFileExtension(artifact.type, format);
        const filename = `${artifact.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_')}.${extension}`;
        const mimeType = this.#getMimeType(artifact.type);

        // Blobを作成
        const blob = new Blob([artifact.content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // ダウンロードリンクを作成
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // URLを解放
        setTimeout(() => URL.revokeObjectURL(url), 100);

        console.log(`[ArtifactManager] Downloaded artifact: ${filename}`);
    }

    /**
     * ファイル拡張子を取得
     * @param {string} type - アーティファクトタイプ
     * @param {string} format - 指定された形式
     * @returns {string} ファイル拡張子
     */
    #getFileExtension(type, format) {
        if (format) return format;

        const extensions = {
            'html': 'html',
            'svg': 'svg',
            'markdown': 'md',
            'mermaid': 'mmd'
        };

        return extensions[type] || 'txt';
    }

    /**
     * MIMEタイプを取得
     * @param {string} type - アーティファクトタイプ
     * @returns {string} MIMEタイプ
     */
    #getMimeType(type) {
        const mimeTypes = {
            'html': 'text/html',
            'svg': 'image/svg+xml',
            'markdown': 'text/markdown',
            'mermaid': 'text/plain'
        };

        return mimeTypes[type] || 'text/plain';
    }

    /**
     * イベントリスナーを追加
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event].push(callback);
        }
    }

    /**
     * イベントリスナーを削除
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * イベントを発火
     * @param {string} event - イベント名
     * @param {Object} data - イベントデータ
     */
    #emit(event, data) {
        if (this.#listeners[event]) {
            this.#listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[ArtifactManager] Error in event listener:`, error);
                }
            });
        }
    }

    /**
     * アーティファクトの数を取得
     * @returns {number} アーティファクトの数
     */
    get count() {
        return this.#artifacts.size;
    }

    /**
     * 現在のアーティファクトIDを取得
     * @returns {string|null} 現在のアーティファクトID
     */
    get currentId() {
        return this.#currentArtifactId;
    }
}
