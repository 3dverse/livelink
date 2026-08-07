/**
 * `node-opcua-client` is an optional peer dependency that this transport deliberately does **not**
 * import: its dependency tree is ~90 packages, and the OPC UA transport only ever touches three
 * classes of it. `OpcUaClientModule.ts` describes those instead, so this shorthand declaration is
 * all the compiler needs to accept the lazy `import("node-opcua-client")` — whose result is cast to
 * that structural view at the call site. Read it for the full rationale.
 *
 * `samples/opcua-ingestion/` does install it, being a program rather than a library — but it is a
 * standalone package with its own `node_modules`, which is not on the resolution path of anything
 * here. What `sources/` compiles against stays the structural view, which is what a consumer who
 * installs no such peer gets.
 *
 * @internal
 */
declare module "node-opcua-client";
