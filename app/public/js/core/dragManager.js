/**
 * dragManager.js
 * モーダルのドラッグ移動機能を管理するクラス
 */

class DragManager {
    static #instance = null;

    /** @type {HTMLElement|null} 現在ドラッグ中のモーダル */
    #activeModal = null;

    /** @type {number} ドラッグ開始時のオフセットX */
    #offsetX = 0;

    /** @type {number} ドラッグ開始時のオフセットY */
    #offsetY = 0;

    /** @type {boolean} ドラッグ中フラグ */
    #isDragging = false;

    /** @type {Set<HTMLElement>} ドラッグ有効化済みモーダル */
    #enabledModals = new Set();

    /**
     * シングルトンインスタンスを取得
     * @returns {DragManager}
     */
    static get getInstance() {
        if (!DragManager.#instance) {
            DragManager.#instance = new DragManager();
        }
        return DragManager.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (DragManager.#instance) {
            throw new Error('DragManager is a singleton. Use DragManager.getInstance instead.');
        }

        // グローバルイベントリスナーを設定
        this.#setupGlobalListeners();
    }

    /**
     * グローバルイベントリスナーを設定
     */
    #setupGlobalListeners() {
        // マウスイベント
        document.addEventListener('mousemove', (e) => this.#handleMouseMove(e));
        document.addEventListener('mouseup', () => this.#handleMouseUp());

        // タッチイベント（モバイル対応）
        document.addEventListener('touchmove', (e) => this.#handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', () => this.#handleMouseUp());
    }

    /**
     * モーダルにドラッグ機能を有効化
     * @param {HTMLElement} modalContent - .modal-content要素
     */
    enableDrag(modalContent) {
        if (!modalContent || this.#enabledModals.has(modalContent)) {
            return;
        }

        // ドラッグハンドルを取得（h2要素）
        const dragHandle = modalContent.querySelector('h2');
        if (!dragHandle) {
            console.warn('DragManager: ドラッグハンドル(h2)が見つかりません');
            return;
        }

        // マウスダウンイベント
        dragHandle.addEventListener('mousedown', (e) => this.#handleMouseDown(e, modalContent));

        // タッチスタートイベント（モバイル対応）
        dragHandle.addEventListener('touchstart', (e) => this.#handleTouchStart(e, modalContent), { passive: false });

        this.#enabledModals.add(modalContent);
    }

    /**
     * モーダルの位置をリセット（中央に戻す）
     * @param {HTMLElement} modalContent - .modal-content要素
     */
    resetPosition(modalContent) {
        if (!modalContent) return;

        modalContent.classList.remove('draggable');
        modalContent.style.left = '';
        modalContent.style.top = '';
        modalContent.style.transform = '';
    }

    /**
     * マウスダウンハンドラ（ドラッグ開始）
     * @param {MouseEvent} e
     * @param {HTMLElement} modalContent
     */
    #handleMouseDown(e, modalContent) {
        // 左クリックのみ
        if (e.button !== 0) return;

        e.preventDefault();
        this.#startDrag(e.clientX, e.clientY, modalContent);
    }

    /**
     * タッチスタートハンドラ（ドラッグ開始）
     * @param {TouchEvent} e
     * @param {HTMLElement} modalContent
     */
    #handleTouchStart(e, modalContent) {
        if (e.touches.length !== 1) return;

        e.preventDefault();
        const touch = e.touches[0];
        this.#startDrag(touch.clientX, touch.clientY, modalContent);
    }

    /**
     * ドラッグ開始共通処理
     * @param {number} clientX
     * @param {number} clientY
     * @param {HTMLElement} modalContent
     */
    #startDrag(clientX, clientY, modalContent) {
        this.#activeModal = modalContent;
        this.#isDragging = true;

        // 初回ドラッグ時に位置を固定モードに切り替え
        if (!modalContent.classList.contains('draggable')) {
            const rect = modalContent.getBoundingClientRect();
            modalContent.style.left = rect.left + 'px';
            modalContent.style.top = rect.top + 'px';
            modalContent.classList.add('draggable');
        }

        // オフセットを計算
        const rect = modalContent.getBoundingClientRect();
        this.#offsetX = clientX - rect.left;
        this.#offsetY = clientY - rect.top;

        // ドラッグ中クラスを追加
        modalContent.classList.add('dragging');
    }

    /**
     * マウスムーブハンドラ（ドラッグ中）
     * @param {MouseEvent} e
     */
    #handleMouseMove(e) {
        if (!this.#isDragging || !this.#activeModal) return;

        e.preventDefault();
        this.#updatePosition(e.clientX, e.clientY);
    }

    /**
     * タッチムーブハンドラ（ドラッグ中）
     * @param {TouchEvent} e
     */
    #handleTouchMove(e) {
        if (!this.#isDragging || !this.#activeModal) return;

        e.preventDefault();
        const touch = e.touches[0];
        this.#updatePosition(touch.clientX, touch.clientY);
    }

    /**
     * 位置更新共通処理
     * @param {number} clientX
     * @param {number} clientY
     */
    #updatePosition(clientX, clientY) {
        let newX = clientX - this.#offsetX;
        let newY = clientY - this.#offsetY;

        // 画面外に出ないよう制限
        const clamped = this.#clampPosition(newX, newY, this.#activeModal);
        newX = clamped.x;
        newY = clamped.y;

        this.#activeModal.style.left = newX + 'px';
        this.#activeModal.style.top = newY + 'px';
    }

    /**
     * マウスアップハンドラ（ドラッグ終了）
     */
    #handleMouseUp() {
        if (!this.#isDragging || !this.#activeModal) return;

        this.#activeModal.classList.remove('dragging');
        this.#activeModal = null;
        this.#isDragging = false;
    }

    /**
     * 位置を画面内に制限
     * @param {number} x
     * @param {number} y
     * @param {HTMLElement} modal
     * @returns {{x: number, y: number}}
     */
    #clampPosition(x, y, modal) {
        const rect = modal.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 最低でもヘッダー部分（50px）は画面内に残す
        const minVisible = 50;

        // X座標の制限
        const minX = -rect.width + minVisible;
        const maxX = viewportWidth - minVisible;
        x = Math.max(minX, Math.min(maxX, x));

        // Y座標の制限（上端は0以上）
        const minY = 0;
        const maxY = viewportHeight - minVisible;
        y = Math.max(minY, Math.min(maxY, y));

        return { x, y };
    }
}

// グローバルに公開
window.DragManager = DragManager;
