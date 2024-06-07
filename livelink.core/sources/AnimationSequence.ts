import { LivelinkCore } from "./LivelinkCore";
import { RTID, UUID } from "./types";

/**
 *
 */
export class AnimationSequence {
    /**
     *
     */
    #core: LivelinkCore;

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
        core: LivelinkCore,
        { animation_sequence_id, linker_rtid = 0n }: { animation_sequence_id: UUID; linker_rtid?: RTID },
    ) {
        this.#core = core;
        this._id = animation_sequence_id;
        this._linker_rtid = linker_rtid;
    }

    /**
     *
     */
    play({ playback_speed }: { playback_speed: number }) {
        this._updateState({ playback_speed });
    }

    /**
     *
     */
    pause() {
        this.play({ playback_speed: 0 });
    }

    /**
     *
     */
    stop() {
        this._updateState({ playback_speed: 0, seek_offset: 0 });
    }

    /**
     *
     */
    seek() {}

    /**
     *
     */
    private _updateState({ playback_speed, seek_offset }: { playback_speed: number; seek_offset?: number }) {
        this.#core.updateAnimationSequenceState({
            linker_rtid: this._linker_rtid,
            animation_sequence_id: this._id,
            state: 0,
            playback_speed,
            seek_offset,
        });
    }
}
