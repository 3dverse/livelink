# LiveLink protocol v1.0

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

- ~~Do we need to support multiple sessions in a single page?~~ NO
- Add an option to send the depth buffer to allow better composition with WebGL?
- Do we merge the editor connection and the renderer connection behind a single interface?
- Use destructured objects as function params?
