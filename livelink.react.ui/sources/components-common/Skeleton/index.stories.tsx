//------------------------------------------------------------------------------
import React from "react";
import type { ArgTypes, Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { Skeleton } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Skeleton",
    component: Skeleton,
    parameters: {
        layout: "centered",
    },
    argTypes: {
        note: {
            name: "Note",
            description: "Skeleton height is defined by the font-size.",
            control: { type: null },
        },
    } as ArgTypes<typeof Skeleton>,
} satisfies Meta<typeof Skeleton>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    render: (args: any) => {
        return (
            <div
                style={{
                    width: "10rem",
                    fontSize: "1.25rem",
                }}
            >
                <Skeleton {...args} />
            </div>
        );
    },
};
