# LiveLink protocol v1.0
[![asyncapi](https://img.shields.io/badge/based%20on-asyncapi-975bf1)](https://github.com/asyncapi)
[![esbuild](https://img.shields.io/badge/built%20with-esbuild-ffcf00)](https://github.com/evanw/esbuild)
[![lerna](https://img.shields.io/badge/managed%20with-lerna-c084fc)](https://github.com/lerna/lerna)

## Spec-first development

https://www.atlassian.com/blog/technology/spec-first-api-development

https://blog.apideck.com/spec-driven-development-part-1

## AsyncAPI 3.0

https://www.asyncapi.com/docs/reference/specification/v3.0.0

# LiveLink.js Core v1.0

Core implementation in JavaScript of the LiveLink protocol.

This is a module that MUST always be loaded at runtime.

Handles the connection with the LiveLink Broadcast & Persistence Server and the
connection with the Cluster Gateway hosting the session.

Provides video decoding support and access to a local entity registry.

## WebTransport

For faster connections

https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API

## WebCodecs

For hardware decoding

https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API

## Web Workers

For software decoding

https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

## OffscreenCanvas

For software decoding

https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas

## BigInt

For 64 bit int support

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt

# LiveLink.js v1.0

User facing interface with as many helper functions as we want.

# Questions

- ~~Do we need to support multiple sessions in a single page?~~ YES
- Add an option to send the depth buffer to allow better composition with WebGL?
- Do we merge the editor connection and the renderer connection behind a single interface?
- Use destructured objects as function params?

# Getting Started

```bash
npm i
# -- run lerna build packages
npm run build
# -- or
# -- run lerna build packages & watch
npm run dev
# -- serve the livelink.test
npm start
```
There's no live-reload of the browser so the page needs to be refreshed after
the build is achieved by `npm run dev` each time a package file changes.

# Test packages to publish
Copy the [./livelink.test](./livelink.test) folder to test the 
[@3dverse/livelink.core](./livelink.core) and [@3dverse/livelink.js](./livelink.js) 
packages. For example, copy it to `../test.livelink`. Then remove the 
`"@3dverse/livelink.js": "file:../livelink.js"` from the `dependencies` inside
the `../test.livelink/package.json`.

To pack and install the packages to `../test.livelink`:
```bash
npm run pack
# copy the generated *.tgz packages to ../test.livelink
cd ../test.livelink
npm install *.tgz
```
Then run the demo to verify it runs as expected:
```bash
npm run build
npm start
```

