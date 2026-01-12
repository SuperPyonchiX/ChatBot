/**
 * CanvasRenderer.js
 * HTML Canvas APIを使用した画像生成ツール
 * 図形、テキスト、グラデーションなどを描画してPNG画像を生成
 */
class CanvasRenderer extends ToolExecutorBase {
    static #instance = null;

    constructor() {
        super();
        if (CanvasRenderer.#instance) {
            return CanvasRenderer.#instance;
        }
        CanvasRenderer.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!CanvasRenderer.#instance) {
            CanvasRenderer.#instance = new CanvasRenderer();
        }
        return CanvasRenderer.#instance;
    }

    /**
     * Canvasを描画
     * @param {Object} params - パラメータ
     * @param {number} params.width - 幅
     * @param {number} params.height - 高さ
     * @param {Array} params.elements - 描画要素の配列
     * @param {Object} params.style - スタイル設定
     * @returns {Promise<Object>} 画像結果
     */
    async execute(params) {
        this.validateParams(params, ['elements']);

        const {
            width = 800,
            height = 600,
            elements = [],
            style = {}
        } = params;

        // サイズ制限
        const maxWidth = window.CONFIG?.TOOLS?.CANVAS?.MAX_WIDTH || 4096;
        const maxHeight = window.CONFIG?.TOOLS?.CANVAS?.MAX_HEIGHT || 4096;
        const finalWidth = Math.min(Math.max(1, width), maxWidth);
        const finalHeight = Math.min(Math.max(1, height), maxHeight);

        // オフスクリーンCanvas作成
        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Canvasコンテキストの取得に失敗しました');
        }

        // 背景を描画
        this.#drawBackground(ctx, finalWidth, finalHeight, style);

        // 各要素を描画
        for (const element of elements) {
            try {
                await this.#drawElement(ctx, element, finalWidth, finalHeight);
            } catch (error) {
                console.warn(`要素の描画エラー:`, error, element);
            }
        }

        // Blobに変換
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('Blob生成に失敗')),
                'image/png'
            );
        });

        // DataURLも取得
        const dataUrl = canvas.toDataURL('image/png');

        const filename = `canvas-${Date.now()}.png`;

        return this.createImageResult(blob, dataUrl, finalWidth, finalHeight, filename);
    }

    /**
     * 背景を描画
     * @param {CanvasRenderingContext2D} ctx - コンテキスト
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} style - スタイル
     */
    #drawBackground(ctx, width, height, style) {
        if (style.backgroundGradient) {
            // グラデーション背景
            const gradient = this.#createGradient(ctx, style.backgroundGradient, width, height);
            ctx.fillStyle = gradient;
        } else {
            // 単色背景
            ctx.fillStyle = style.backgroundColor || '#ffffff';
        }
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * 要素を描画
     * @param {CanvasRenderingContext2D} ctx - コンテキスト
     * @param {Object} element - 要素
     * @param {number} canvasWidth - キャンバス幅
     * @param {number} canvasHeight - キャンバス高さ
     */
    async #drawElement(ctx, element, canvasWidth, canvasHeight) {
        ctx.save();

        // 回転・変形
        if (element.rotation) {
            const centerX = element.x + (element.width || 0) / 2;
            const centerY = element.y + (element.height || 0) / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(element.rotation * Math.PI / 180);
            ctx.translate(-centerX, -centerY);
        }

        // 透明度
        if (element.opacity !== undefined) {
            ctx.globalAlpha = Math.max(0, Math.min(1, element.opacity));
        }

        switch (element.type) {
            case 'rectangle':
                this.#drawRectangle(ctx, element);
                break;
            case 'circle':
                this.#drawCircle(ctx, element);
                break;
            case 'ellipse':
                this.#drawEllipse(ctx, element);
                break;
            case 'line':
                this.#drawLine(ctx, element);
                break;
            case 'text':
                this.#drawText(ctx, element);
                break;
            case 'path':
                this.#drawPath(ctx, element);
                break;
            case 'polygon':
                this.#drawPolygon(ctx, element);
                break;
            case 'gradient':
                this.#drawGradientRect(ctx, element, canvasWidth, canvasHeight);
                break;
            case 'arc':
                this.#drawArc(ctx, element);
                break;
            case 'bezier':
                this.#drawBezier(ctx, element);
                break;
            case 'star':
                this.#drawStar(ctx, element);
                break;
            default:
                console.warn(`未対応の要素タイプ: ${element.type}`);
        }

        ctx.restore();
    }

    /**
     * 矩形を描画
     */
    #drawRectangle(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const width = el.width || 100;
        const height = el.height || 100;
        const radius = el.borderRadius || 0;

        ctx.beginPath();
        if (radius > 0) {
            // 角丸矩形
            this.#roundRect(ctx, x, y, width, height, radius);
        } else {
            ctx.rect(x, y, width, height);
        }

        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * 角丸矩形のパスを作成
     */
    #roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /**
     * 円を描画
     */
    #drawCircle(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const radius = el.radius || 50;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * 楕円を描画
     */
    #drawEllipse(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const radiusX = el.radiusX || el.width / 2 || 50;
        const radiusY = el.radiusY || el.height / 2 || 30;

        ctx.beginPath();
        ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * 線を描画
     */
    #drawLine(ctx, el) {
        const x1 = el.x1 || el.x || 0;
        const y1 = el.y1 || el.y || 0;
        const x2 = el.x2 || x1 + 100;
        const y2 = el.y2 || y1;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        ctx.strokeStyle = el.stroke || el.color || '#000000';
        ctx.lineWidth = el.strokeWidth || el.lineWidth || 1;
        ctx.lineCap = el.lineCap || 'butt';

        if (el.dashArray) {
            ctx.setLineDash(el.dashArray);
        }

        ctx.stroke();
    }

    /**
     * テキストを描画
     */
    #drawText(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const text = el.text || '';
        const fontSize = el.fontSize || 16;
        const fontFamily = el.fontFamily || 'Arial, sans-serif';

        ctx.font = el.font || `${el.fontWeight || ''} ${fontSize}px ${fontFamily}`.trim();
        ctx.textAlign = el.align || el.textAlign || 'left';
        ctx.textBaseline = el.baseline || el.textBaseline || 'top';

        if (el.fill !== false && el.fill !== 'none') {
            ctx.fillStyle = el.fill || el.color || '#000000';
            ctx.fillText(text, x, y);
        }

        if (el.stroke) {
            ctx.strokeStyle = el.stroke;
            ctx.lineWidth = el.strokeWidth || 1;
            ctx.strokeText(text, x, y);
        }
    }

    /**
     * パスを描画
     */
    #drawPath(ctx, el) {
        const points = el.points || [];
        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x || points[0][0], points[0].y || points[0][1]);

        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            ctx.lineTo(point.x || point[0], point.y || point[1]);
        }

        if (el.closed) {
            ctx.closePath();
        }

        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * 多角形を描画
     */
    #drawPolygon(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const radius = el.radius || 50;
        const sides = el.sides || 6;

        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();

        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * グラデーション矩形を描画
     */
    #drawGradientRect(ctx, el, canvasWidth, canvasHeight) {
        const x = el.x || 0;
        const y = el.y || 0;
        const width = el.width || canvasWidth;
        const height = el.height || canvasHeight;

        const gradient = this.#createGradient(ctx, el, width, height, x, y);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, width, height);
    }

    /**
     * 円弧を描画
     */
    #drawArc(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const radius = el.radius || 50;
        const startAngle = (el.startAngle || 0) * Math.PI / 180;
        const endAngle = (el.endAngle || 360) * Math.PI / 180;

        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle, el.counterClockwise || false);

        if (el.fill && el.fill !== 'none') {
            ctx.lineTo(x, y);
            ctx.closePath();
        }

        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * ベジェ曲線を描画
     */
    #drawBezier(ctx, el) {
        const points = el.points || [];
        if (points.length < 4) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x || points[0][0], points[0].y || points[0][1]);
        ctx.bezierCurveTo(
            points[1].x || points[1][0], points[1].y || points[1][1],
            points[2].x || points[2][0], points[2].y || points[2][1],
            points[3].x || points[3][0], points[3].y || points[3][1]
        );

        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * 星を描画
     */
    #drawStar(ctx, el) {
        const x = el.x || 0;
        const y = el.y || 0;
        const outerRadius = el.outerRadius || el.radius || 50;
        const innerRadius = el.innerRadius || outerRadius * 0.4;
        const points = el.points || 5;

        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();

        this.#applyFillAndStroke(ctx, el);
    }

    /**
     * グラデーションを作成
     */
    #createGradient(ctx, options, width, height, offsetX = 0, offsetY = 0) {
        const type = options.gradientType || options.type || 'linear';
        const colors = options.colors || ['#ffffff', '#000000'];
        const stops = options.stops || colors.map((_, i) => i / (colors.length - 1));

        let gradient;

        if (type === 'radial') {
            const cx = (options.cx || 0.5) * width + offsetX;
            const cy = (options.cy || 0.5) * height + offsetY;
            const r = (options.r || 0.5) * Math.max(width, height);
            gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        } else {
            // linear
            const angle = options.angle || 0;
            const rad = angle * Math.PI / 180;
            const x1 = offsetX + width / 2 - Math.cos(rad) * width / 2;
            const y1 = offsetY + height / 2 - Math.sin(rad) * height / 2;
            const x2 = offsetX + width / 2 + Math.cos(rad) * width / 2;
            const y2 = offsetY + height / 2 + Math.sin(rad) * height / 2;
            gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        }

        colors.forEach((color, i) => {
            gradient.addColorStop(stops[i] || i / (colors.length - 1), color);
        });

        return gradient;
    }

    /**
     * 塗りと線を適用
     */
    #applyFillAndStroke(ctx, el) {
        if (el.fill && el.fill !== 'none' && el.fill !== false) {
            ctx.fillStyle = el.fill;
            ctx.fill();
        }

        if (el.stroke && el.stroke !== 'none') {
            ctx.strokeStyle = el.stroke;
            ctx.lineWidth = el.strokeWidth || 1;
            ctx.lineJoin = el.lineJoin || 'miter';
            ctx.lineCap = el.lineCap || 'butt';

            if (el.dashArray) {
                ctx.setLineDash(el.dashArray);
            }

            ctx.stroke();
        }
    }
}
