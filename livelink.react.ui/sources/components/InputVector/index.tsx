//------------------------------------------------------------------------------
import React, { ChangeEvent } from "react";
import { Input, InputGroup, InputGroupProps } from "@chakra-ui/react";

//------------------------------------------------------------------------------
export const InputVector = ({
    type,
    value,
    placeholder,
    onChange,
    ...inputGroupProps
}: {
    type: string;
    value: number[];
    placeholder?: number[];
    onChange: (event: ChangeEvent<HTMLInputElement>, value: number[]) => void;
} & InputGroupProps) => {
    //------------------------------------------------------------------------------
    if (!value) return null;
    //------------------------------------------------------------------------------
    return (
        <InputGroup {...inputGroupProps}>
            {value.map((val: number, index: number) => (
                <Input
                    key={index}
                    type="number"
                    className="basis-1/3"
                    pr="0"
                    border="none"
                    rounded="none"
                    roundedTopStart={index === 0 ? "lg" : undefined}
                    roundedTopEnd={
                        (index === value.length - 1 && value.length <= 4) || (type === "mat4" && index === 3)
                            ? "lg"
                            : undefined
                    }
                    roundedBottomStart={
                        (index === 0 && value.length <= 4) || (type === "mat4" && index === 12) ? "lg" : undefined
                    }
                    roundedBottomEnd={index === value.length - 1 ? "lg" : undefined}
                    pattern="[0-9]"
                    placeholder={String(placeholder?.[index])}
                    value={val}
                    onChange={event => {
                        value[index] = Number(event.target.value);
                        onChange(event, value);
                    }}
                />
            ))}
        </InputGroup>
    );
};
