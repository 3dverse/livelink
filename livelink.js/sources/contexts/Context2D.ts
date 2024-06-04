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
    constructor(canvas: HTMLCanvasElement) {
        super();

        const context = canvas.getContext("2d");
        if (context === null) {
            throw new Error(`Cannot create a 2d context from canvas ${canvas}`);
        }
        this._canvas = canvas;
        this._context2D = context;
    }

    /**
     *
     */
    drawFrame({ frame, left, top }: { frame: VideoFrame; left: number; top: number }): void {
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
}
