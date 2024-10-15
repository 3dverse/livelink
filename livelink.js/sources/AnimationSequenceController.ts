import { Entity } from "./Entity";
import { Scene } from "./Scene";

/**
 * @category Entity
 */
export class AnimationSequenceController extends Entity {
    constructor(_scene: Scene) {
        super(_scene);
        this.auto_broadcast = "off";
    }

    /**
     *
     */
    play({ playback_speed, seek_offset }: { playback_speed?: number; seek_offset?: number }) {
        this.animation_sequence_controller!.playState = 1;
        if (playback_speed !== undefined) {
            this.animation_sequence_controller!.playbackSpeed = playback_speed;
        }

        if (seek_offset !== undefined) {
            this.animation_sequence_controller!.seekOffset = seek_offset;
        }
    }

    /**
     *
     */
    stop() {
        this.animation_sequence_controller!.playState = 0;
    }

    /**
     *
     */
    pause() {
        this.animation_sequence_controller!.playState = 2;
    }
}
