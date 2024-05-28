import { CodecType, Vec2i } from "@livelink.core";
import { EncodedFrameConsumer } from "livelink.js";

export class VideoWriter implements EncodedFrameConsumer {
    private _file_handle: FileSystemFileHandle | null = null;
    private _stream: FileSystemWritableFileStream | null = null;

    async configure({ codec, frame_dimensions }: { codec: CodecType; frame_dimensions: Vec2i }): Promise<VideoWriter> {
        this._file_handle = await window.showSaveFilePicker();
        this._stream = await this._file_handle.createWritable();
        return this;
    }

    consumeEncodedFrame({ encoded_frame }: { encoded_frame: DataView }): void {
        console.log(`writing ${encoded_frame.byteLength} bytes`);
        this._stream?.write(encoded_frame.buffer);
    }

    release() {
        this._stream?.close();
    }
}

/**
 * Re-encode hevc raw file to mp4:
 * ffmpeg -f hevc -i test.hevc -c copy test.mp4
 */
