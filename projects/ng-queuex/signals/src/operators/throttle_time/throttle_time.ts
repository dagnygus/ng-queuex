import { assertNotInReactiveContext, signal } from "@angular/core";
import { subscribe } from "../../subscribe/subscribe";
import { auditTime } from "rxjs";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { Schedulers } from "../../schedulers/schedulers";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Limits the rate of values forwarded from the source `Signal<T>` by
 * immediately emitting the first value and then suppressing subsequent
 * values for the specified time duration.
 *
 * When the source signal emits a value and no throttle window is active,
 * the value is forwarded immediately and a throttle window is opened.
 * Source values emitted while the window is active are ignored. When the
 * window closes after the given `duration`, the next source value may be
 * forwarded.
 *
 * @param duration
 * The throttle duration in milliseconds.
 *
 * @returns
 * A signal operator function that emits the first source value in each
 * throttle window.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const throttled = signalPipe(
 *   source,
 *   [ throttleTime(300) ]
 * );
 * ```
 *
 * @remarks
 * - The first source value in a window is emitted immediately.
 * - Subsequent values are ignored until the throttle window closes.
 * - If the source emits continuously, values are forwarded at most once
 *   per specified duration.
 */
export function throttleTime<T>(duration: number): SignalOperatorFunction<T, T | undefined> {
  return function (prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(auditTime);
    const scope = CleanupScope.assertCurrent(auditTime);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);

    let clearTimeout: (() => void) | null = null;

    scope.add(() => { clearTimeout?.(); })

    subscribe(prevSource, (value) => {
      if (clearTimeout) { return; }

      nextSource.set(value)

      clearTimeout = schedulers.setTimeout(() => {
        clearTimeout = null;
      }, duration);
    });

    return nextSource.asReadonly();
  }
}
