import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
export const LOCAL_STORAGE_KEYS = {
    IS_MAIN_MENU_COLLAPSED: "is-main-menu-collapsed",
    IS_CODE_BLOCK_COLLAPSED: "is-code-block-collapsed",
} as const;

type SetValue<T> = Dispatch<SetStateAction<T>>;

//------------------------------------------------------------------------------
export function parseJSON<T>(value: string | null): T | undefined {
    try {
        return value === "undefined" ? undefined : JSON.parse(value ?? "");
    } catch {
        console.log("parsing error on", { value });
        return undefined;
    }
}

//------------------------------------------------------------------------------
export type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[keyof typeof LOCAL_STORAGE_KEYS];
//------------------------------------------------------------------------------
export const useLocalStorage = <T>(key: LocalStorageKey, initialValue: T): [T, SetValue<T>] => {
    const readValue = useCallback((): T => {
        if (typeof window === "undefined") {
            return initialValue;
        }

        try {
            const item = window.localStorage.getItem(key);
            return item ? (parseJSON(item) as T) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    }, [initialValue, key]);

    const [storedValue, setStoredValue] = useState<T>(readValue);

    const storedValueRef = useRef(storedValue);
    storedValueRef.current = storedValue;
    const setValue: SetValue<T> = useCallback(
        value => {
            if (typeof window === "undefined") {
                console.warn(`Tried setting localStorage key “${key}” even though environment is not a client`);
            }

            try {
                const newValue = value instanceof Function ? value(storedValueRef.current) : value;
                window.localStorage.setItem(key, JSON.stringify(newValue));
                setStoredValue(newValue);
            } catch (error) {
                console.warn(`Error setting localStorage key “${key}”:`, error);
            }
        },
        [key],
    );

    useEffect(() => {
        setStoredValue(readValue());
    }, [readValue]);

    return [storedValue, setValue];
};
