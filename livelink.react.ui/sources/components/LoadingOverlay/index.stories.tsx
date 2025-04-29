//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@chakra-ui/react";
import { LoadingOverlay } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Loading Overlay",
    component: LoadingOverlay,
    decorators: [
        Story => (
            <Box minH="30rem">
                <Story />
            </Box>
        ),
    ],
    parameters: {
        layout: "fullscreen",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof LoadingOverlay>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
};
