import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { subscribe } from "../../subscribe/subscribe";
import { audit } from "rxjs";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Limits the rate of values forwarded from the source `Signal<T>` by
 * immediately emitting the first value and then suppressing subsequent
 * values until a dynamically selected duration signal emits.
 *
 * When the source signal emits a value and no throttle window is active,
 * the value is forwarded immediately and the `durationSelector` is invoked
 * to obtain a duration signal. While this duration signal is active,
 * further source values are ignored. When the duration signal emits,
 * the throttle window closes and the next source value may be forwarded.
 *
 * @param durationSelector
 * A function that returns a signal controlling the duration of the
 * current throttle window.
 *
 * @returns
 * A signal operator function that emits the first source value in each
 * throttle window.
 *
 * @example
 * ```ts
 * const source = signal(0);
 * const trigger = signal(0);
 *
 * const throttled = signalPipe(
 *   source,
 *   [ throttle(() => trigger) ]
 * );
 *
 * source.set(1); // emitted immediately
 * source.set(2); // ignored
 * trigger.set(1); // ends throttle window
 * source.set(3); // emitted
 * ```
 *
 * @remarks
 * - The first source value opens a throttle window and is emitted immediately.
 * - Source values emitted while the throttle window is active are ignored.
 * - Each throttle window is controlled by a newly created duration signal.
 */
export function throttle<T>(durationSelector: () => Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(audit);
    const childScope = CleanupScope.assertCurrent(audit).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let durationNotifier: Signal<any> | null = null;
    let cleaned = false

    function onCleanup(): void {
      cleaned = true;
      durationNotifier = null;
    }

    subscribe(prevSource, (value) => {
      if (durationNotifier) { return; }
      nextSource.set(value)

      cleaned = false
      childScope.add(onCleanup);

      childScope.run(() => {
        durationNotifier = durationSelector();
        if (cleaned) {
          childScope.cleanup();
          durationNotifier = null;
          return;
        }

        let sync = true
        subscribe(durationNotifier, () => {
          if (sync) { return; }
          childScope.cleanup();
        });
        sync = false;

        if (cleaned) {
          childScope.cleanup();
        }
      })
    })

    return nextSource.asReadonly();
  }
}
