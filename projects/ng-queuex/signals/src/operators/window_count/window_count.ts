import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../signals";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Splits the source signal into consecutive, non-overlapping windows,
 * each represented as an inner `Signal<T | undefined>`.
 * A new window is created after the source emits `windowSize` defined values.
 *
 * Each inner window starts with `undefined` and updates whenever the source emits.
 * When the window reaches `windowSize` defined values, it is closed and a new
 * window (with its own child cleanup scope) is opened automatically.
 *
 * @param windowSize
 * The number of **defined** source emissions that each window should collect
 * before it is closed and a new window is opened. Must be ≥ 1.
 *
 * @returns
 * An operator that emits a new inner signal whenever a window reaches the
 * specified size. Each inner signal reflects the values emitted while its
 * window is active.
 *
 * @example
 * ```ts
 * const src = signal<number | undefined>(undefined);
 *
 * const windows = signalPipe(
 *   src,
 *   [ windowCount(3) ]
 * );
 *
 * const w1 = windows(); // first window
 *
 * src.set(1);
 * src.set(2);
 * src.set(3); // w1 closes here, new window w2 is emitted
 * ```
 *
 * @remarks
 * - Each window is tied to its own **child cleanup scope**, and is disposed
 *   when it reaches `windowSize` values.
 * - Windows are strictly **non-overlapping**: when one closes, the next begins.
 * - Useful when segmenting a stream into fixed-size batches of live signals.
 */
export function windowCount<T>(windowSize: number): SignalOperatorFunction<T, Signal<T | undefined>> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(windowCount) && assertNotInReactiveContext(windowCount);
    windowSize = Math.max(1, Math.floor(windowSize));
    let count = 0;
    let intermediateSource = signal<any>(undefined);
    const outputSource = signal<Signal<T | undefined>>(intermediateSource);

    subscribe(prevSource, (value) => {
      intermediateSource.set(value);
      count++;
      if (count === windowSize) {
        count = 0;
        intermediateSource = signal(undefined);
        outputSource.set(intermediateSource.asReadonly());
      }
    });

    return outputSource;
  }
}
