# Livelink React

## About

Livelink React is a React library that sits on top of Livelink.js and provides core React components to easily build 3dverse applications.

## Installation

To install the library, run:

```bash
npm install @3dverse/livelink-react
```

## Usage

Here's a snippet for the simplest application:

```tsx
import React from "react";
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";

function App() {
    return (
        <Livelink token="your-authentication-token" sceneId="your-scene-id">
            <AppLayout />
        </Livelink>
    );
}

function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas width="100vw" height="100vh">
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController />
            </Viewport>
        </Canvas>
    );
}
```

## Structure of a Livelink React App

Livelink React provides 3 contexts:

- `LivelinkContext`
    - Handles the connection to the Livelink server and gives access to the resulting session.
- `CanvasContext`
    - Creates an HTML `<canvas>` element and its underlying `RenderingSurface` and provides access to them.
- `ViewportContext`
    - Creates a `Livelink.Viewport` and assign a `<div>` element to it and attach the provided camera.

with their 3 respective components.

- `<Livelink>`
    - Instantiates a `LivelinkContext`
- `<Canvas>`
- `<Viewport>`

It also provides a component

- `<CameraController>`

and 2 hooks:

- `useEntity()`
- `useCameraEntity()`
