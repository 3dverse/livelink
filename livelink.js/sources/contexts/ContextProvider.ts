/**
 *
 */
export abstract class ContextProvider {
    /**
     *
     */
    abstract drawFrame({ frame, left, top }: { frame: VideoFrame | OffscreenCanvas; left: number; top: number }): void;

    /**
     *
     */
    refreshSize(): void {}

    /**
     *
     */
    abstract release(): void;
}
