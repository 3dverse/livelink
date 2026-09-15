//------------------------------------------------------------------------------
import { useRef } from "react";

/**
 * @internal
 *
 * A `Map<string, T>` that persists across renders, for the life of the component.
 */
export function useKeyedCache<T>(): {
    get(key: string): T | undefined;
    has(key: string): boolean;
    set(key: string, value: T): void;
    /** Drops every entry whose key isn't in `validKeys`. */
    prune(validKeys: Array<string>): void;
} {
    const cacheRef = useRef<Map<string, T>>(new Map());

    return {
        get: (key): T | undefined => cacheRef.current.get(key),
        has: (key): boolean => cacheRef.current.has(key),
        set: (key, value): void => {
            cacheRef.current.set(key, value);
        },
        prune: (validKeys): void => {
            const valid = new Set(validKeys);
            for (const key of cacheRef.current.keys()) {
                if (!valid.has(key)) {
                    cacheRef.current.delete(key);
                }
            }
        },
    };
}
