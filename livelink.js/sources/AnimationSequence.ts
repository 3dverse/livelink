import type { LivelinkCore, UUID } from "@3dverse/livelink.core";
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
    #id: UUID;

    /**
     *
     */
    #linker: Entity | null;

    /**
     *
     */
    constructor(
        core: LivelinkCore,
        { animation_sequence_id, linker_entity = null }: { animation_sequence_id: UUID; linker_entity?: Entity | null },
    ) {
        this.#core = core;
        this.#id = animation_sequence_id;
        this.#linker = linker_entity;
    }

    /**
     *
     */
    play({ playback_speed, seek_offset }: { playback_speed: number; seek_offset?: number }) {
        this._updateState({ playback_speed, seek_offset });
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
            linker_rtid: this.#linker?.rtid ?? 0n,
            animation_sequence_id: this.#id,
            state: 0,
            playback_speed,
            seek_offset,
        });
    }
}
