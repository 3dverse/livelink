import { UUID } from "livelink.core";
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
    constructor(core: Livelink, { animation_sequence_id }: { animation_sequence_id: UUID }) {
        this.#core = core;
        this._id = animation_sequence_id;
    }

    /**
     *
     */
    play({ playback_speed }: { playback_speed: number }) {
        this.#core.playAnimationSequence({ animation_sequence_id: this._id, playback_speed });
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
