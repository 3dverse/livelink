# Entity zones

Zones drawn in three.js round entities of the scene, over the stream: a pad of glass on the floor, ringed and ticked like a dial, and a curtain of light rising off its rim. A sweep and a dashed ring on the pad turn as the entity turns, the sweep's edge along its +Z. Each zone is laid at its entity's origin and follows it, whatever moves it.

Any app can draw them: mount `EntityZones` inside a `Viewport`. three.js is a peer dependency.

```tsx
import { EntityZones, type EntityZoneOptions } from "@3dverse/livelink-react-ui";

const { entity } = useEntity({ euid: ROBOT_EUID });
const zones = useMemo<EntityZoneOptions[]>(
  () => [{ entity, radiusM: 0.8, occluder: { min: [-0.26, 0, -0.33], max: [0.26, 0.65, 0.33] } }],
  [entity],
);
return <EntityZones zones={zones} />;
```

`zones` is memoized, as an effect's dependency is: a new array rebuilds every zone. All the zones go on one canvas, so there can be as many as needed.

## Options

| Option                 | Default                                                                                                               | What it does                                                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`               | —                                                                                                                     | What the zone stands round. Null, no zone: it shows once the entity is found.                                                                                                                                                                         |
| `radiusM`              | —                                                                                                                     | The pad's radius, in meters. The rings and ticks are laid out as shares of it.                                                                                                                                                                        |
| `curtainHeightM`       | `0.7`                                                                                                                 | How high the light rises off the rim, in meters.                                                                                                                                                                                                      |
| `occluder`             | none                                                                                                                  | The entity's bounding box, `{ min, max }` in its own frame and meters. The stream hands the zone no depth, so this stands in for the entity: whatever of the zone it stands in front of fades out. Without it, the zone is drawn over the entity too. |
| `occlusionSoftnessRad` | `0.03`                                                                                                                | How wide that fade is about the box's outline, as an angle seen from the camera: the same few pixels near or far.                                                                                                                                     |
| `turnDirection`        | from the entity                                                                                                       | Which way the sweep's trail runs: `1` counter-clockwise seen from above, `-1` clockwise. Unset, it is taken from how the entity turns, once it does.                                                                                                  |
| `colors`               | `glass`: `--3dverse-color-bg-ground`, `edge`: `--3dverse-color-content-informative`, `sweep`: `--3dverse-color-brand` | Any CSS colour, a token's `var()` included, resolved in the app's theme and again when it changes. `edge` colours the rim, ticks, rings and curtain.                                                                                                  |
| `show`                 | all `true`                                                                                                            | `{ ticks, dashedRing, sweep, curtain }`: set one to `false` to leave it out.                                                                                                                                                                          |

## How it is drawn

`EntityZonesLayer` puts a canvas of its own over the viewport and hands the viewport an overlay, `ZoneOverlay`, which renders the zones with the camera of every frame the viewport composites: they never drift against the stream. Before each frame, every `EntityZone` reads its entity's world transform.

The occluder's fade is worked out in the zones' shaders (`OCCLUSION_GLSL` in `entityZone.ts`): each point marches its line of sight towards the eye and fades by how near it passes the box, as an angle seen from the eye — softly about the outline rather than cut along it.
