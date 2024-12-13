//------------------------------------------------------------------------------
import React, { ChangeEvent, FormEvent } from "react";
import { Input, Switch, Text } from "@chakra-ui/react";

//------------------------------------------------------------------------------
import { InputVector } from "../InputVector";
import { hexToVec3, vec3ToHex } from "../../lib/helper-colors";

//------------------------------------------------------------------------------
export const FormControlWidget = ({
    value,
    defaultValue,
    type,
    onChange,
}: {
    value: any;
    defaultValue: boolean | number | number[];
    type: string;
    onChange: (
        event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLDivElement>,
        value: boolean | number | number[],
    ) => void;
}) => {
    //--------------------------------------------------------------------------
    if (type === "bool") {
        return (
            <Switch
                size="sm"
                colorScheme="accent"
                cursor="pointer"
                isChecked={value}
                onChange={event => onChange(event, event.target.checked)}
            />
        );
    }

    //--------------------------------------------------------------------------
    if (["int", "uint", "float"].includes(type)) {
        return (
            <Input
                type="number"
                size="xs"
                maxW="5rem"
                textAlign="right"
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
                size="xs"
                maxW="5rem"
                textAlign="right"
                type={type}
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
                type="color"
                value={vec3ToHex(value)}
                onChange={event => onChange(event, hexToVec3(event.target.value))}
            />
        );
    }

    //--------------------------------------------------------------------------
    return <Text size="xs">Type {type} not supported yet</Text>;
};
