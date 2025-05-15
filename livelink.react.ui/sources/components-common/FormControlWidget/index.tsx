//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import { hexToVec3, vec3ToHex } from "../../lib/helper-colors";
import { Switch } from "../../components-common/Switch";
import { Size } from "../../components-common/Input";
import { InputVector } from "../../components-common/InputVector";
import { InputNumber } from "../../components-common/InputNumber";

//------------------------------------------------------------------------------
export const FormControlWidget = ({
    id,
    value,
    defaultValue,
    type,
    size,
    onChange,
}: {
    id?: string;
    value: any;
    defaultValue: boolean | number | number[];
    type:
        | "bool"
        | "int"
        | "uint"
        | "float"
        | "vec2"
        | "vec3"
        | "vec4"
        | "ivec2"
        | "ivec3"
        | "ivec4"
        | "quat"
        | "mat4"
        | "color"
        | any;
    size?: Size;
    onChange: (event: React.ChangeEvent<HTMLInputElement>, value: boolean | number | number[]) => void;
}) => {
    //--------------------------------------------------------------------------
    if (type === "bool") {
        return (
            <Switch
                id={id}
                size={size}
                isChecked={value}
                isDisabled={false}
                onChange={() =>
                    onChange({ target: { checked: !value } } as React.ChangeEvent<HTMLInputElement>, !value)
                }
            />
        );
    }

    //--------------------------------------------------------------------------
    if (["int", "uint", "float"].includes(type)) {
        return (
            <InputNumber
                id={id}
                size={size}
                value={value}
                placeholder={String(defaultValue)}
                onChange={event => onChange(event, Number(event.target.value))}
            />
        );
    }

    //--------------------------------------------------------------------------
    if (["vec2", "vec3", "vec4", "ivec2", "ivec3", "ivec4", "quat", "mat4"].includes(type)) {
        return (
            <InputVector
                id={id}
                type={type}
                size={size}
                value={value as number[]}
                placeholder={defaultValue as number[]}
                onChange={event => onChange(event, value as number[])}
            />
        );
    }

    //--------------------------------------------------------------------------
    if (type === "color") {
        return (
            <input
                id={id}
                type="color"
                value={vec3ToHex(value)}
                onChange={event => onChange(event, hexToVec3(event.target.value))}
            />
        );
    }

    //--------------------------------------------------------------------------
    return (
        <p
            style={{
                fontSize: "var(--3dverse-font-size-2xs)",
                color: "var(--3dverse-color-text-tertiary)",
            }}
        >
            Type {type} not supported yet
        </p>
    );
};
