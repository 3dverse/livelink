import { Entity } from "./Entity";

/**
 * @category Entity
 */
export class AnimationSequenceController {
    /**
     *
     */
    #entity: Entity;

    /**
     *
     */
    constructor({ entity }: { entity: Entity }) {
        this.#entity = entity;
    }

    /**
     *
     */
    play({ playback_speed, seek_offset }: { playback_speed?: number; seek_offset?: number }) {
        this.#entity.animation_sequence_controller!.playState = 1;
        if (playback_speed !== undefined) {
            this.#entity.animation_sequence_controller!.playbackSpeed = playback_speed;
        }

        if (seek_offset !== undefined) {
            this.#entity.animation_sequence_controller!.seekOffset = seek_offset;
        }
    }

    /**
     *
     */
    stop() {
        this.#entity.animation_sequence_controller!.playState = 0;
    }

    /**
     *
     */
    pause() {
        this.#entity.animation_sequence_controller!.playState = 2;
    }
}
