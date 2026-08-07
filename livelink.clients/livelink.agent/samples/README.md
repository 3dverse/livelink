# Samples

Two runnable agents, each driving a 3dverse scene from infrastructure you start yourself with one
docker command. They are the concrete counterpart to the data-ingestion section of the
[README](../README.md): same mappings, same pipeline, against a live source rather than a snippet.

| Sample                                 | Source                                                                            | Shows                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`mqtt-ingestion/`](mqtt-ingestion/)   | a Mosquitto broker fed by [mqtt-sim](https://github.com/marcelo-6/mqtt-sim)       | wildcard fan-out — one mapping, six entities, identity in the topic |
| [`opcua-ingestion/`](opcua-ingestion/) | Microsoft's [iot-edge-opc-plc](https://github.com/Azure-Samples/iot-edge-opc-plc) | one signal per part of a machine cell, spawned into an empty scene  |

The split between them is the one that matters in practice: MQTT is web-native, so those mappings
run in a page over `ws://` exactly as they do here over `mqtt://`. `opc.tcp://` is raw TCP and only
ever runs in Node — which is also where an OPC UA client belongs, next to the PLC, with the scene as
its only outbound connection.

Both open a joinable (non-transient) session, so a viewer pointed at the same scene watches what the
agent is doing — and both open the 3dverse editor on that session in your browser automatically once
it starts driving it. Set `SESSION_ID` to pin an agent to a session that is already open instead.

## Setup

This is a **standalone package, deliberately outside the repository's workspaces**: `npm install` at
the root does not install it, and running it takes one explicit install here. The reason is
`node-opcua-client` — ~90 packages that npm would hoist to the root `node_modules`, from where
`livelink.samples` resolves it, follows the SDK's lazy `import()` into it, and drags a Node-only
tree into a browser bundle. Kept local, it reaches nothing else.

```bash
npm -C ../.. run build:agent   # the samples compile and run against the build output
npm install                    # from this directory
cp .env.example .env           # then put your token in it
```

The `.npmrc` here sets `install-links=true`, so `@3dverse/livelink-agent` (a `file:..`
dependency) is copied rather than symlinked into `node_modules` — required for the OPC UA
sample's lazy `node-opcua-client` import to resolve from this directory's own install instead
of escaping through the symlink's real path. Don't delete it.

## Running

Two terminals each, from this directory:

```bash
# MQTT — the broker and the simulator
docker compose -f mqtt-ingestion/docker-compose-mosquitto.yml up
npm run mqtt
```

```bash
# OPC UA — the simulated PLC. --ct/--sc run it at 20 Hz instead of the default 10 Hz;
# read the CYCLE_MS comment in the script before changing either.
docker run --rm -it -p 50000:50000 -p 8080:8080 --name opcplc \
  mcr.microsoft.com/iotedge/opc-plc:latest \
  --pn=50000 --autoaccept --unsecuretransport --ct=50 --sc=100
npm run opcua
```

Each prints its pipeline counters every 5 seconds, and only when something moved — a silent source
leaves the transport's own reconnection messages legible instead of burying them under empty
counters. `Ctrl-C` stops the agent, and the entities it spawned go with it
(`delete_on_client_disconnection`).

`npm run typecheck` checks both scripts. It resolves `@3dverse/livelink-agent` to the package's
**build output** rather than to its sources, so what the samples compile against is what a consumer
installing the package gets — which also means `build:agent` has to have run first.

## Generating a recording

[`playback-generators/`](playback-generators/) holds the scripts that write the dumps
`PlaybackTransport` replays — a recording is committed next to whatever replays it, and the script
is what you edit when the data needs retuning. They talk to no broker and need no token.

```bash
npm run generate:x-agent-data-ingestion   # rewrites the dump the browser "Data Ingestion" sample replays
```

`telemetry-orbiting-devices.json` sits in the same directory: four devices orbiting the origin at
60 Hz over an 8 s loop, each reporting a `status` besides its pose. Nothing replays it — it is there
as a second dump to point a `PlaybackTransport` at, smaller and more abstract than the fleet one.

`gen-playback-x-agent-data-ingestion.ts` simulates a warehouse fleet — one forklift and two drones on
closed circuits, under real cornering, acceleration and yaw-rate limits, each trajectory periodic and
starting from rest so `loop: true` replays it without a seam. Every frame carries the telemetry such
a fleet publishes alongside its pose — speed, battery and state for both, load and mast height for the
forklift, altitude and radio link for a drone — all of it derived from the trajectory and periodic
too, battery included, so nothing jumps at the loop. The same recording also carries the joint stream
of a stationary 4-DOF robotic arm — one event per pivot, each a smoothly oscillating angle rather than
a pose — which is what the sample's other mapping (`byUuid`, driving entities already in the scene) is
there to demonstrate. It is deterministic: same seeds, same file. It writes into `livelink.samples/`
by default; pass a path to write elsewhere.

## Configuration

Everything is read from the environment, including a `.env` in this directory. `LIVELINK_TOKEN` is
the only required one; the header comment of each script lists the rest with its default.
