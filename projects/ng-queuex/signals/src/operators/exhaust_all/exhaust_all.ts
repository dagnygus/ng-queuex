import { Signal } from "@angular/core";
import { SignalOperatorFunction } from "../../common";
import { exhaustMapBase } from "../exhaust_map_base/exhaust_map_base";

/**
 * Flattens a signal of inner `Signal`s by subscribing to at most one inner
 * signal at a time and ignoring any new inner signals while the current one
 * is active.
 *
 * When the source signal produces an inner `Signal` and no other inner signal
 * is currently active, that inner signal becomes active and its values are
 * forwarded to the output. While an inner signal is active, further inner
 * signals produced by the source are ignored.
 *
 * The output signal has no value until the first active inner signal produces
 * a value. Once a value is produced, the output signal will never become
 * `undefined` again.
 *
 * @template T The type of values produced by inner signals.
 * @template U The type of values produced by the source signal.
 *
 * @returns {SignalOperatorFunction<U, undefined extends U ? T | undefined : T>}
 * A signal operator function that forwards values from the first active inner
 * signal and ignores overlapping inner signals.
 *
 * @remarks
 * - At most one inner signal is active at any time.
 * - Inner signals produced while another is active are ignored.
 * - `undefined` represents only the absence of an initial value.
 */
export function exhaustAll<T, U extends Signal<T> | undefined = Signal<T> | undefined>(): SignalOperatorFunction<U, undefined extends U ? T | undefined : T> {
  return exhaustMapBase<U, T>((s) => s, exhaustAll);
}
