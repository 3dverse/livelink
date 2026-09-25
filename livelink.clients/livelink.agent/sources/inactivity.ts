//------------------------------------------------------------------------------
import type { ActivityWatcher } from "@3dverse/livelink.core";

/**
 * The longest timeout the core's activity watcher can hold, in seconds.
 *
 * The watcher hands `seconds * 1000` to `setTimeout`, whose delay is a signed 32-bit integer: past
 * 2^31 - 1 ms Node warns (`TimeoutOverflowWarning`) and fires the timer at once. So "never" is
 * spelled as the largest delay that does not overflow — a little under 25 days, longer than any
 * session a gateway keeps.
 */
export const MAX_INACTIVITY_TIMEOUT_SECONDS = Math.floor((2 ** 31 - 1) / 1000);

/**
 * Turns off the core's inactivity disconnect for an agent connection.
 *
 * The watcher exists for people: a browser client that has sent nothing but heartbeats for six
 * minutes (its defaults: a warning at 300 s, disconnection at 360 s) is a user who walked away, and
 * the gateway gets its seat back. An agent has no user to walk away, and a connection that only
 * *receives* — a {@link CameraStream} on a non-headless client, which sends nothing after its
 * setup — looks exactly like one: it was being disconnected six minutes after joining, with
 * `"inactivity"` as the reason. Whether an agent should leave a session is {@link Agent}'s
 * `leave_on_condition` policy, not a timer counting messages.
 *
 * The watcher has no "off" switch, only timeouts, so both are pushed to the largest value its
 * timers can hold ({@link MAX_INACTIVITY_TIMEOUT_SECONDS}); setting them resets a watcher that is
 * already running.
 */
export function disableInactivityTimeout(activity_watcher: ActivityWatcher): void {
    activity_watcher.setTimeouts({
        warn_after_seconds: MAX_INACTIVITY_TIMEOUT_SECONDS - 1,
        timeout_after_seconds: MAX_INACTIVITY_TIMEOUT_SECONDS,
    });
}
