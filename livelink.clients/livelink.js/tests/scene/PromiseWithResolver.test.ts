import { describe, expect, it } from "vitest";
import { PromiseWithResolver } from "../../sources/scene/PromiseWithResolver";

describe("PromiseWithResolver", () => {
    it("promise resolves with the value passed to resolve()", async () => {
        const p = new PromiseWithResolver<number>();
        p.resolve(42);
        await expect(p.promise).resolves.toBe(42);
    });

    it("promise rejects with the reason passed to reject()", async () => {
        const p = new PromiseWithResolver<number>();
        p.reject(new Error("boom"));
        await expect(p.promise).rejects.toThrow("boom");
    });

    it("promise is pending before resolve or reject is called", async () => {
        const p = new PromiseWithResolver<number>();
        let settled = false;
        p.promise.then(() => { settled = true; }).catch(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);
    });

    it("resolve and reject are stable references across multiple accesses", () => {
        const p = new PromiseWithResolver<void>();
        expect(p.resolve).toBe(p.resolve);
        expect(p.reject).toBe(p.reject);
    });
});
