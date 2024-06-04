import { ContextProvider } from "./ContextProvider";

/**
 *
 */
export class Context2D extends ContextProvider {
    private _canvas: HTMLCanvasElement;
    private _context2D: CanvasRenderingContext2D;

    /**
     *
     */
    constructor(canvas: HTMLCanvasElement, context_attributes?: CanvasRenderingContext2DSettings) {
        super();

        const context = canvas.getContext("2d", context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a 2d context from canvas ${canvas}`);
        }
        this._canvas = canvas;
        this._context2D = context;
    }

    /**
     *
     */
    drawFrame({ frame, left, top }: { frame: VideoFrame | OffscreenCanvas; left: number; top: number }): void {
        this._context2D.drawImage(
            frame,
            left,
            top,
            this._canvas.width,
            this._canvas.height,
            0,
            0,
            this._canvas.width,
            this._canvas.height,
        );
    }

    /**
     *
     */
    release(): void {
        this._context2D.reset();
    }
}
