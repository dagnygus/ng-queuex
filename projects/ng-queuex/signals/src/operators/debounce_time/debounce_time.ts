import { assertNotInReactiveContext, signal } from "@angular/core";
import { subscribe } from "../../subscribe/subscribe";
import { auditTime } from "rxjs";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { Schedulers } from "../../schedulers/schedulers";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Delays the emission of values from the source `Signal<T>` by the specified
 * time duration.
 *
 * When the source signal emits a value, a timer is started for the given
 * `duration`. The value is emitted only if no newer value appears before
 * the timer completes. If a new value is produced while waiting, the
 * pending timer is cancelled and restarted for the latest value.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param duration
 * The debounce duration in milliseconds.
 *
 * @returns
 * A signal operator function that emits the most recent debounced value,
 * or `undefined` while waiting for the debounce duration to elapse.
 *
 * @example
 * ```ts
 * const query = signal<string | undefined>(undefined);
 *
 * const debouncedQuery = signalPipe(
 *   query,
 *   [debounceTime(300)]
 * );
 * ```
 *
 * @remarks
 * - Only the most recent source value can be emitted.
 * - Each source emission resets the debounce timer.
 * - If the source keeps changing faster than the specified duration,
 *   no value is forwarded.
 */
export function debounceTime<T>(duration: number): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(auditTime);
    const scope = CleanupScope.assertCurrent(auditTime);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);

    let latestValue: T = undefined!;
    let clearTimeout: (() => void) | null = null;

    scope.add(() => { clearTimeout?.(); })

    subscribe(prevSource, (value) => {
      latestValue = value;

      if (clearTimeout) { clearTimeout(); }

      clearTimeout = schedulers.setTimeout(() => {
        clearTimeout = null;
        nextSource.set(latestValue);
      }, duration);
    });

    return nextSource.asReadonly();
  }
}
