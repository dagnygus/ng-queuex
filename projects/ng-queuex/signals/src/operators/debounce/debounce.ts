import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { subscribe } from "../../subscribe/subscribe";
import { audit } from "rxjs";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Delays the emission of values from the source `Signal<T>` by dynamically
 * selecting a debounce duration signal for each source value.
 *
 * For every value emitted by the source signal, the `durationSelector`
 * function is called to obtain a duration `Signal`. The source value is
 * forwarded only when that duration signal emits. If a new source value
 * appears before the duration signal emits, the previous duration signal
 * is unsubscribed and the debounce process restarts for the new value.
 *
 * @param durationSelector
 * A function that returns a signal controlling when the most recent source
 * value should be emitted. Each source emission creates a new duration signal.
 *
 * @returns
 * A signal operator function that emits the most recent debounced value,
 * or `undefined` while waiting for the duration signal to emit.
 *
 * @example
 * ```ts
 * const input = signal<string | undefined>(undefined);
 * const trigger = signal(0);
 *
 * const debounced = signalPipe(
 *   input,
 *   [ debounce(() => trigger) ]
 * );
 *
 * input.set('a');
 * trigger.set(1); // emits 'a'
 * ```
 *
 * @remarks
 * - Only the most recent source value can be emitted.
 * - Each source emission replaces the previously active duration signal.
 * - If the duration signal never emits, the source value is never forwarded.
 */
export function debounce<T>(durationSelector: () => Signal<any>): SignalOperatorFunction<T, T | undefined> {
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
      if (durationNotifier) {
        childScope.cleanup();
      }

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
