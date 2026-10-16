# Back Bending Monitor

A worker is tracked by a body capture, and each forward bend of their back is assessed in real time, on their body:
how far they bend, for how long, how often, and what makes the bend more harmful. When a bend is held too long, an
alert is raised and counted for the day.

It is a screening aid built on ergonomics standards, not a diagnosis. The thresholds below say where each one comes
from, and which ones are indicative defaults to adjust with an occupational health professional.

## What is measured

The angles are measured from the landmarks a body capture tracks, as an ergonomist would measure them on a video:

- the hip joints, left and right;
- the spine at its pivots: its base at the hips, the waist, the chest, and the base of the neck (C7);
- the shoulders, the knees and the ankles.

All angles are relative to the upright standing posture of the person, measured once as a calibration, as motion
capture systems do on a neutral pose: the landmarks of the spine aren't aligned at rest, and differ from one person to
the next.

| Angle                 | Measured between                                                                                                       | What it tells                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Trunk inclination** | The trunk line, from the hip joint center to the base of the neck, and the vertical, in the sagittal plane. + forward. | The angle the standards assess: what the lower back holds against gravity, whether the bend comes from the hips or from the spine. |
| **Lumbar flexion**    | The pelvis, from the hip joint center to the base of the spine, and the spine above the waist.                         | How much of the bend comes from rounding the lower back rather than tilting the pelvis at the hips.                                |
| **Thoracic flexion**  | The spine below the chest and the spine above it, up to the base of the neck.                                          | Hunching of the upper back.                                                                                                        |
| **Knee flexion**      | The thigh and the shin, mean of both legs. 0 for straight legs.                                                        | A stoop, legs straight, or a squat.                                                                                                |
| **Twist**             | The line of the shoulders and the line of the hips, around the trunk.                                                  | Turning while bent.                                                                                                                |
| **Side bend**         | The trunk line and the sagittal plane.                                                                                 | Leaning sideways while bent.                                                                                                       |

### Why the trunk inclination, and not the angle of a spine bone

The angle of a bone of the spine relative to the pelvis misses the most common way of bending: tilting the pelvis at
the hips. A worker hinging at the hips with a straight back would read 0°, while their lower back holds the whole trunk
leaning forward. The trunk inclination, against gravity, reads the load whatever the joint it comes from. The lumbar
flexion then tells how it is shared between the hips and the lower back.

## How harmful bending is judged

### 1. How far: the zones of trunk inclination

EN 1005-4 and ISO 11226 rate the trunk inclination in three zones:

| Inclination      | Assessment                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| 0° to 20°        | Acceptable                                                                                                    |
| 20° to 60°       | Conditionally acceptable: depends on how long and how often it is held, and on whether the trunk is supported |
| Over 60°         | Not acceptable                                                                                                |
| Leaning backward | Only acceptable with the trunk supported                                                                      |

### 2. How long: static postures

ISO 11226 and EN 1005-4 call a posture held for more than 4 s **static**. A static bend over 60° isn't acceptable: it
raises the alert. Between 20° and 60°, ISO 11226 gives the maximum time a posture can be held depending on its angle.

Sustained flexion also creeps the passive tissues of the back, the ligaments and the discs, which then protect it less,
and they take longer to recover than the time they were loaded.

### 3. How often: frequency

EN 1005-4 treats bending twice a minute or more as a high frequency, which makes a bend between 20° and 60°
less acceptable.

### 4. What makes a bend more harmful

- **A rounded lower back.** Bending in the lumbar spine rather than at the hips. Near the end of the range of the
  lumbar spine, the muscles of the back relax and the discs and ligaments carry the load. Wilke et al. measured
  the pressure in an L4–L5 disc at about 0.5 MPa standing relaxed and 1.1 MPa standing bent forward. Lifting 20 kg
  raised it to about 2.3 MPa with a rounded back, against 1.7 MPa with bent knees, close to the body.
- **Straight knees.** A stoop, legs straight, rather than a squat or a hip hinge with the knees bent.
- **A load in the hands.** REBA scores loads from 5 kg, and gives its highest score over 10 kg. The NIOSH lifting
  equation also accounts for how far the load is held from the body.
- **A twisted or side-bent trunk.** REBA adds to the score of a trunk that is twisted or bent sideways. Flexion
  combined with rotation is the classic strain on the discs.

### 5. Over the day

The monitor counts the alerts, the time spent over 60°, and the number of bends since the start of the day.

## Thresholds

"Standard" thresholds come from the references. "Indicative" ones are defaults to adjust for the task and the person.
Check the standards against their current editions before relying on them.

| Criterion                  | Threshold                                                                 | Source                                                                                    | Status                                      |
| -------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| Zones of trunk inclination | Acceptable to 20°, conditionally acceptable to 60°, not acceptable beyond | EN 1005-4, ISO 11226                                                                      | Standard                                    |
| Leaning backward           | Conditionally acceptable past 10°                                         | ISO 11226, with a 10° margin for the accuracy of the measurement and the sway of standing | Margin indicative                           |
| Static posture             | Held more than 4 s                                                        | ISO 11226, EN 1005-4                                                                      | Standard                                    |
| Hold limit over 60°        | 4 s                                                                       | A static posture isn't acceptable in this zone                                            | Standard                                    |
| Hold limit from 20° to 60° | 60 s                                                                      | ISO 11226 gives a holding time by angle                                                   | Indicative                                  |
| High frequency             | 2 bends a minute or more                                                  | EN 1005-4                                                                                 | Standard                                    |
| Rounded back               | Lumbar flexion of 30° or more                                             | About half of the usual range of the lumbar spine                                         | Indicative: measure the range of the person |
| Hunched upper back         | Thoracic flexion of 30° or more                                           | Shown only: it loads the neck and shoulders more than the lower back                      | Indicative                                  |
| Straight knees             | Knee flexion under 20° while bending                                      | Tells a stoop from a squat                                                                | Indicative                                  |
| Load                       | Moderate from 5 kg, heavy over 10 kg                                      | REBA                                                                                      | Method                                      |
| Asymmetric trunk           | Twist or side bend of 10° or more while bending                           | REBA counts any twist or side bend                                                        | Indicative tolerance                        |
| Zone hysteresis            | 2°                                                                        | Keeps the noise of the measurement from switching zones                                   | Implementation                              |
| Frequency window           | Bends over the last 60 s                                                  | —                                                                                         | Implementation                              |
| Accuracy shown             | ±5°                                                                       | Typical of a markerless body capture                                                      | Set it for the capture system               |

They are defined in `backBending.ts`: `TRUNK_INCLINATION_ZONES` and `BACK_BENDING_RULES`.

## How it is shown

The angle and the time are shown on separate scales: filling an angle as time passes would draw a duration on a scale
of degrees.

`DOM3DAngle` knows nothing of bodies: it shows an angle at its vertex, against zones, alerting when it is held too long. The
example gives it the trunk inclination, the zones of EN 1005-4 and a readout, and draws the spine over it.

- **The gauge**, from `DOM3DAngle`, lies in the sagittal plane at the hip joints, like a goniometer: a dashed
  plumb line for 0°, a scale graduated every 10° and colored by zone, green, amber and red, and the angle filled from
  0° in the color of its zone.
- **The vertex** is the hip joint center, the midpoint of the heads of the femurs, which is lower than the pelvis and
  the base of the spine: it is where the standards put the vertex of the trunk inclination.
- **The spine**, `SpineCurve.tsx`, is drawn by the example through 4 landmarks: its 3 pivots, at the hips, the waist
  and the chest, then the base of the neck, where the trunk line ends. An arc joins it to the vertex, from the hip
  joint center to the base of the spine. It faces the camera, over the gauge, takes the color of the zone of the
  trunk inclination, and is also the progress bar of the time held: in a zone with a hold limit, it fills from the hip
  joint center to the neck up to the limit, then pulses. Its shape shows a rounded back.
- **The needle** of `DOM3DAngle`, hidden by default with `showNeedle`, is the straight trunk line, from the hip
  joint center to the base of the neck, facing the camera, with the accuracy of the measurement around it. Next to it,
  the gap with the curve of the spine is the rounding of the back.
- **The readout**, `Readout.tsx`, optional, is given as `children` to `DOM3DAngle`, which shows it beside the
  hips: the value, its zone, the time held against the limit, and a vertical meter of the angle.
- **Seen from the front**, the gauge is edge-on and fades out. The spine, the needle and the readout are drawn facing
  the camera, so they keep reading from any side. Without the readout, the value and the time held are written above
  the spine.
- **The monitor panel** of the example lists every reading with its assessment, the exposure of the day, and the
  references. **The alert banner** above the worker says what triggered the alert and what made the bend more harmful.

## Using it with a body capture

The example drives a robot, but the measurement only needs the landmarks, in world space, y up:

```tsx
// Once, standing upright.
const neutral = measureTrunkPosture(standingLandmarks);

// At each frame.
const posture = measureTrunkPosture(landmarks, neutral);
const exposure = useAngleExposure({
  angleDeg: posture.trunkInclinationDeg,
  zones: BACK_BENDING_RULES.zones,
  holdLimits: BACK_BENDING_RULES.holdLimits,
  onAlert: alert => logAlert(alert, listAggravatingFactors({ posture, level: alert.level, loadKg, bendsPerMinute })),
});

<DOM3DOverlay>
  <DOM3DAngle
    worldPosition={posture.hipCenter}
    planeNormal={posture.lateralAxis}
    angleDeg={posture.trunkInclinationDeg}
    zones={BACK_BENDING_RULES.zones}
    exposure={exposure}
    needleLength={posture.trunkLength}
    scaleRange={TRUNK_INCLINATION_SCALE_RANGE}
    uncertaintyDeg={5}
    showNeedle={false}
  >
    <Readout
      label="Trunk inclination"
      angleDeg={posture.trunkInclinationDeg}
      uncertaintyDeg={5}
      exposure={exposure}
      zones={BACK_BENDING_RULES.zones}
      scaleRange={TRUNK_INCLINATION_SCALE_RANGE}
    />
  </DOM3DAngle>
  <SpineCurve
    hipCenter={posture.hipCenter}
    spinePoints={spinePoints(landmarks)}
    angleDeg={posture.trunkInclinationDeg}
    exposure={exposure}
    showValue={false}
  />
</DOM3DOverlay>;
```

| File                    | What it does                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `trunkPosture.ts`       | Measures the angles from the landmarks.                                                   |
| `backBending.ts`        | The zones, the rules, the aggravating factors, the points of the spine, and the scenario. |
| `bodyRig.ts`            | Poses the robot of the story and gives its landmarks, standing in for a body capture.     |
| `Readout.tsx`           | The readout beside the hips.                                                              |
| `SpineCurve.tsx`        | The spine, over the gauge, filling with the time held.                                    |
| `panels.tsx`            | The monitor panel and the alert banner.                                                   |
| `components/DOM3DAngle` | The gauge, for any angle, and `useAngleExposure`, which times the exposure against zones. |

## Limitations

- **Accuracy.** A markerless body capture measures joint angles to within about 5° to 10°, worse when joints are
  hidden. The spine is estimated from a few landmarks: lumbar and thoracic flexion are coarser than the trunk
  inclination.
- **Loads aren't seen.** The load has to be declared by the task, or measured otherwise. Neither is its distance from
  the body.
- **Ranges differ from one person to the next.** The thresholds of the rounded back and the hunched upper back
  should be set from the range of motion of the person, measured when calibrating.
- **Not every factor.** Speed and jerks of the movement, pauses and recovery, fatigue, medical history and
  psychosocial factors also matter, and aren't assessed.
- **Screening, not diagnosis.** An alert points at a posture to look at with an occupational health professional.

## References

- EN 1005-4:2005+A1:2008, Safety of machinery — Human physical performance — Part 4: Evaluation of working postures
  and movements in relation to machinery.
- ISO 11226:2000, Ergonomics — Evaluation of static working postures.
- Hignett S., McAtamney L. (2000). Rapid Entire Body Assessment (REBA). _Applied Ergonomics_, 31(2), 201–205.
- Waters T. R., Putz-Anderson V., Garg A., Fine L. J. (1993). Revised NIOSH equation for the design and evaluation of
  manual lifting tasks. _Ergonomics_, 36(7), 749–776.
- Wilke H.-J., Neef P., Caimi M., Hoogland T., Claes L. E. (1999). New in vivo measurements of pressures in the
  intervertebral disc in daily life. _Spine_, 24(8), 755–762.
- McGill S. _Low Back Disorders: Evidence-Based Prevention and Rehabilitation_. Human Kinetics.
