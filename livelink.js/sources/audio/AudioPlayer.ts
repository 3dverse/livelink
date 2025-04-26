/**
 *
 */
export class AudioPlayer {
    /**
     *
     */
    readonly #num_channels = 2 as const;
    readonly #sample_rate = 44100 as const;
    readonly #bit_depth = 32 as const;
    readonly #global_volume = 1.0 as const;

    /**
     *
     */
    #audio_context: AudioContext;

    /**
     *
     */
    #next_start_time = 0;

    /**
     *
     */
    constructor() {
        this.#audio_context = new AudioContext({
            sampleRate: this.#sample_rate,
            latencyHint: "interactive",
        });

        this.#next_start_time = this.#audio_context.currentTime;
    }

    /**
     *
     */
    release(): void {
        this.#audio_context.close();
    }

    /**
     *
     */
    playAudioPacket({ packet }: { packet: DataView }): void {
        const samples = new Float32Array(packet.buffer, packet.byteOffset);
        const sample_count = packet.byteLength / ((this.#bit_depth / 8) * this.#num_channels);
        this.#scheduleAudio({ samples, sample_count });
    }

    /**
     *
     */
    #scheduleAudio({ samples, sample_count }: { samples: Float32Array; sample_count: number }): void {
        const source = this.#audio_context.createBufferSource();
        source.buffer = this.#getBuffer({ samples, sample_count });
        source.connect(this.#audio_context.destination);

        if (this.#next_start_time <= this.#audio_context.currentTime) {
            // The first time the source will play, it will play a buffer later to allow for
            // that maximum unexpected latency.
            this.#next_start_time = 0.1 + this.#audio_context.currentTime + sample_count / this.#sample_rate;
        }

        source.start(this.#next_start_time);
        this.#next_start_time += sample_count / this.#sample_rate;
    }

    /**
     *
     */
    #getBuffer({ samples, sample_count }: { samples: Float32Array; sample_count: number }): AudioBuffer {
        const buffer = this.#audio_context.createBuffer(this.#num_channels, sample_count, this.#sample_rate);
        for (let channel = 0; channel < this.#num_channels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let j = 0; j < sample_count; j++) {
                channelData[j] = samples[channel * sample_count + j] * this.#global_volume;
            }
        }
        return buffer;
    }
}
