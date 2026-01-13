import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Skips values from the source `Signal<T>` until the provided
 * `notifier` signal emits.
 *
 * While the notifier has not emitted, all source values are ignored.
 * After the notifier emits for the first time, all subsequent source
 * values are forwarded unchanged.
 *
 * @param notifier
 * A signal whose first emission enables forwarding of source values.
 *
 * @returns
 * A signal operator function that emits source values only after the
 * notifier has emitted.
 *
 * @example
 * ```ts
 * const source = signal(0);
 * const ready = signal(false);
 *
 * const gated = signalPipe(
 *   source,
 *   [skipUntil(ready)]
 * );
 *
 * ready.set(true); // enables forwarding
 * ```
 *
 * @remarks
 * - Source values emitted before the notifier emits are skipped
 *   (only when notifier will update, then source values forwarded).
 * - Only the first emission from the notifier is considered.
 */
export function skipUntil<T>(notifier: Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(skipUntil);
    const childScope = CleanupScope.assertCurrent(skipUntil).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let skip = true;
    let cleared = false;

    subscribe(prevSource, (value) => {
      if (skip) { return; }
      nextSource.set(value);
    });

    childScope.add(() => {
      skip = false;
      cleared = true;
    });

    let sync = true;
    childScope.run(() => {
      subscribe(notifier, () => {
        if (sync) { return; }
        childScope.destroy();
      });
    });
    sync = false;

    if (cleared) {
      childScope.destroy();
    } else {
      childScope.add(() => childScope.destroy());
    }

    return nextSource.asReadonly();
  }
}
