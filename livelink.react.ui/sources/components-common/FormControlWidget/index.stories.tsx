//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

//------------------------------------------------------------------------------
import { FormControlWidget } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Form Control Widget",
    component: FormControlWidget,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof FormControlWidget>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        value: [1, 1, 1, 1],
        defaultValue: 1,
        type: "vec4",
        onChange: () => {},
    },
    render: args => (
        <div className="livelink-react-ui-component">
            <FormControlWidget {...args} />
        </div>
    ),
};

//------------------------------------------------------------------------------
const allTypes = [
    { type: "int", value: 1 },
    { type: "uint", value: 1 },
    { type: "float", value: 1.5 },
    { type: "vec2", value: [1.5, 1.5] },
    { type: "vec3", value: [1.5, 1.5, 1.5] },
    { type: "vec4", value: [1.5, 1.5, 1.5, 1.5] },
    { type: "ivec2", value: [1, 1] },
    { type: "ivec3", value: [1, 1, 1] },
    { type: "ivec4", value: [1, 1, 1, 1] },
    { type: "quat", value: [1, 1, 1, 1] },
    { type: "mat4", value: [1, 1, 1, 1] },
    { type: "bool", value: true },
    { type: "color", value: [255, 255, 255] },
];

//------------------------------------------------------------------------------
export const _AllComponent: Story = {
    args: {
        value: 1,
        defaultValue: 1,
        type: "",
        onChange: () => {},
        size: "xs",
    },
    render: args => (
        <div
            className="livelink-react-ui-component"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
            }}
        >
            {allTypes.map(type => (
                <div key={type.type} style={{ display: "flex", gap: "4rem" }}>
                    <p>{type.type}</p>
                    <FormControlWidget {...args} type={type.type} value={type.value} />
                </div>
            ))}
        </div>
    ),
};
