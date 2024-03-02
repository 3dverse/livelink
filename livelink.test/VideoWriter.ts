import { CodecType } from "@livelink.core";
import { EncodedFrameConsumer } from "livelink.js";
import * as Mp4Muxer from "mp4-muxer";

export class VideoWriter implements EncodedFrameConsumer {
  //private _muxer: Mp4Muxer.Muxer | null = null;

  configure({ codec }: { codec: CodecType }): Promise<VideoWriter> {
    /*this._muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: "avc",
        width: 100,
        height: 100,
      },
    });*/
    return Promise.resolve(this);
  }

  consumeFrame({ encoded_frame }: { encoded_frame: DataView }): void {
    throw new Error("Method not implemented.");
  }
}
