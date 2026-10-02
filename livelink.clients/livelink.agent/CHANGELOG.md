# @3dverse/livelink-agent

## 0.5.9

### Patch Changes

- fix(livelink.agent): default session selector for join_or_start mode must filter transient sessions if requested by is_transient option

## 0.5.8

### Patch Changes

- This release includes the following changes from livelink.base:

  - feat(livelink.js): expose update loop rates updates_per_second & broadcasts_per_second, so the sdk user can control those

- feat(livelink.js): expose update loop rates updates_per_second & broadcasts_per_second, so the sdk user can control those
- chore(livelink.agent): snake case renaming, ticks_per_second, updates_per_second, broadcasts_per_second

## 0.5.7

### Patch Changes

- fix(livelink.agent): never let the core's inactivity watcher drop an agent connection
- fix(livelink.agent): connect MqttTransport with a copy of its options and name a session takeover

## 0.5.6

### Patch Changes

- This release includes the following changes from livelink.base:

  - feat(livelink.webxr): revamp app clip launch for webxr on ios using variant and plan migration to 3dverse fork of https://github.com/wem-technology/ios-webxr

- feat(livelink.agent): expose IClientOptions for MqttTransport

## 0.5.5

### Patch Changes

- Rebuild and release after livelink.base changes.

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
