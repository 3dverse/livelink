//------------------------------------------------------------------------------
// Generates the recording the browser sample "Data Ingestion" replays: telemetry
// for a warehouse fleet — one forklift driving the floor and two drones flying
// above it — plus the joint stream of a stationary 4-DOF robotic arm, all in the
// exact envelope shape `PlaybackTransport` reads.
//
//   npm run generate:x-agent-data-ingestion
//
// Nothing imports this: the recording is committed next to the sample that uses
// it (`livelink.samples/src/samples/advanced/x-agent-data-ingestion/`), and this
// is what you edit when the motion needs retuning. Pass an output path as the
// first argument to write it somewhere else.
//
// The fleet's motion is not random noise per frame. Each vehicle follows a
// *closed* Catmull-Rom circuit through waypoints, traversed under real limits —
// cornering capped by lateral acceleration and yaw rate, acceleration and
// braking capped by a forward/backward pass over the arc-length profile.
// Attitude is then derived from the resulting trajectory: the forklift's yaw is
// its tangent (it cannot slide sideways), and each drone banks into its turns
// from its own measured acceleration.
//
// Every trajectory is periodic over the recording's duration and starts and ends
// at rest, so `loop: true` replays it without a seam: the drones lift off from
// their pad at t=0 and are back on it as the recording ends.
//
// Besides the pose, each frame carries the telemetry a fleet of this kind really
// publishes, every field read off that same trajectory:
//
//   both       speed (m/s), battery (%), state
//   forklift   load (kg), mast (m)          — what it is carrying, how high
//   drone      alt (m), link (%)            — altitude, and the radio link to its pad
//
// All of them are periodic too, battery included: it is charged only while the
// vehicle is docked, and the charge is normalized so the lap ends on the level it
// started at. A field that did not close would show up as a jump at every loop.
//
// The arm needs none of that machinery: it does not move through space, so its
// four pivots are each just a smoothly oscillating angle — see "The arm" below.
//------------------------------------------------------------------------------
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

//------------------------------------------------------------------------------
// Where the recording lands: the sample that replays it lives across the repo.
// Anchored to this script rather than to the working directory, so that running
// it from anywhere writes the same file — `npm run` sets the cwd to the package
// root, but invoking the script directly does not.
//------------------------------------------------------------------------------
const DEFAULT_OUTPUT = resolve(
    __dirname,
    "../../../../livelink.samples/src/samples/advanced/x-agent-data-ingestion/x-agent-data-ingestion-recording.json",
);

//------------------------------------------------------------------------------
// The volume the fleet evolves in: X ±10 m, Z ±15 m, altitude 0..10 m.
//------------------------------------------------------------------------------
const BOUNDS = { x: 10, z: 15, altitude: 10 };
const MARGIN = 1.5;

const RATE_HZ = 30;
const GRAVITY = 9.81;
const EPOCH = Date.parse("2026-01-01T00:00:00.000Z");

//------------------------------------------------------------------------------
type Vec3 = [number, number, number];

/** The circuit resampled at a fixed resolution, with what each sample is worth. */
type Track = {
    positions: Array<Vec3>;
    /** Segment i joins sample i to sample i+1, the last one closing the loop. */
    segment_lengths: Array<number>;
    curvatures: Array<number>;
    total_length: number;
    count: number;
};

/** What the vehicle can physically do. */
type Limits = {
    max_speed: number;
    acceleration: number;
    braking: number;
    lateral_acceleration: number;
    max_yaw_rate: number;
};

/** The speed held at each sample, and what the lap costs in time. */
type SpeedProfile = {
    speeds: Array<number>;
    segment_durations: Array<number>;
    moving_duration: number;
};

/** A standstill: the vehicle waits `dwell` seconds on reaching `sample`. */
type Stop = { sample: number; dwell: number };

/**
 * One recorded frame of a vehicle: where it is, how it is oriented, and what it
 * reports about itself. Only a drone reports pitch, roll, altitude and link; only
 * a forklift reports its load and mast height.
 */
type Pose = {
    pos: Vec3;
    yaw: number;
    pitch?: number;
    roll?: number;
    speed: number;
    battery: number;
    state: string;
    load?: number;
    mast?: number;
    alt?: number;
    link?: number;
};

type PoseParams = { frames: Array<Vec3>; dt: number; duration: number };

type Vehicle = {
    channel: string;
    track: Track;
    profile: SpeedProfile;
    stops: Array<Stop>;
    /** The shortest the lap can be, dwells included: the recording cannot be shorter. */
    minimum_duration: number;
    /** Turn the sampled positions into the poses the recording carries. */
    pose(params: PoseParams): Array<Pose>;
};

type VehiclePayload = {
    pos: Array<number>;
    yaw: number;
    pitch?: number;
    roll?: number;
    speed: number;
    battery: number;
    state: string;
    load?: number;
    mast?: number;
    alt?: number;
    link?: number;
};

/** One pivot of the arm, reported on its own — see "The arm" below. */
type ArmJointPayload = { axis: number; angle: number };

type RecordedEvent = {
    channel: string;
    timestamp: string;
    payload: VehiclePayload | ArmJointPayload;
};

//------------------------------------------------------------------------------
// Deterministic PRNG, so re-running this script reproduces the recording.
//------------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function random(): number {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

//------------------------------------------------------------------------------
// Vector helpers. Positions are `[x, y, z]`, Y up.
//------------------------------------------------------------------------------
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Signed shortest way round from one angle to another.
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

//------------------------------------------------------------------------------
// A closed Catmull-Rom spline through `points`, evaluated at `u` in [0, count).
//------------------------------------------------------------------------------
function splineAt(points: Array<Vec3>, u: number): Vec3 {
    const count = points.length;
    const segment = Math.floor(u) % count;
    const t = u - Math.floor(u);
    const p0 = points[(segment - 1 + count) % count];
    const p1 = points[segment];
    const p2 = points[(segment + 1) % count];
    const p3 = points[(segment + 2) % count];

    const t2 = t * t;
    const t3 = t2 * t;
    const axis = (i: number): number =>
        0.5 *
        (2 * p1[i] +
            (-p0[i] + p2[i]) * t +
            (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
            (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);

    return [axis(0), axis(1), axis(2)];
}

//------------------------------------------------------------------------------
// The circuit resampled at a fixed arc-length resolution: the table every step
// below reads, holding the polyline, the distance along it, and how sharply it
// turns at each sample.
//------------------------------------------------------------------------------
/** How many track samples each spline segment (waypoint to waypoint) resamples to. */
const SAMPLES_PER_SEGMENT = 240;

function buildTrack({
    waypoints,
    samples_per_segment = SAMPLES_PER_SEGMENT,
}: {
    waypoints: Array<Vec3>;
    samples_per_segment?: number;
}): Track {
    const count = waypoints.length * samples_per_segment;
    const positions = Array.from({ length: count }, (_, i) => splineAt(waypoints, (i / count) * waypoints.length));

    const segment_lengths = positions.map((position, i) => length(sub(positions[(i + 1) % count], position)));
    const total_length = segment_lengths.reduce((sum, d) => sum + d, 0);

    // Curvature from how much the tangent swings over the distance it swings in.
    const curvatures = positions.map((position, i) => {
        const previous = positions[(i - 1 + count) % count];
        const next = positions[(i + 1) % count];
        const incoming = sub(position, previous);
        const outgoing = sub(next, position);
        const span = (length(incoming) + length(outgoing)) / 2;
        if (span < 1e-6) {
            return 0;
        }
        const cosine = clamp(
            (incoming[0] * outgoing[0] + incoming[1] * outgoing[1] + incoming[2] * outgoing[2]) /
                Math.max(1e-9, length(incoming) * length(outgoing)),
            -1,
            1,
        );
        return Math.acos(cosine) / span;
    });

    return { positions, segment_lengths, curvatures, total_length, count };
}

//------------------------------------------------------------------------------
// The speed the vehicle may hold at each sample, then how long the lap takes.
//
// Sample 0 is the pad/stop the circuit starts and ends on, so the profile is
// pinned to zero there — which is what makes the recording loop seamlessly. The
// forward pass caps acceleration out of every sample, the backward pass caps
// braking into every sample, and the pair leaves a profile that respects the
// cornering limit without ever demanding more grip or power than the vehicle has.
//------------------------------------------------------------------------------
function buildSpeedProfile({
    track,
    limits,
    stop_samples,
}: {
    track: Track;
    limits: Limits;
    stop_samples: Array<number>;
}): SpeedProfile {
    const { segment_lengths, curvatures, count } = track;

    // Two reasons a corner is taken slowly: the grip (or lift) it would take to
    // hold the line, and how fast the vehicle can turn to face along it.
    const speeds = curvatures.map(curvature =>
        Math.min(
            limits.max_speed,
            Math.sqrt(limits.lateral_acceleration / Math.max(curvature, 1e-6)),
            limits.max_yaw_rate / Math.max(curvature, 1e-6),
        ),
    );
    for (const sample of stop_samples) {
        speeds[sample] = 0;
    }
    speeds[0] = 0;

    // Two passes over the closed loop, both anchored on the zero at sample 0.
    for (let i = 1; i < count; ++i) {
        speeds[i] = Math.min(
            speeds[i],
            Math.sqrt(speeds[i - 1] ** 2 + 2 * limits.acceleration * segment_lengths[i - 1]),
        );
    }
    for (let i = count - 1; i >= 0; --i) {
        const next = (i + 1) % count;
        speeds[i] = Math.min(speeds[i], Math.sqrt(speeds[next] ** 2 + 2 * limits.braking * segment_lengths[i]));
    }

    // Time to cross each segment at the mean of its endpoint speeds.
    const segment_durations = segment_lengths.map((distance, i) => {
        const mean_speed = (speeds[i] + speeds[(i + 1) % count]) / 2;
        return distance / Math.max(mean_speed, 1e-3);
    });

    return {
        speeds,
        segment_durations,
        moving_duration: segment_durations.reduce((sum, dt) => sum + dt, 0),
    };
}

//------------------------------------------------------------------------------
// Walks the circuit in time and returns one position per frame.
//
// The lap is stretched to fill `duration` exactly — stretching only ever slows a
// vehicle down, so a profile that was within its limits still is. A `stop` holds
// the vehicle at its sample: time passes there while it does not move.
//------------------------------------------------------------------------------
function sampleTrajectory({
    track,
    profile,
    stops,
    duration,
    frame_count,
}: {
    track: Track;
    profile: SpeedProfile;
    stops: Array<Stop>;
    duration: number;
    frame_count: number;
}): Array<Vec3> {
    const { positions, count } = track;
    const dwell_total = stops.reduce((sum, stop) => sum + stop.dwell, 0);
    const stretch = (duration - dwell_total) / profile.moving_duration;
    if (stretch < 1) {
        throw new Error(
            `The circuit cannot be driven in ${duration}s: it needs ` +
                `${(profile.moving_duration + dwell_total).toFixed(1)}s at the given limits`,
        );
    }

    // Time at which each sample is reached, dwells included.
    const dwell_by_sample = new Map(stops.map(stop => [stop.sample, stop.dwell]));
    const arrival_times = new Array<number>(count);
    let clock = 0;
    for (let i = 0; i < count; ++i) {
        arrival_times[i] = clock;
        clock += dwell_by_sample.get(i) ?? 0;
        clock += profile.segment_durations[i] * stretch;
    }

    const frames: Array<Vec3> = [];
    let sample = 0;
    for (let frame = 0; frame < frame_count; ++frame) {
        const time = (frame / frame_count) * duration;
        while (sample + 1 < count && arrival_times[sample + 1] <= time) {
            ++sample;
        }
        const departure = arrival_times[sample] + (dwell_by_sample.get(sample) ?? 0);
        const from = positions[sample];
        const to = positions[(sample + 1) % count];
        const travel = Math.max(1e-9, profile.segment_durations[sample] * stretch);
        const t = clamp((time - departure) / travel, 0, 1);
        frames.push([lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]);
    }
    return frames;
}

//------------------------------------------------------------------------------
// Central differences over a periodic signal: the derivative at the seam is as
// valid as anywhere else, which is what keeps the loop free of a jolt.
//------------------------------------------------------------------------------
function differentiate(frames: Array<Vec3>, dt: number): Array<Vec3> {
    const count = frames.length;
    return frames.map((_, i) => scale(sub(frames[(i + 1) % count], frames[(i - 1 + count) % count]), 1 / (2 * dt)));
}

//------------------------------------------------------------------------------
// A circular low-pass over angles, applied through the shortest way round so it
// survives the ±π seam and the full turn a closed circuit accumulates.
//------------------------------------------------------------------------------
function smoothAngles(
    angles: Array<number>,
    { passes, strength = 0.25 }: { passes: number; strength?: number },
): Array<number> {
    const count = angles.length;
    let current = angles.slice();
    for (let pass = 0; pass < passes; ++pass) {
        current = current.map((angle, i) => {
            const previous = current[(i - 1 + count) % count];
            const following = current[(i + 1) % count];
            return angle + strength * wrapAngle(previous - angle) + strength * wrapAngle(following - angle);
        });
    }
    return current.map(wrapAngle);
}

//------------------------------------------------------------------------------
// The same, for a signal that does not wrap.
//------------------------------------------------------------------------------
function smoothScalars(
    values: Array<number>,
    { passes, strength = 0.25 }: { passes: number; strength?: number },
): Array<number> {
    const count = values.length;
    let current = values.slice();
    for (let pass = 0; pass < passes; ++pass) {
        current = current.map(
            (value, i) =>
                value +
                strength * (current[(i - 1 + count) % count] - value) +
                strength * (current[(i + 1) % count] - value),
        );
    }
    return current;
}

//------------------------------------------------------------------------------
// The heading held at every frame. The engine is Y up with +Z forward, so a yaw
// of 0 points down +Z and grows toward +X — the convention the recorded `yaw` is
// read back with by `orientationQuaternion()` in the sample.
//
// A vehicle standing still has no direction of travel, so it keeps the one it
// had. The walk starts at the first frame that *is* moving and wraps around the
// end, so the frames parked on the pad at the seam hold the heading the vehicle
// arrived with — which a closed circuit makes the one it leaves with.
//------------------------------------------------------------------------------
const MOVING_SPEED = 0.15;

function headingsAlong(velocities: Array<Vec3>): Array<number> {
    const count = velocities.length;
    const first = velocities.findIndex(v => Math.hypot(v[0], v[2]) >= MOVING_SPEED);
    if (first === -1) {
        return velocities.map(() => 0);
    }

    const headings = new Array<number>(count);
    let heading = Math.atan2(velocities[first][0], velocities[first][2]);
    for (let step = 0; step < count; ++step) {
        const i = (first + step) % count;
        const velocity = velocities[i];
        if (Math.hypot(velocity[0], velocity[2]) >= MOVING_SPEED) {
            heading = Math.atan2(velocity[0], velocity[2]);
        }
        headings[i] = heading;
    }
    return headings;
}

//------------------------------------------------------------------------------
// Telemetry, all of it read off the trajectory that is already computed.
//------------------------------------------------------------------------------

/** How close to its dock a vehicle has to be for a standstill to count as one. */
const DOCK_RADIUS = 2;

//------------------------------------------------------------------------------
// Frames where the vehicle is standing still *on its dock* — its charger. The
// forklift's is where its circuit starts, a drone's is its pad. This is what
// tells a loading stop apart from a charging one, and where the battery is
// allowed to recover.
//------------------------------------------------------------------------------
function dockedFrames({
    frames,
    speeds,
    dock,
}: {
    frames: Array<Vec3>;
    speeds: Array<number>;
    dock: Vec3;
}): Array<boolean> {
    return frames.map(
        (position, i) =>
            speeds[i] < MOVING_SPEED && Math.hypot(position[0] - dock[0], position[2] - dock[2]) < DOCK_RADIUS,
    );
}

//------------------------------------------------------------------------------
// The standstills, as runs of frame indices, walked from the first moving frame
// so the run straddling the seam comes back as one run rather than two.
//------------------------------------------------------------------------------
function stoppedRuns(speeds: Array<number>): Array<Array<number>> {
    const count = speeds.length;
    const stopped = speeds.map(speed => speed < MOVING_SPEED);
    const first_moving = stopped.findIndex(is_stopped => !is_stopped);
    if (first_moving === -1) {
        return [Array.from({ length: count }, (_, i) => i)];
    }

    const runs: Array<Array<number>> = [];
    let run: Array<number> | null = null;
    for (let step = 0; step < count; ++step) {
        const i = (first_moving + step) % count;
        if (!stopped[i]) {
            run = null;
            continue;
        }
        if (run === null) {
            run = [];
            runs.push(run);
        }
        run.push(i);
    }
    return runs;
}

//------------------------------------------------------------------------------
// Whether a frame falls in the [from, to) arc of the lap, the wrap around the
// seam included.
//------------------------------------------------------------------------------
function isWithinArc(i: number, from: number, to: number): boolean {
    return from <= to ? i >= from && i < to : i >= from || i < to;
}

//------------------------------------------------------------------------------
// The battery, over one lap, ending exactly where it started.
//
// Two quantities are accumulated: what the motion costs, and the time spent on
// the charger. Each is normalized by its own total, so both run 0 → 1 over the
// lap whatever the constants are, and their difference is periodic by
// construction — no choice of drain rate can make the loop jump. That difference
// is then stretched onto [full - depth, full]: the pack is at its fullest as the
// vehicle leaves the dock and at its lowest as it comes back.
//------------------------------------------------------------------------------
const IDLE_DRAW = 1.5;

function batteryLevels({
    speeds,
    docked,
    full,
    depth,
}: {
    speeds: Array<number>;
    docked: Array<boolean>;
    full: number;
    depth: number;
}): Array<number> {
    const cost = speeds.map((speed, i) => (docked[i] ? 0 : IDLE_DRAW + speed));
    const gain: Array<number> = docked.map(is_docked => (is_docked ? 1 : 0));
    const cost_total = Math.max(
        cost.reduce((sum, value) => sum + value, 0),
        1e-9,
    );
    const gain_total = Math.max(
        gain.reduce((sum, value) => sum + value, 0),
        1e-9,
    );

    const signal: Array<number> = [];
    let drained = 0;
    let charged = 0;
    for (let i = 0; i < speeds.length; ++i) {
        signal.push(charged / gain_total - drained / cost_total);
        drained += cost[i];
        charged += gain[i];
    }

    const top = Math.max(...signal);
    const span = Math.max(top - Math.min(...signal), 1e-9);
    return signal.map(value => full - ((top - value) / span) * depth);
}

//------------------------------------------------------------------------------
// Waypoints spread over the floor, ordered around their centroid so the circuit
// they close never crosses itself.
//------------------------------------------------------------------------------
function sampleCircuit({
    random,
    count,
    altitude,
    min_spacing,
    keep_clear = [],
}: {
    random: () => number;
    count: number;
    altitude: number | ((draw: () => number) => number);
    min_spacing: number;
    keep_clear?: Array<{ point: Vec3; radius: number }>;
}): Array<Vec3> {
    const points: Array<Vec3> = [];
    for (let attempt = 0; points.length < count && attempt < 4000; ++attempt) {
        const candidate: Vec3 = [
            (random() * 2 - 1) * (BOUNDS.x - MARGIN),
            typeof altitude === "function" ? altitude(random) : altitude,
            (random() * 2 - 1) * (BOUNDS.z - MARGIN),
        ];
        const flat = (other: Vec3): number => Math.hypot(candidate[0] - other[0], candidate[2] - other[2]);
        if (points.some(point => flat(point) < min_spacing)) {
            continue;
        }
        if (keep_clear.some(({ point, radius }) => flat(point) < radius)) {
            continue;
        }
        points.push(candidate);
    }
    if (points.length < count) {
        throw new Error("Could not place the circuit waypoints");
    }

    const total = points.reduce((sum, point) => add(sum, point), [0, 0, 0] as Vec3);
    const centroid = scale(total, 1 / points.length);
    return points.sort(
        (a, b) =>
            Math.atan2(a[0] - centroid[0], a[2] - centroid[2]) - Math.atan2(b[0] - centroid[0], b[2] - centroid[2]),
    );
}

//------------------------------------------------------------------------------
// The forklift: a ground vehicle, so its yaw *is* the direction it travels in.
//------------------------------------------------------------------------------
const PALLET_KG = 850;
const MAST_HEIGHT = 1.6;

function buildForklift({ seed, pads }: { seed: number; pads: Array<Vec3> }): Vehicle {
    const random = mulberry32(seed);
    const waypoints = sampleCircuit({
        random,
        count: 5,
        altitude: 0,
        min_spacing: 8,
        keep_clear: pads.map(pad => ({ point: pad, radius: 4 })),
    });

    const track = buildTrack({ waypoints });
    const limits: Limits = {
        max_speed: 3.2,
        acceleration: 1.5,
        braking: 2,
        lateral_acceleration: 2.6,
        max_yaw_rate: 1,
    };

    // Two loading stops besides the one the lap starts on.
    const stop_samples = [Math.round(track.count / 3), Math.round((2 * track.count) / 3)];
    const profile = buildSpeedProfile({ track, limits, stop_samples });
    const stops: Array<Stop> = [
        { sample: 0, dwell: 1.2 },
        { sample: stop_samples[0], dwell: 0.9 },
        { sample: stop_samples[1], dwell: 0.7 },
    ];

    return {
        channel: "vehicles/forklift-01/telemetry",
        track,
        profile,
        stops,
        minimum_duration: profile.moving_duration + stops.reduce((sum, stop) => sum + stop.dwell, 0),

        //----------------------------------------------------------------------
        pose({ frames, dt }: PoseParams): Array<Pose> {
            const velocities = differentiate(frames, dt);
            const yaws = smoothAngles(headingsAlong(velocities), { passes: 4 });
            const speeds = velocities.map(length);

            // Its circuit starts on the charger, so sample 0 is the dock. Every
            // other standstill is a pallet being handled.
            const docked = dockedFrames({ frames, speeds, dock: track.positions[0] });
            const loading = stoppedRuns(speeds).filter(run => !docked[run[0]]);
            const batteries = batteryLevels({ speeds, docked, full: 100, depth: 34 });

            // A pallet is picked up halfway through the first loading stop and
            // put down halfway through the second, so the lap ends empty, the
            // way it began.
            const [pick_up, put_down] = loading.map(run => run[Math.floor(run.length / 2)]);

            // The mast goes up and back down over each loading stop.
            const masts = frames.map(() => 0);
            for (const run of loading) {
                run.forEach((i, step) => {
                    const progress = (step + 0.5) / run.length;
                    masts[i] = MAST_HEIGHT * (1 - Math.abs(2 * progress - 1));
                });
            }

            return frames.map((position, i) => ({
                pos: [position[0], 0, position[2]] as Vec3,
                yaw: yaws[i],
                speed: speeds[i],
                battery: batteries[i],
                state: docked[i] ? "charging" : speeds[i] < MOVING_SPEED ? "loading" : "driving",
                load: loading.length === 2 && isWithinArc(i, pick_up, put_down) ? PALLET_KG : 0,
                mast: masts[i],
            }));
        },
    };
}

//------------------------------------------------------------------------------
// A drone: same circuit machinery, plus altitude, plus an attitude read off its
// own acceleration — it leans into a turn and noses down to accelerate, the way
// a multirotor has to in order to produce that acceleration at all.
//------------------------------------------------------------------------------
/** Percent of signal lost per metre flown away from the pad. */
const LINK_FALLOFF = 2.2;

/** Link never reads below this — a real radio still carries *something*. */
const LINK_FLOOR = 5;

/** The vertical speed that separates climbing and descending from level flight. */
const CLIMB_SPEED = 0.6;

/** Below this altitude a climb is a takeoff and a descent a landing. */
const PAD_CEILING = 1.5;

// The closed spline puts the pad (altitude 0) right next to cruise-height
// waypoints, so the segment between them glides down/up gradually across its
// whole length — the drone can end up near the ground far from its own pad,
// anywhere that glide happens to cross another vehicle's path. A floor that
// only relaxes close to the pad keeps the cruise legs at a safe height and
// leaves the actual landing flare (and the at-rest start/end frame) alone.
/** Cruise height maintained away from the pad — clears the forklift and its mast. */
const CRUISE_FLOOR = 3;
/** Radius around the pad over which the floor relaxes to 0, for a normal landing. */
const APPROACH_RADIUS = 3;

//------------------------------------------------------------------------------
// What the drone would call itself. On the pad it charges; off it the vertical
// speed says whether it is going up, coming down or holding a height, and the
// altitude says whether that is a takeoff or just a leg flown at a new height.
//------------------------------------------------------------------------------
function droneState({
    is_docked,
    speed,
    climb,
    altitude,
}: {
    is_docked: boolean;
    speed: number;
    climb: number;
    altitude: number;
}): string {
    if (is_docked) {
        return "charging";
    }
    if (climb > CLIMB_SPEED) {
        return altitude < PAD_CEILING ? "takeoff" : "climbing";
    }
    if (climb < -CLIMB_SPEED) {
        return altitude < PAD_CEILING ? "landing" : "descending";
    }
    return speed < MOVING_SPEED ? "hover" : "cruise";
}

function buildDrone({
    id,
    seed,
    pad,
    altitude_band,
    bob,
    battery_depth = 42,
    link_falloff = LINK_FALLOFF,
    far_stop_dwell = 1.5,
}: {
    id: string;
    seed: number;
    pad: Vec3;
    altitude_band: [number, number];
    bob: { amplitude: number; cycles: number; phase: number };
    /** How far the pack drains below `full` over the lap. Raised on drone-01 so the sample has a vehicle that dips into the red. */
    battery_depth?: number;
    /** How much link a metre of distance costs. Steepened on drone-02 so its farthest point reads clearly red. */
    link_falloff?: number;
    /** Dwell at the circuit's one hover, placed where it is farthest from the pad — a real radio would be weakest right there. Stretched on drone-02 so the resulting dropout holds for a while. */
    far_stop_dwell?: number;
}): Vehicle {
    const random = mulberry32(seed);
    const waypoints = sampleCircuit({
        random,
        count: 5,
        altitude: draw => lerp(altitude_band[0], altitude_band[1], draw()),
        min_spacing: 8,
        keep_clear: [{ point: pad, radius: 6 }],
    });

    // The pad closes the circuit: the lap begins and ends on the ground, at rest.
    const track = buildTrack({ waypoints: [pad, ...waypoints] });
    const limits: Limits = {
        max_speed: 7,
        acceleration: 3.5,
        braking: 3.5,
        lateral_acceleration: 4.5,
        max_yaw_rate: 1.8,
    };

    // One hover, at the point of the circuit farthest from the pad.
    const farthest_sample = track.positions.reduce(
        (best, position, i) => (length(sub(position, pad)) > length(sub(track.positions[best], pad)) ? i : best),
        0,
    );
    const stop_samples = [farthest_sample];
    const profile = buildSpeedProfile({ track, limits, stop_samples });
    const stops: Array<Stop> = [
        { sample: 0, dwell: 1.2 },
        { sample: stop_samples[0], dwell: far_stop_dwell },
    ];

    return {
        channel: `vehicles/${id}/telemetry`,
        track,
        profile,
        stops,
        minimum_duration: profile.moving_duration + stops.reduce((sum, stop) => sum + stop.dwell, 0),

        //----------------------------------------------------------------------
        pose({ frames, dt, duration }: PoseParams): Array<Pose> {
            // A slow vertical bob, at a whole number of cycles per lap so the
            // recording still closes on itself, faded out near the ground. The
            // cruise floor keeps the glide to/from the pad from dipping to
            // ground level until it is actually close enough to land.
            const bobbed = frames.map((position, i): Vec3 => {
                const horizontal = Math.hypot(position[0] - pad[0], position[2] - pad[2]);
                const floor = CRUISE_FLOOR * clamp(horizontal / APPROACH_RADIUS, 0, 1);
                const base = Math.max(position[1], floor);
                const time = (i / frames.length) * duration;
                const fade = clamp(base / 1.5, 0, 1);
                const offset = bob.amplitude * Math.sin((2 * Math.PI * bob.cycles * time) / duration + bob.phase);
                return [position[0], clamp(base + offset * fade, 0, BOUNDS.altitude), position[2]];
            });

            const velocities = differentiate(bobbed, dt);
            const accelerations = differentiate(velocities, dt);
            const yaws = smoothAngles(headingsAlong(velocities), { passes: 6 });

            // Bank and tilt are what the horizontal acceleration costs: the rotor
            // disc has to point away from vertical for the drone to accelerate.
            const rolls = smoothScalars(
                accelerations.map((acceleration, i) => {
                    const right: Vec3 = [Math.cos(yaws[i]), 0, -Math.sin(yaws[i])];
                    const lateral = acceleration[0] * right[0] + acceleration[2] * right[2];
                    return clamp(-Math.atan2(lateral, GRAVITY), -0.5, 0.5);
                }),
                { passes: 8 },
            );
            const pitches = smoothScalars(
                accelerations.map((acceleration, i) => {
                    const forward: Vec3 = [Math.sin(yaws[i]), 0, Math.cos(yaws[i])];
                    const along = acceleration[0] * forward[0] + acceleration[2] * forward[2];
                    return clamp(Math.atan2(along, GRAVITY), -0.35, 0.35);
                }),
                { passes: 8 },
            );

            const speeds = velocities.map(length);
            const docked = dockedFrames({ frames: bobbed, speeds, dock: pad });
            const batteries = batteryLevels({ speeds, docked, full: 100, depth: battery_depth });

            return bobbed.map((position, i) => ({
                pos: position,
                yaw: yaws[i],
                pitch: pitches[i],
                roll: rolls[i],
                speed: speeds[i],
                battery: batteries[i],
                state: droneState({
                    is_docked: docked[i],
                    speed: speeds[i],
                    climb: velocities[i][1],
                    altitude: position[1],
                }),
                alt: position[1],
                // The link to the pad, worse the further out it flies. A pure
                // function of the position, so it closes with the circuit.
                link: clamp(100 - link_falloff * length(sub(position, pad)), LINK_FLOOR, 100),
            }));
        },
    };
}

//------------------------------------------------------------------------------
const PADS: Record<string, Vec3> = {
    "drone-01": [-8.5, 0, -13],
    "drone-02": [8.5, 0, 13],
};

const vehicles: Array<Vehicle> = [
    buildForklift({ seed: 20260101, pads: Object.values(PADS) }),
    buildDrone({
        id: "drone-01",
        seed: 77002,
        pad: PADS["drone-01"],
        altitude_band: [2.5, 5.5],
        bob: { amplitude: 0.18, cycles: 5, phase: 0 },
        battery_depth: 85,
    }),
    buildDrone({
        id: "drone-02",
        seed: 31337,
        pad: PADS["drone-02"],
        altitude_band: [6.5, 9],
        bob: { amplitude: 0.14, cycles: 7, phase: Math.PI / 3 },
        link_falloff: 2.6,
        far_stop_dwell: 5.5,
    }),
];

// One duration for the whole recording — the slowest lap, rounded up to a whole
// second. Every vehicle is then stretched to fill it, which only ever slows one
// down, so nobody ends up cornering harder than its limits allow.
const DURATION_S = Math.ceil(Math.max(...vehicles.map(vehicle => vehicle.minimum_duration)));
const FRAME_COUNT = DURATION_S * RATE_HZ;
const DT = DURATION_S / FRAME_COUNT;

//==============================================================================
// The arm: a stationary 4-DOF FANUC-style arm, its four pivots each reporting
// only their own angle. Unlike a vehicle it never leaves its base, so there is
// no track, profile or trajectory to build — a pivot's whole motion is one
// periodic angle, closing over the shared `DURATION_S` by construction: `sin` at
// a whole multiple of its own period returns to the same value *and* the same
// slope, so the loop is seamless with no dwell logic needed.
//
// One event per axis per frame, on the arm's own channel — not one event
// carrying all four — because that is what puts the pivot id in the *payload*
// rather than the channel. It is what the sample's `byUuid` mapping exists to
// demonstrate: an id read from inside an event, driving an entity that already
// exists in the scene rather than one the ingestion spawns.
//==============================================================================
const ARM_ID = "fanuc-01";
const ARM_CHANNEL = `arms/${ARM_ID}/joint`;

type ArmAxis = {
    axis: number;
    /** Sweep, in radians. */
    range: [number, number];
    /** Whole periods over the recording's duration, so the sweep closes with it. */
    cycles: number;
    phase: number;
    /** Sanity limit checked below, not enforced: a real joint's own rated speed. */
    max_rate: number;
};

// Base swings the widest and slowest; each joint out towards the wrist covers
// less angle but turns faster — the way an arm's own inertia budget works.
const ARM_AXES: Array<ArmAxis> = [
    { axis: 0, range: [-1.2, 1.2], cycles: 1, phase: 0, max_rate: 1.5 },
    { axis: 1, range: [0.5, 1.2], cycles: 1, phase: Math.PI / 6, max_rate: 1.2 },
    { axis: 2, range: [-1.6, 0.2], cycles: 1, phase: Math.PI / 3, max_rate: 1.6 },
    { axis: 3, range: [-0.5, 1.5], cycles: 2, phase: Math.PI / 2, max_rate: 2.5 },
];

function armAngle(joint: ArmAxis, time: number): number {
    const center = (joint.range[0] + joint.range[1]) / 2;
    const amplitude = (joint.range[1] - joint.range[0]) / 2;
    return center + amplitude * Math.sin((2 * Math.PI * joint.cycles * time) / DURATION_S + joint.phase);
}

// The rate `armAngle` peaks at: the derivative of a sine is a cosine of the same
// amplitude and frequency, maximal at 1.
function armPeakRate(joint: ArmAxis): number {
    const amplitude = (joint.range[1] - joint.range[0]) / 2;
    return (amplitude * 2 * Math.PI * joint.cycles) / DURATION_S;
}

//------------------------------------------------------------------------------
const round = (value: number): number => {
    const rounded = Math.round(value * 1000) / 1000;
    return Object.is(rounded, -0) ? 0 : rounded;
};

const events: Array<RecordedEvent> = [];
const poses_by_channel = new Map<string, Array<Pose>>();

for (const vehicle of vehicles) {
    const frames = sampleTrajectory({
        track: vehicle.track,
        profile: vehicle.profile,
        stops: vehicle.stops,
        duration: DURATION_S,
        frame_count: FRAME_COUNT,
    });
    poses_by_channel.set(vehicle.channel, vehicle.pose({ frames, dt: DT, duration: DURATION_S }));
}

for (let frame = 0; frame < FRAME_COUNT; ++frame) {
    const timestamp = new Date(EPOCH + Math.round((frame * 1000) / RATE_HZ)).toISOString();
    for (const vehicle of vehicles) {
        const pose = poses_by_channel.get(vehicle.channel)![frame];
        const payload: VehiclePayload = {
            pos: pose.pos.map(round),
            yaw: round(pose.yaw),
            speed: round(pose.speed),
            battery: Math.round(pose.battery),
            state: pose.state,
        };
        if (pose.pitch !== undefined && pose.roll !== undefined) {
            payload.pitch = round(pose.pitch);
            payload.roll = round(pose.roll);
        }
        if (pose.load !== undefined && pose.mast !== undefined) {
            payload.load = Math.round(pose.load);
            payload.mast = round(pose.mast);
        }
        if (pose.alt !== undefined && pose.link !== undefined) {
            payload.alt = round(pose.alt);
            payload.link = Math.round(pose.link);
        }
        events.push({ channel: vehicle.channel, timestamp, payload });
    }

    const time = (frame / FRAME_COUNT) * DURATION_S;
    for (const joint of ARM_AXES) {
        events.push({
            channel: ARM_CHANNEL,
            timestamp,
            payload: { axis: joint.axis, angle: round(armAngle(joint, time)) },
        });
    }
}

//------------------------------------------------------------------------------
// One event per line, so the sample can map an event index onto a line number in
// the panel that displays this very file.
//------------------------------------------------------------------------------
const text = `[\n${events.map(event => `    ${JSON.stringify(event)}`).join(",\n")}\n]\n`;
const output = resolve(process.cwd(), process.argv[2] ?? DEFAULT_OUTPUT);
writeFileSync(output, text);

//------------------------------------------------------------------------------
// Report, and check what the sample relies on: the volume, a loop that comes back
// to where it started, and telemetry that comes back to the level it started at.
//------------------------------------------------------------------------------
console.log(
    `${output}\n${events.length} events, ${DURATION_S}s at ${RATE_HZ} Hz, ` +
        `${vehicles.length} vehicles + 1 arm (${ARM_AXES.length} axes)`,
);

for (const vehicle of vehicles) {
    const poses = poses_by_channel.get(vehicle.channel)!;
    const positions = poses.map(pose => pose.pos);
    const extent = (axis: number): number => Math.max(...positions.map(position => Math.abs(position[axis])));
    const altitude = Math.max(...positions.map(position => position[1]));
    const speeds = positions.map((position, i) => length(sub(positions[(i + 1) % positions.length], position)) / DT);
    const seam = length(sub(positions[0], positions[positions.length - 1]));

    const batteries = poses.map(pose => pose.battery);
    const battery_seam = Math.abs(batteries[0] - batteries[batteries.length - 1]);
    const states = new Map<string, number>();
    for (const pose of poses) {
        states.set(pose.state, (states.get(pose.state) ?? 0) + 1);
    }

    console.log(
        `  ${vehicle.channel.padEnd(36)} ` +
            `|x| ${extent(0).toFixed(1)}  |z| ${extent(2).toFixed(1)}  ` +
            `y ${altitude.toFixed(1)}  max ${Math.max(...speeds).toFixed(1)} m/s  ` +
            `lap ${vehicle.minimum_duration.toFixed(1)}s  seam ${(seam * 100).toFixed(0)} cm\n` +
            `  ${"".padEnd(36)} ` +
            `battery ${Math.min(...batteries).toFixed(0)}..${Math.max(...batteries).toFixed(0)}% ` +
            `(seam ${battery_seam.toFixed(1)})  ` +
            Array.from(states, ([state, count]) => `${state} ${((100 * count) / poses.length).toFixed(0)}%`).join("  "),
    );

    if (extent(0) > BOUNDS.x || extent(2) > BOUNDS.z || altitude > BOUNDS.altitude) {
        console.warn(`  ! ${vehicle.channel} leaves the volume`);
    }
    if (seam > 0.25) {
        console.warn(`  ! ${vehicle.channel} does not close its loop`);
    }
    if (battery_seam > 1) {
        console.warn(`  ! ${vehicle.channel} does not close its battery cycle`);
    }
}

for (const joint of ARM_AXES) {
    const peak_rate = armPeakRate(joint);
    console.log(
        `  ${`${ARM_CHANNEL} axis ${joint.axis}`.padEnd(36)} ` +
            `range [${joint.range[0].toFixed(1)}, ${joint.range[1].toFixed(1)}] rad  ` +
            `peak ${peak_rate.toFixed(2)} rad/s  cycles ${joint.cycles}`,
    );
    if (peak_rate > joint.max_rate) {
        console.warn(`  ! ${ARM_CHANNEL} axis ${joint.axis} exceeds its rated ${joint.max_rate} rad/s`);
    }
}
