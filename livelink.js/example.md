---
title: Complete Example
group: Examples
category: Examples
children:
---

# Complete Example

This example uses vanilla Javascript.

For using React refer to the Livelink React library.

## HTML Page

We start by setting up a barbone HTML page with a canvas element to render the streamed frames.
For brievity we will omit the boilerplate code for the HTML page. CSS styling is also inlined and kept to a minimum.

```html
<html>
    <body style="margin: 0; padding: 0">
        <div class="canvas-container" style="width: 100vw; height: 100vh; background-color: #000">
            <canvas
                id="display-canvas"
                tabindex="1"
                oncontextmenu="event.preventDefault()"
                style="width: 100%; height: 100%"
            ></canvas>
        </div>
    </body>
</html>
```

Various elements to note:

- The canvas element is given an id of `display-canvas` to be referenced later.
- The canvas element is set to be focusable (`tabindex=1`) so that it can receive input events.
- The `oncontextmenu` event listener is set to prevent the context menu from appearing when right-clicking on the canvas.

## Import Livelink Library

We then proceed to write the Javascript code that will interact with the Livelink API.

We import the necessary classes from the Livelink library using the ES6 module syntax:

```html
<script type="module">
    import {
        Livelink,
        RenderingSurface,
        Viewport,
        WebCodecsDecoder,
    } from "https://unpkg.com/@3dverse/livelink/dist/index.mjs";
</script>
```

## Start a New Session

First start by making sure that the browser supports WebCodecs.

```javascript
const codec = await WebCodecsDecoder.findSupportedCodec();
if (!codec) {
    throw new Error("WebCodecs not supported in this browser.");
}
```

To be able to use the Livelink API, we need to start a new session.

We do this by calling the `Livelink.start` method with the necessary parameters:

```javascript
const instance = await Livelink.start({
    scene_id: "322c6bf7-52eb-4197-ab42-a0924f71d72d",
    token: "public_UjENe9mA-wgTBYvw",
    is_transient: true,
});
```

This is mandatory to be able to use the Livelink API.

Creating a session triggers the dynamic loading of the Livelink Core module that is the actual backbone of the API
that implements the communication protocol with the server.

> 💡 If you want to use your own scene, you can just replace `scene_id` and `token` with your own values.

## Streaming Pipeline

At this point we created a new session on the server.
The server will wait for us to configure our client to start streaming frames.

The next step is to configure our streaming pipeline.

### Rendering Surface and Viewport

Then we need to create a rendering surface backed by the canvas element and setup a viewport
taking up the entire canvas.

```javascript
const surface = new RenderingSurface({
    canvas_element: "display-canvas",
    context_type: "2d",
});

const viewport = new Viewport(instance, surface);
instance.addViewports({ viewports: [viewport] });
```

In here you can customize the layout of the frame by adding multipe viewports and arranging them as you see fit.

You must assign a camera entity to each viewport for it to actually render anything.

Before doing that we need to configure the remote server with the codec we found earlier.

```javascript
await instance.configureRemoteServer({ codec });

await instance.setEncodedFrameConsumer({
    encoded_frame_consumer: new WebCodecsDecoder({
        decoded_frame_consumer: instance.default_decoded_frame_consumer,
    }),
});
```

You must have setup the viewports before configuring the remote server, otherwise the resolution of the
frames won't be set correctly.

### Camera

Now we can create a camera entity and attach it to the viewport.

```javascript
// Create a camera entity.
const DEFAULT_RENDER_GRAPH_UUID = "398ee642-030a-45e7-95df-7147f6c43392";
const RENDER_GRAPH_SETTINGS = { grid: true, skybox: true, gradient: false };
const camera = await instance.newEntity({
    name: "MyCamera",
    components: {
        local_transform: { position: [0, 1, 5] }, // Partial values are fine.
        camera: { renderGraphRef: DEFAULT_RENDER_GRAPH_UUID, dataJSON: RENDER_GRAPH_SETTINGS },
        perspective_lens: {}, // Default values are fine.
    },
    options: { auto_broadcast: false },
});
// And attach it to the viewport.
viewport.camera_entity = camera;
```

### Camera Controller

TODO: setup a camera controller

### Start Streaming

Finally we can start streaming frames.

```javascript
// We can now start streaming frames.
instance.startStreaming();
```

## Complete Code Snippet

```html
<html>
    <body style="margin: 0; padding: 0">
        <div class="canvas-container" style="width: 100vw; height: 100vh; background-color: #000">
            <!-- CANVAS -->
            <canvas
                id="display-canvas"
                tabindex="1"
                oncontextmenu="event.preventDefault()"
                style="width: 100%; height: 100%"
            ></canvas>
        </div>

        <!-- APP ENTRYPOINT -->
        <script type="module">
            import {
                Livelink,
                RenderingSurface,
                Viewport,
                WebCodecsDecoder,
            } from "https://unpkg.com/@3dverse/livelink/dist/index.mjs";

            // Make sure the browser supports WebCodecs.
            const codec = await WebCodecsDecoder.findSupportedCodec();
            if (!codec) {
                throw new Error("WebCodecs not supported in this browser.");
            }

            // Start a new session.
            const instance = await Livelink.start({
                scene_id: "322c6bf7-52eb-4197-ab42-a0924f71d72d",
                token: "public_UjENe9mA-wgTBYvw",
                is_transient: true,
            });

            // Create a rendering surface backed by the canvas element.
            const surface = new RenderingSurface({ canvas_element: "display-canvas", context_type: "2d" });

            // Setup a viewport taking up the entire canvas.
            const viewport = new Viewport(instance, surface);
            instance.addViewports({ viewports: [viewport] });

            // Configure the remote server with the codec.
            await instance.configureRemoteServer({ codec });

            // Set the encoded frame consumer to be the WebCodecsDecoder.
            await instance.setEncodedFrameConsumer({
                encoded_frame_consumer: new WebCodecsDecoder({
                    decoded_frame_consumer: instance.default_decoded_frame_consumer,
                }),
            });

            // Create a camera entity.
            const DEFAULT_RENDER_GRAPH_UUID = "398ee642-030a-45e7-95df-7147f6c43392";
            const RENDER_GRAPH_SETTINGS = { grid: true, skybox: true, gradient: false };
            const camera = await instance.newEntity({
                name: "MyCamera",
                components: {
                    local_transform: { position: [0, 1, 5] },
                    camera: { renderGraphRef: DEFAULT_RENDER_GRAPH_UUID, dataJSON: RENDER_GRAPH_SETTINGS },
                    perspective_lens: {}, // Default values are fine.
                },
                options: { auto_broadcast: false },
            });
            // And attach it to the viewport.
            viewport.camera_entity = camera;

            //TODO: setup a camera controller

            // We can now start streaming frames.
            instance.startStreaming();
        </script>
    </body>
</html>
```
