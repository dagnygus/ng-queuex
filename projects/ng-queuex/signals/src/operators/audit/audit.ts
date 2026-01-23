import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Limits the rate of values forwarded from the source `Signal<T>` by
 * deferring emission until a dynamically selected duration signal emits.
 *
 * When the source signal emits a value and no audit window is active,
 * an audit window is opened and the `durationSelector` is invoked to
 * obtain a duration signal. Source values emitted while the audit window
 * is active are collected, but nothing is forwarded. When the duration
 * signal emits, the most recent source value is emitted and the audit
 * window is closed.
 *
 * @param durationSelector
 * A function that returns a signal controlling when the most recent
 * source value should be emitted.
 *
 * @returns
 * A signal operator function that emits the most recent source value
 * at the end of each audit window.
 *
 * @example
 * ```ts
 * const source = signal(0);
 * const trigger = signal(0);
 *
 * const audited = signalPipe(
 *   source,
 *   [audit(() => trigger)]
 * );
 *
 * source.set(1);
 * source.set(2);
 * source.set(3);
 * trigger.set(1); // emits 3
 * ```
 *
 * @remarks
 * - No value is emitted when the audit window opens.
 * - Only the most recent source value is emitted when the duration signal emits.
 * - Source values emitted while the audit window is active replace the pending value.
 */
export function audit<T>(durationSelector: () => Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(audit);
    const childScope = CleanupScope.assertCurrent(audit).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let durationNotifier: Signal<any> | null = null;
    let latestValue: any;
    let cleaned = false;

    function onCleanup(): void {
      cleaned = true;
      durationNotifier = null;
    }

    subscribe(prevSource, (value) => {
      latestValue = value;
      if (durationNotifier) { return; }

      cleaned = false;
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
          nextSource.set(latestValue);
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
