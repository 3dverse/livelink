# Samples

Runnable agents, the concrete counterpart to the data-ingestion section of the
[README](../README.md): same mappings, same pipeline, against a live source rather than a snippet.
`quickstart/` needs nothing but Node — start there if you haven't written a mapping yet.
`mqtt-ingestion/` and `opcua-ingestion/` each drive a scene from infrastructure you start yourself
with one docker command.

| Sample                                 | Source                                                                            | Shows                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`quickstart/`](quickstart/)           | an in-memory recording, no infra to start                                         | the minimal ingestion example                                       |
| [`mqtt-ingestion/`](mqtt-ingestion/)   | a Mosquitto broker fed by [mqtt-sim](https://github.com/marcelo-6/mqtt-sim)       | wildcard fan-out — one mapping, six entities, identity in the topic |
| [`opcua-ingestion/`](opcua-ingestion/) | Microsoft's [iot-edge-opc-plc](https://github.com/Azure-Samples/iot-edge-opc-plc) | one signal per part of a machine cell, spawned into an empty scene  |

The split between the last two is the one that matters in practice: MQTT is web-native, so those
mappings run in a page over `ws://` exactly as they do here over `mqtt://`. `opc.tcp://` is raw TCP
and only ever runs in Node — which is also where an OPC UA client belongs, next to the PLC, with
the scene as its only outbound connection.

`mqtt-ingestion` and `opcua-ingestion` both open a joinable (non-transient) session, so a viewer
pointed at the same scene watches what the agent is doing — and both open the 3dverse editor on
that session in your browser automatically once it starts driving it. Set `SESSION_ID` to pin an
agent to a session that is already open instead.

## Also in this package

Two related samples live under [`../advanced/`](../advanced/), building the same ingestion
pipeline into a React/browser context instead of a headless Node agent:

- [`x-agent-data-ingestion`](../advanced/x-agent-data-ingestion/) — the same kind of recorded
  playback, driving a live `<Viewer/>` with trace and stats panels alongside the 3D scene.
- [`x-agent-multiplayer-game`](../advanced/x-agent-multiplayer-game/) — a different use of the same
  agent: hosting a multiplayer game and refereeing rounds through shared tags, rather than ingesting
  telemetry.

Both run from the samples app (`npm run dev`), not from the command line.

## Setup

These are scripts of the `@3dverse/livelink-agent` package, not a package of their own: the root
`npm install` covers them, and everything below runs from the **package root** (`..`), not from this
directory.

```bash
cd ../../..                  # livelink.samples
npm -C ../ run build:agent   # the samples compile and run against the build output
```

`node-opcua-client` — ~90 packages, Node-only — is a devDependency of the package, so npm hoists it
to the root `node_modules`. It is kept out of the browser samples bundle at the one place that could
pull it in: `livelink.samples/vite.config.ts` excludes the specifier, which the OPC UA transport
reaches only through a lazy `import()` on a code path no browser sample takes. If you ever see a
`node-opcua-*` chunk in that bundle, that exclusion is what regressed.

## Running the quickstart

One terminal from the livelink.samples root:
```
npm run agent-sample:quickstart
```

## Running the mqtt & opcua samples

Two terminals each, from the livelink.samples root:

```bash
# MQTT — the broker and the simulator
docker compose -f src/samples/agent/mqtt-ingestion/docker-compose-mosquitto.yml up
npm run agent-sample:mqtt
```

Two terminals each, from the livelink.samples root:

```bash
# OPC UA — the simulated PLC. --ct/--sc run it at 20 Hz instead of the default 10 Hz;
# read the CYCLE_MS comment in the script before changing either.
docker run --rm -it -p 50000:50000 -p 8080:8080 --name opcplc \
  mcr.microsoft.com/iotedge/opc-plc:latest \
  --pn=50000 --autoaccept --unsecuretransport --ct=50 --sc=100
npm run agent-sample:opcua
```

Each prints its pipeline counters every 5 seconds, and only when something moved — a silent source
leaves the transport's own reconnection messages legible instead of burying them under empty
counters. `Ctrl-C` stops the agent, and the entities it spawned go with it
(`delete_on_client_disconnection`).

`npm run typecheck:agent-samples`, from the livelink.samples root, checks every script here. That
config resolves `@3dverse/livelink-agent` to the package's **build output** rather
than to its sources, so what the samples compile against is what a consumer installing the package
gets — which also means `build:agent` has to have run first. The same config drives `tsx` at run
time, so a sample runs against exactly what it type-checked against.

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
closed circuits, under real cornering, acceleration and yaw-rate limits. Trajectories start from rest
and are periodic, as is the telemetry each frame carries alongside the pose — speed, battery and state
for both kinds, load and mast height for the forklift, altitude and radio link for a drone — so
`loop: true` replays without a seam, battery included. The same recording carries a stationary 4-DOF
arm's joint stream, one event per pivot holding an oscillating angle rather than a pose, which is what
the sample's other mapping (`byUuid`, onto entities already in the scene) demonstrates. Deterministic:
same seeds, same file, so a re-run that changes the committed dump means the generator changed. Writes
into `livelink.samples/` by default — a path anchored to the script, not the working directory — or to
a path given as argument.

## Configuration

Everything is read from the environment, including a `.env` of livelink.samples root directory.
