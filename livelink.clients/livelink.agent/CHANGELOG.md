# @3dverse/livelink-agent

## 0.5.4

### Patch Changes

- fix(livelink.agent): prevent prototype pollution in entity id resolution
- feat(livelink.agent): stop the agent when it runs out of sessions
- chore(livelink.agent): test linting
- feat(livelink.agent): continuous motion updates with per-entity state
- fix(livelink.agent): don't let a throwing gateway onerror crash the process

## 0.5.3

### Patch Changes

- fix(livelink.agent): remove samples related documentation from livelink.agent

## 0.5.2

### Patch Changes

- chore(livelink.agent): remove deprecated eslint config for nodejs samples moved to livelink.samples
- docs(livelink.agent): review README

## 0.5.1

### Patch Changes

- refactor(livelink.agents): moved agent samples
- refactor(livelink.clients): declare event maps explicitly
- feat(livelink.agent): add data-ingestion layer (Transport + IngestionPipeline + EventMapping + SceneIngestion)
- feat(livelink.agent): add headless agent SDK built on livelink.base
- feat(livelink.agents): add advanced opcua & mqtt samples to run from command line along with docker servers
- docs(livelink.clients): group events in a "<Area> / Events" sidebar category
- refactor(livelink.agent): type the OPC UA transport against the real node-opcua-client
