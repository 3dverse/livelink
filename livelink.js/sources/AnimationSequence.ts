import { UUID, RTID } from "livelink.core";
import { Livelink } from "./Livelink";

export class AnimationSequence {
    /**
     *
     */
    #core: Livelink;

    /**
     *
     */
    private _id: UUID;

    /**
     *
     */
    private _linker_rtid: RTID;

    /**
     *
     */
    constructor(
        core: Livelink,
        { animation_sequence_id, linker_rtid = 0n }: { animation_sequence_id: UUID; linker_rtid?: RTID },
    ) {
        this.#core = core;
        this._id = animation_sequence_id;
        this._linker_rtid = linker_rtid;
    }

    /**
     *
     */
    play({ playback_speed = 1 }: { playback_speed?: number }) {
        this.#core.updateAnimationSequenceState({
            linker_rtid: this._linker_rtid,
            animation_sequence_id: this._id,
            state: 0,
            playback_speed,
        });
    }

    /**
     *
     */
    pause() {}

    /**
     *
     */
    stop() {}

    /**
     *
     */
    seek() {}
}
