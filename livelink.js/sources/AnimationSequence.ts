import type { LivelinkCore, UUID } from "@livelink.core";
import { Entity } from "./Entity";

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
    private _linker: Entity | null;

    /**
     *
     */
    constructor(
        core: LivelinkCore,
        { animation_sequence_id, linker_entity = null }: { animation_sequence_id: UUID; linker_entity?: Entity | null },
    ) {
        this.#core = core;
        this._id = animation_sequence_id;
        this._linker = linker_entity;
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
        this.#core._updateAnimationSequenceState({
            linker_rtid: this._linker?.rtid ?? 0n,
            animation_sequence_id: this._id,
            state: 0,
            playback_speed,
            seek_offset,
        });
    }
}
