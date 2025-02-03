/**
 *
 */
type UnionKeys<T> = T extends T ? keyof T : never;

/**
 * @inline
 * @internal
 */
export type StrictUnionHelper<T, TAll> = T extends unknown
    ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>>
    : never;

/**
 * A utility type that creates a strict union of the types in `T`.
 * This basically turns an `OR`ed type into a `XOR`ed type.
 *
 * @template T - The type to create a strict union of, should be in the form of `A | B | ...` where `A`, `B`, etc.
 * are the types to create a strict union of.
 *
 * @example
 * ```ts
 * type A = { a: number };
 * type B = { b: string };
 * type OrType = A | B;
 * type XorType = StrictUnion<A | B>;
 * const orValue: OrType = { a: 1, b: "hello" }; // OK
 * const xorValue: XorType = { a: 1, b: "hello" }; // Error
 * ```
 *
 * @inline
 * @internal
 */
export type StrictUnion<T> = StrictUnionHelper<T, T>;
