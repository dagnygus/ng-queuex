import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { switchMap } from "rxjs";
import { CleanupScope } from "../../signals";
import { subscribe } from '../../subscribe/subscribe'

/**
 * Flattens a higher-order signal by switching to the most recent inner signal
 * emitted by the source, mirroring its values in the output.
 *
 * When the source signal emits a new inner signal, the previously active one
 * is unsubscribed and its emissions are no longer observed. The new inner signal
 * becomes the current active source until replaced.
 *
 * @returns
 * A signal operator function that emits values from the most recently active inner signal.
 *
 * @example
 * ```ts
 * const innerA = signal(1);
 * const innerB = signal(2);
 * const higherOrder = signal(innerA);
 *
 * const switched = signalPipe(
 *   higherOrder,
 *   [switchAll()]
 * );
 *
 * // Emits 1 from innerA
 * higherOrder.set(innerB);
 * // Switches to innerB, emits 2
 * ```
 *
 * @remarks
 * - Only one inner signal is observed at a time.
 * - The previous inner signal is cleaned up when a new one is emitted.
 * - Values of `undefined` from the source signal are ignored.
 */
export function switchAll<T, U extends Signal<T> | undefined = Signal<T> | undefined>(): SignalOperatorFunction<U, undefined extends U ? T | undefined : T> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(switchMap);
    const childScope = CleanupScope.assertCurrent(switchAll).createChild();
    const nextSource = signal<any>(undefined);

    subscribe(prevSource, (innerSource) => {
      childScope.cleanup();
      childScope.run(() => {
        let cleaned = false;
        childScope.add(() => { cleaned = true; });

        subscribe(innerSource, (innerValue) => {
          nextSource.set(innerValue);
        });

        if (cleaned) {
          childScope.cleanup();
        }
      });
    });

    return nextSource.asReadonly();
  }
}
