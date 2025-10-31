//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { AccordionItem, AccordionButton, AccordionPanel } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Accordion",
    component: AccordionItem,
    subcomponents: {
        AccordionButton: AccordionButton as React.ComponentType<any>,
        AccordionPanel: AccordionPanel as React.ComponentType<any>,
    },
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof AccordionItem>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        isExpandable: true,
        children: <div>Accordion</div>,
    },
    render: ({ isExpandable, ...args }) => (
        <AccordionItem {...args} isExpandable={isExpandable}>
            <AccordionButton isExpandable={isExpandable}>Accordion button</AccordionButton>
            <AccordionPanel>Example of an accordion panel</AccordionPanel>
        </AccordionItem>
    ),
};
