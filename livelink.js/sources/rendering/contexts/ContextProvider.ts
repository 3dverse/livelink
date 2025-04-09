import type { RelativeRect } from "../surfaces/Rect";
import type { DecodedFrame } from "../streaming/EncodedFrameConsumer";

/**
 * @category Rendering Contexts
 */
export type FrameSection = DecodedFrame & { section: RelativeRect };

/**
 * @category Rendering Contexts
 */
export abstract class ContextProvider {
    /**
     *
     */
    abstract drawFrameSection({
        frame_section,
        viewport,
    }: {
        frame_section: FrameSection;
        viewport: RelativeRect;
    }): void;

    /**
     *
     */
    refreshSize(): void {}

    /**
     *
     */
    abstract release(): void;
}
