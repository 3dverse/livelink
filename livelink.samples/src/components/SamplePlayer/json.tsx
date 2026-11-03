import type React from "react";
import { Components, createPlugin, styled, useInputContext, type CustomInput, type InputOptions } from "leva/plugin";

//------------------------------------------------------------------------------
const { Row, Label } = Components;

/** Rows a value shows before it scrolls. */
const MAX_ROWS = 12;

/** JSON has no infinities: they are written as JavaScript does, and go through JSON as strings with this mark. */
const INFINITY_MARK = "\u0000";

//------------------------------------------------------------------------------
type JsonSettings = { editable: boolean };

type JsonInput<T> = InputOptions & {
    value: T;

    /** Whether the value can be edited, rather than only be set from code. Defaults to true. */
    editable?: boolean;
};

//------------------------------------------------------------------------------
// Leva would take the value of a custom input given as `value` alone, without its settings: it is given as `json`.
const jsonPlugin = createPlugin<{ json: unknown; editable: boolean }, unknown, JsonSettings>({
    normalize: ({ json, editable }) => ({ value: json, settings: { editable } }),
    // Edits come as text, values set from code as they are. Leva keeps the previous value of an edit that throws.
    sanitize: (value: unknown) => (typeof value === "string" ? parseJson(value) : value),
    format: (value: unknown) => stringifyJson(value),
    component: JsonControl,
});

//------------------------------------------------------------------------------
/**
 * A Leva input for a prop that takes an object or an array: shown as JSON under its label, across the panel, as in
 * the object controls of Storybook. Edited as text, it takes the new value once it parses; read-only, it shows a value
 * set from code, e.g. one the sample computes.
 */
export function json<T>(input: JsonInput<T> & { optional: true }): CustomInput<T | undefined>;
export function json<T>(input: JsonInput<T>): CustomInput<T>;
export function json<T>({ value, editable = true, ...options }: JsonInput<T>): CustomInput<T> {
    return jsonPlugin({ ...options, json: value, editable }) as CustomInput<T>;
}

//------------------------------------------------------------------------------
function JsonControl() {
    const { label, displayValue, onChange, onUpdate, settings, disabled } = useInputContext<{
        displayValue: string;
        settings: JsonSettings;
    }>();
    const rows = Math.min(displayValue.split("\n").length, MAX_ROWS);

    return (
        <Row>
            <Label>{label}</Label>
            {settings.editable ? (
                <Code
                    as="textarea"
                    rows={rows}
                    spellCheck={false}
                    disabled={disabled}
                    value={displayValue}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
                    onBlur={(event: React.FocusEvent<HTMLTextAreaElement>) => onUpdate(event.target.value)}
                />
            ) : (
                <Code style={{ maxHeight: `${MAX_ROWS * 1.4}em` }}>{displayValue}</Code>
            )}
        </Row>
    );
}

const Code = styled("pre", {
    $reset: "",
    margin: 0,
    padding: "$xs $sm",
    overflow: "auto",
    resize: "vertical",
    fontFamily: "$mono",
    fontSize: "$root",
    lineHeight: 1.4,
    whiteSpace: "pre",
    color: "$highlight3",
    borderRadius: "$sm",
    backgroundColor: "$elevation3",
    $inputStyle: "$elevation1",
    $hover: "",
    $focus: "",
});

//------------------------------------------------------------------------------
function stringifyJson(value: unknown): string {
    if (value === undefined) {
        return "";
    }

    const marked = JSON.stringify(
        value,
        (_key, item: unknown) => {
            if (typeof item !== "number") return item;
            if (!Number.isFinite(item)) return Number.isNaN(item) ? item : `${INFINITY_MARK}${item}`;
            // Values computed in real time, e.g. durations, read better rounded.
            return Math.round(item * 1000) / 1000;
        },
        2,
    );
    return marked.replace(/"\\u0000(-?Infinity)"/g, "$1");
}

function parseJson(text: string): unknown {
    const marked = text.replace(/(-?)\bInfinity\b/g, `"\\u0000$1Infinity"`);
    return JSON.parse(marked, (_key, item: unknown) =>
        typeof item === "string" && item.startsWith(INFINITY_MARK) ? Number(item.slice(1)) : item,
    );
}
