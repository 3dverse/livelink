import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidSizeError, OutOfBoundsError, Rect, RelativeRect } from "../../sources/rendering/surfaces/Rect";

// ---------------------------------------------------------------------------

describe("Rect construction", () => {
    it("derives width and height when right and bottom are given", () => {
        const r = new Rect({ left: 10, top: 20, right: 110, bottom: 70 });
        expect(r.width).toBe(100);
        expect(r.height).toBe(50);
    });

    it("derives right and bottom when width and height are given", () => {
        const r = new Rect({ left: 10, top: 20, width: 100, height: 50 });
        expect(r.right).toBe(110);
        expect(r.bottom).toBe(70);
    });

    it("defaults left and top to 0", () => {
        const r = new Rect({ width: 100, height: 50 });
        expect(r.left).toBe(0);
        expect(r.top).toBe(0);
        expect(r.right).toBe(100);
        expect(r.bottom).toBe(50);
    });

    it("prefers explicit right/bottom over width/height for right and bottom fields", () => {
        const r = new Rect({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 });
        expect(r.right).toBe(200);
        expect(r.bottom).toBe(100);
    });
});

// ---------------------------------------------------------------------------

describe("Rect validation", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
    afterEach(() => vi.restoreAllMocks());

    it("logs error when neither right nor width is provided", () => {
        new Rect({ height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error when neither bottom nor height is provided", () => {
        new Rect({ width: 100 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error for negative left", () => {
        new Rect({ left: -1, width: 100, height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error for negative top", () => {
        new Rect({ top: -1, width: 100, height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error for negative width", () => {
        new Rect({ width: -10, height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error when left >= right", () => {
        new Rect({ left: 100, right: 50, height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error when top >= bottom", () => {
        new Rect({ top: 100, bottom: 50, width: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error when left + width is inconsistent with right", () => {
        new Rect({ left: 10, right: 100, width: 50, height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("logs error when top + height is inconsistent with bottom", () => {
        new Rect({ top: 10, bottom: 100, width: 50, height: 50 });
        expect(console.error).toHaveBeenCalled();
    });

    it("does not log error for a valid rect", () => {
        new Rect({ left: 10, top: 10, width: 100, height: 50 });
        expect(console.error).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------

describe("RelativeRect", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
    afterEach(() => vi.restoreAllMocks());

    it("default covers the full [0,1] x [0,1] area", () => {
        const d = RelativeRect.default;
        expect(d.left).toBe(0);
        expect(d.top).toBe(0);
        expect(d.right).toBe(1);
        expect(d.bottom).toBe(1);
        expect(d.width).toBe(1);
        expect(d.height).toBe(1);
    });

    it("constructor defaults width and height to 1", () => {
        const r = new RelativeRect({});
        expect(r.width).toBe(1);
        expect(r.height).toBe(1);
    });

    it("accepts valid relative values without logging an error", () => {
        new RelativeRect({ left: 0.1, top: 0.2, width: 0.5, height: 0.4 });
        expect(console.error).not.toHaveBeenCalled();
    });

    it("logs error when a value exceeds the [0,1] range", () => {
        new RelativeRect({ left: 0, top: 0, width: 1.5, height: 1 });
        expect(console.error).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------

describe("RelativeRect.from_dom_elements", () => {
    function mockElement(rect: Partial<DOMRect>): HTMLElement {
        const full = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {} };
        return { getBoundingClientRect: () => ({ ...full, ...rect }) } as unknown as HTMLElement;
    }

    it("returns correct relative rect for a centered element", () => {
        const parent = mockElement({ left: 0, top: 0, width: 1000, height: 500 });
        const element = mockElement({ left: 250, top: 125, width: 500, height: 250 });

        const r = RelativeRect.from_dom_elements({ element, parent });

        expect(r.left).toBeCloseTo(0.25);
        expect(r.top).toBeCloseTo(0.25);
        expect(r.width).toBeCloseTo(0.5);
        expect(r.height).toBeCloseTo(0.5);
    });

    it("returns default rect when element fills the parent exactly", () => {
        const parent = mockElement({ left: 0, top: 0, width: 800, height: 600 });
        const element = mockElement({ left: 0, top: 0, width: 800, height: 600 });

        const r = RelativeRect.from_dom_elements({ element, parent });

        expect(r.left).toBe(0);
        expect(r.top).toBe(0);
        expect(r.width).toBeCloseTo(1);
        expect(r.height).toBeCloseTo(1);
    });

    it("throws InvalidSizeError when element has zero width", () => {
        const parent = mockElement({ left: 0, top: 0, width: 800, height: 600 });
        const element = mockElement({ left: 0, top: 0, width: 0, height: 600 });

        expect(() => RelativeRect.from_dom_elements({ element, parent })).toThrow(InvalidSizeError);
    });

    it("throws InvalidSizeError when element has zero height", () => {
        const parent = mockElement({ left: 0, top: 0, width: 800, height: 600 });
        const element = mockElement({ left: 0, top: 0, width: 800, height: 0 });

        expect(() => RelativeRect.from_dom_elements({ element, parent })).toThrow(InvalidSizeError);
    });

    it("throws OutOfBoundsError when element extends beyond parent", () => {
        const parent = mockElement({ left: 0, top: 0, width: 800, height: 600 });
        const element = mockElement({ left: 700, top: 0, width: 200, height: 100 });

        expect(() => RelativeRect.from_dom_elements({ element, parent })).toThrow(OutOfBoundsError);
    });

    it("throws OutOfBoundsError when element has negative relative position", () => {
        const parent = mockElement({ left: 100, top: 100, width: 800, height: 600 });
        const element = mockElement({ left: 50, top: 100, width: 200, height: 100 });

        expect(() => RelativeRect.from_dom_elements({ element, parent })).toThrow(OutOfBoundsError);
    });
});

// ---------------------------------------------------------------------------

describe("InvalidSizeError", () => {
    it("stores the rect and formats the message", () => {
        const rect = { width: 0, height: 100 } as DOMRect;
        const err = new InvalidSizeError(rect);

        expect(err).toBeInstanceOf(Error);
        expect(err.rect).toBe(rect);
        expect(err.message).toContain("0");
        expect(err.message).toContain("100");
    });
});

describe("OutOfBoundsError", () => {
    it("stores both rects", () => {
        const rect = { width: 200, height: 100 } as DOMRect;
        const parentRect = { width: 800, height: 600 } as DOMRect;
        const err = new OutOfBoundsError(rect, parentRect);

        expect(err).toBeInstanceOf(Error);
        expect(err.rect).toBe(rect);
        expect(err.parentRect).toBe(parentRect);
    });
});
