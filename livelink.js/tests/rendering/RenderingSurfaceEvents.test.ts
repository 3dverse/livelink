import { describe, expect, it } from "vitest";
import { RenderingSurfaceResizedEvent } from "../../sources/rendering/surfaces/RenderingSurfaceEvents";

describe("RenderingSurfaceResizedEvent", () => {
    it("type is on-rendering-surface-resized", () => {
        expect(new RenderingSurfaceResizedEvent().type).toBe("on-rendering-surface-resized");
    });
});
