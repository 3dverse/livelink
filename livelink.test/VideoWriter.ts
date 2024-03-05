import { CodecType } from "@livelink.core";
import { EncodedFrameConsumer } from "livelink.js";

export class VideoWriter implements EncodedFrameConsumer {
  private _file_handle: FileSystemFileHandle | null = null;
  private _stream: FileSystemWritableFileStream | null = null;

  async configure({ codec }: { codec: CodecType }): Promise<VideoWriter> {
    this._file_handle = await window.showSaveFilePicker();
    this._stream = await this._file_handle.createWritable();
    return this;
  }

  consumeFrame({ encoded_frame }: { encoded_frame: DataView }): void {
    console.log(`writing ${encoded_frame.byteLength} bytes`);
    this._stream?.write(encoded_frame.buffer);
  }

  release() {
    this._stream?.close();
  }
}
