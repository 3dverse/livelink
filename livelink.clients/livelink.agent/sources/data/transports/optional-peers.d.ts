/**
 * `node-opcua-client` is an optional peer dependency that this repository deliberately does **not**
 * install: its dependency tree is ~90 packages, and the OPC UA transport only ever touches three
 * classes of it. `OpcUaClientModule.ts` describes those instead, so this shorthand declaration is
 * all the compiler needs to accept the lazy `import("node-opcua-client")` — whose result is cast to
 * that structural view at the call site. Read it for the full rationale.
 *
 * @internal
 */
declare module "node-opcua-client";
