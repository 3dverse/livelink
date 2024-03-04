import { Camera } from "livelink.js";

export class MyCamera extends Camera {
  /**
   *
   */
  onCreate() {
    this.local_transform = { position: [0, 1, 5] };
    this.camera = {
      renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
      dataJSON: { grid: true, skybox: false, gradient: true },
    };
    this.perspective_lens = {};
  }

  /**
   *
   */
  onUpdate({ elapsed_time }: { elapsed_time: number }) {
    this.local_transform!.position![1] = 1 + Math.sin(elapsed_time);
  }
}
