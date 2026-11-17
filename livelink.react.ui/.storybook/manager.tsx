//------------------------------------------------------------------------------
// Note: React import is required for the manager to work
import React from "react";
import { addons, type API, type HashEntry } from "storybook/manager-api";
import theme from "./theme";

//------------------------------------------------------------------------------
const NEW_TAG = "new";

//------------------------------------------------------------------------------
addons.setConfig({
    theme: theme,
    sidebar: {
        renderLabel: (item: HashEntry, api: API) => {
            if (!isNewEntry(item, api)) {
                return item.name;
            }

            return (
                <>
                    {item.name}
                    <NewBadge />
                </>
            );
        },
    },
});

//------------------------------------------------------------------------------
function isNewEntry(item: HashEntry, api: API): boolean {
    if (!item.tags.includes(NEW_TAG)) {
        return false;
    }

    const parent = "parent" in item && item.parent ? api.resolveStory(item.parent, item.refId) : undefined;
    return !parent?.tags.includes(NEW_TAG);
}

//------------------------------------------------------------------------------
function NewBadge() {
    return (
        <span
            style={{
                marginLeft: "0.5rem",
                padding: "0 0.25rem",
                color: "var(--color-content-primary-dark)",
                fontSize: ".6rem",
                fontWeight: 600,
                textTransform: "uppercase",
                backgroundColor: "var(--color-accent)",
                borderRadius: "0.15rem",
                alignSelf: "center",
            }}
        >
            New
        </span>
    );
}
