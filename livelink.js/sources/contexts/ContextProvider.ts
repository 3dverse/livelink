/**
 *
 */
export abstract class ContextProvider {
    /**
     *
     */
    abstract drawFrame({ frame, left, top }: { frame: VideoFrame; left: number; top: number }): void;

    /**
     *
     */
    refreshSize(): void {}
}
