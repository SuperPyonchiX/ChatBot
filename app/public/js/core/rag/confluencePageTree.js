/**
 * confluencePageTree.js
 * Confluenceページのツリー構造を管理するクラス
 *
 * 遅延読み込み、選択状態管理を担当
 */

class ConfluencePageTree {
    static #instance = null;

    /** @type {Map<string, PageNode>} pageId -> PageNode のマップ */
    #nodes = new Map();

    /** @type {Set<string>} 選択されているページIDのセット */
    #selectedIds = new Set();

    /** @type {Set<string>} 展開されているページIDのセット */
    #expandedIds = new Set();

    /** @type {string|null} 現在のスペースキー */
    #currentSpaceKey = null;

    /** @type {string|null} 現在のスペース名 */
    #currentSpaceName = null;

    /** @type {string[]} ルートページIDの順序配列 */
    #rootPageIds = [];

    /**
     * シングルトンインスタンスを取得
     * @returns {ConfluencePageTree}
     */
    static get getInstance() {
        if (!ConfluencePageTree.#instance) {
            ConfluencePageTree.#instance = new ConfluencePageTree();
        }
        return ConfluencePageTree.#instance;
    }

    constructor() {
        if (ConfluencePageTree.#instance) {
            throw new Error('ConfluencePageTree is a singleton. Use ConfluencePageTree.getInstance');
        }
    }

    /**
     * スペースを初期化（ルートページを読み込み）
     * @param {string} spaceKey - スペースキー
     * @param {string} spaceName - スペース名
     */
    async initializeSpace(spaceKey, spaceName) {
        // 以前の状態をクリア
        this.reset();

        this.#currentSpaceKey = spaceKey;
        this.#currentSpaceName = spaceName;

        // ルートページを取得
        const rootPages = await ConfluenceDataSource.getInstance.getRootPages(spaceKey);

        for (const page of rootPages) {
            this.#nodes.set(page.id, {
                id: page.id,
                title: page.title,
                hasChildren: page.hasChildren,
                childrenLoaded: false,
                childIds: [],
                parentId: null
            });
            this.#rootPageIds.push(page.id);
        }

        console.log(`🌳 ツリー初期化: ${spaceKey} (${rootPages.length}ルートページ)`);
    }

    /**
     * ページを展開（子ページを遅延読み込み）
     * @param {string} pageId - 展開するページID
     */
    async expandPage(pageId) {
        const node = this.#nodes.get(pageId);
        if (!node) {
            console.warn(`ページ ${pageId} が見つかりません`);
            return;
        }

        // 既に展開済みの場合は何もしない
        if (this.#expandedIds.has(pageId)) {
            return;
        }

        // 子ページがまだ読み込まれていない場合は読み込む
        if (!node.childrenLoaded && node.hasChildren) {
            const childPages = await ConfluenceDataSource.getInstance.getChildPages(pageId);

            for (const child of childPages) {
                this.#nodes.set(child.id, {
                    id: child.id,
                    title: child.title,
                    hasChildren: child.hasChildren,
                    childrenLoaded: false,
                    childIds: [],
                    parentId: pageId
                });
                node.childIds.push(child.id);
            }

            node.childrenLoaded = true;
        }

        this.#expandedIds.add(pageId);
    }

    /**
     * ページを折りたたみ
     * @param {string} pageId - 折りたたむページID
     */
    collapsePage(pageId) {
        this.#expandedIds.delete(pageId);
    }

    /**
     * ページの展開状態を切り替え
     * @param {string} pageId
     * @returns {Promise<boolean>} 新しい展開状態
     */
    async toggleExpand(pageId) {
        if (this.#expandedIds.has(pageId)) {
            this.collapsePage(pageId);
            return false;
        } else {
            await this.expandPage(pageId);
            return true;
        }
    }

    /**
     * ページが展開されているかどうか
     * @param {string} pageId
     * @returns {boolean}
     */
    isExpanded(pageId) {
        return this.#expandedIds.has(pageId);
    }

    /**
     * ページの選択状態を設定
     * @param {string} pageId
     * @param {boolean} selected
     * @param {boolean} propagateToChildren - 子孫にも適用するか
     */
    setSelected(pageId, selected, propagateToChildren = true) {
        const node = this.#nodes.get(pageId);
        if (!node) return;

        if (selected) {
            this.#selectedIds.add(pageId);
        } else {
            this.#selectedIds.delete(pageId);
        }

        // 子孫ページにも適用
        if (propagateToChildren && node.childrenLoaded) {
            for (const childId of node.childIds) {
                this.setSelected(childId, selected, true);
            }
        }
    }

    /**
     * ページが選択されているかどうか
     * @param {string} pageId
     * @returns {boolean}
     */
    isSelected(pageId) {
        return this.#selectedIds.has(pageId);
    }

    /**
     * ページの部分選択状態を取得（子の一部のみ選択されている場合）
     * @param {string} pageId
     * @returns {'none' | 'partial' | 'all'}
     */
    getSelectionState(pageId) {
        const node = this.#nodes.get(pageId);
        if (!node) return 'none';

        // 子がない場合は自身の選択状態
        if (!node.hasChildren || !node.childrenLoaded || node.childIds.length === 0) {
            return this.#selectedIds.has(pageId) ? 'all' : 'none';
        }

        // 子の選択状態を集計
        let selectedCount = 0;
        let totalCount = 0;

        const countSelection = (nodeId) => {
            const n = this.#nodes.get(nodeId);
            if (!n) return;

            totalCount++;
            if (this.#selectedIds.has(nodeId)) {
                selectedCount++;
            }

            if (n.childrenLoaded) {
                for (const childId of n.childIds) {
                    countSelection(childId);
                }
            }
        };

        for (const childId of node.childIds) {
            countSelection(childId);
        }

        if (selectedCount === 0) {
            return 'none';
        } else if (selectedCount === totalCount) {
            return 'all';
        } else {
            return 'partial';
        }
    }

    /**
     * 選択されているページIDの配列を取得
     * @returns {string[]}
     */
    getSelectedPageIds() {
        return Array.from(this.#selectedIds);
    }

    /**
     * 選択されているページ数を取得
     * @returns {number}
     */
    getSelectedCount() {
        return this.#selectedIds.size;
    }

    /**
     * 全ページを選択
     */
    selectAll() {
        for (const [id] of this.#nodes) {
            this.#selectedIds.add(id);
        }
    }

    /**
     * 全ページの選択を解除
     */
    deselectAll() {
        this.#selectedIds.clear();
    }

    /**
     * ツリー構造を取得（UIレンダリング用）
     * @returns {Array<TreeNode>}
     */
    getTree() {
        const buildTree = (nodeId, level) => {
            const node = this.#nodes.get(nodeId);
            if (!node) return null;

            const treeNode = {
                id: node.id,
                title: node.title,
                hasChildren: node.hasChildren,
                childrenLoaded: node.childrenLoaded,
                isExpanded: this.#expandedIds.has(node.id),
                isSelected: this.#selectedIds.has(node.id),
                selectionState: this.getSelectionState(node.id),
                level: level,
                children: []
            };

            // 展開されている場合は子ノードも構築
            if (node.childrenLoaded && this.#expandedIds.has(node.id)) {
                for (const childId of node.childIds) {
                    const childTree = buildTree(childId, level + 1);
                    if (childTree) {
                        treeNode.children.push(childTree);
                    }
                }
            }

            return treeNode;
        };

        const tree = [];
        for (const rootId of this.#rootPageIds) {
            const rootTree = buildTree(rootId, 0);
            if (rootTree) {
                tree.push(rootTree);
            }
        }

        return tree;
    }

    /**
     * 選択されたページのコンテンツを取得
     * @param {function} [onProgress] - 進捗コールバック (current, total, pageTitle)
     * @returns {Promise<Array<{id: string, title: string, content: string, url: string, lastModified: string}>>}
     */
    async getSelectedPagesWithContent(onProgress) {
        const selectedIds = this.getSelectedPageIds();

        if (selectedIds.length === 0) {
            return [];
        }

        // ページコンテンツを取得
        const pages = await ConfluenceDataSource.getInstance.getPagesContent(selectedIds, onProgress);

        return pages;
    }

    /**
     * 現在のスペースキーを取得
     * @returns {string|null}
     */
    getCurrentSpaceKey() {
        return this.#currentSpaceKey;
    }

    /**
     * 現在のスペース名を取得
     * @returns {string|null}
     */
    getCurrentSpaceName() {
        return this.#currentSpaceName;
    }

    /**
     * ノード情報を取得
     * @param {string} pageId
     * @returns {PageNode|undefined}
     */
    getNode(pageId) {
        return this.#nodes.get(pageId);
    }

    /**
     * 状態をリセット
     */
    reset() {
        this.#nodes.clear();
        this.#selectedIds.clear();
        this.#expandedIds.clear();
        this.#currentSpaceKey = null;
        this.#currentSpaceName = null;
        this.#rootPageIds = [];
    }
}

/**
 * @typedef {Object} PageNode
 * @property {string} id - ページID
 * @property {string} title - ページタイトル
 * @property {boolean} hasChildren - 子ページがあるか
 * @property {boolean} childrenLoaded - 子ページが読み込み済みか
 * @property {string[]} childIds - 子ページIDの配列
 * @property {string|null} parentId - 親ページID
 */

/**
 * @typedef {Object} TreeNode
 * @property {string} id - ページID
 * @property {string} title - ページタイトル
 * @property {boolean} hasChildren - 子ページがあるか
 * @property {boolean} childrenLoaded - 子ページが読み込み済みか
 * @property {boolean} isExpanded - 展開されているか
 * @property {boolean} isSelected - 選択されているか
 * @property {'none' | 'partial' | 'all'} selectionState - 選択状態
 * @property {number} level - 階層レベル（0がルート）
 * @property {TreeNode[]} children - 子ノード配列
 */

// グローバルに公開
window.ConfluencePageTree = ConfluencePageTree;
