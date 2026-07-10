import { describe, expect, it } from "vitest";
import { compute_rpn } from "../../sources/scene/Filters";

// Helpers — parse the JSON string back to an array for readable assertions.
function rpn(filter: string): string[] {
    return JSON.parse(compute_rpn(filter)) as string[];
}

// ---------------------------------------------------------------------------

describe("operands", () => {
    it("single operand passes through unchanged", () => {
        expect(rpn("tag_a")).toEqual(["tag_a"]);
    });

    it("two operands separated by & produce postfix order", () => {
        // "a & b"  →  [a, b, &]
        expect(rpn("a & b")).toEqual(["a", "b", "&"]);
    });

    it("two operands separated by | produce postfix order", () => {
        expect(rpn("a | b")).toEqual(["a", "b", "|"]);
    });

    it("two operands separated by ^ produce postfix order", () => {
        expect(rpn("a ^ b")).toEqual(["a", "b", "^"]);
    });
});

// ---------------------------------------------------------------------------

describe("operator precedence", () => {
    it("& binds tighter than | without parentheses", () => {
        // "a | b & c"  →  [a, b, c, &, |]
        expect(rpn("a | b & c")).toEqual(["a", "b", "c", "&", "|"]);
    });

    it("! binds tighter than & without parentheses", () => {
        // "! a & b"  →  [a, !, b, &]
        expect(rpn("! a & b")).toEqual(["a", "!", "b", "&"]);
    });

    it("parentheses override & over | precedence", () => {
        // "( a | b ) & c"  →  [a, b, |, c, &]
        expect(rpn("( a | b ) & c")).toEqual(["a", "b", "|", "c", "&"]);
    });
});

// ---------------------------------------------------------------------------

describe("unary not", () => {
    it("! applied to a single operand", () => {
        // "! a"  →  [a, !]
        expect(rpn("! a")).toEqual(["a", "!"]);
    });

    it("double negation", () => {
        // "! ! a"  →  [a, !, !]
        expect(rpn("! ! a")).toEqual(["a", "!", "!"]);
    });

    it("! applied to a parenthesised expression", () => {
        // "! ( a | b )"  →  [a, b, |, !]
        expect(rpn("! ( a | b )")).toEqual(["a", "b", "|", "!"]);
    });
});

// ---------------------------------------------------------------------------

describe("parentheses", () => {
    it("redundant parentheses around a single operand are stripped", () => {
        expect(rpn("( a )")).toEqual(["a"]);
    });

    it("nested parentheses are resolved correctly", () => {
        // "( ( a | b ) & c )"  →  [a, b, |, c, &]
        expect(rpn("( ( a | b ) & c )")).toEqual(["a", "b", "|", "c", "&"]);
    });
});

// ---------------------------------------------------------------------------

describe("longer chains", () => {
    it("three operands with left-associative &", () => {
        // "a & b & c"  →  [a, b, &, c, &]
        expect(rpn("a & b & c")).toEqual(["a", "b", "&", "c", "&"]);
    });

    it("mixed operators with correct precedence chain", () => {
        // "a | b & c | d"  →  [a, b, c, &, |, d, |]
        expect(rpn("a | b & c | d")).toEqual(["a", "b", "c", "&", "|", "d", "|"]);
    });
});

// ---------------------------------------------------------------------------

describe("output format", () => {
    it("returns a valid JSON string", () => {
        const result = compute_rpn("a & b");
        expect(() => JSON.parse(result)).not.toThrow();
        expect(Array.isArray(JSON.parse(result))).toBe(true);
    });
});
