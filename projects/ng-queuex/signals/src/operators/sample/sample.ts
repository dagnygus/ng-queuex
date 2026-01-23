import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Emits the most recent value from the source signal whenever the notifier
 * signal emits, but only if the source signal has emitted a new value since
 * the last sampling.
 *
 * The operator does not emit anything until the source signal produces a
 * value. After a value is sampled, it will not be emitted again unless the
 * source signal emits a new value.
 *
 * Emissions are triggered exclusively by the notifier signal. Source signal
 * emissions only update the internally stored value and do not cause
 * immediate emissions.
 * 
 * @param notifier A signal whose emissions trigger sampling of the source
 * signal.
 *
 * @returns An operator function that returns a signal emitting the most
 * recent value from the source signal when sampled by the notifier.
 */
export function sample<T>(notifier: Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(sample) && assertNotInReactiveContext(sample);
    const nextSource = signal<T | undefined>(undefined);
    let latestValue: T | undefined;

    subscribe(prevSource, (value) => { latestValue = value; });

    let sync = true;
    subscribe(notifier, () => {
      if (sync || typeof latestValue === 'undefined') { return; }
      nextSource.set(latestValue);
      latestValue = undefined;
    });
    sync = false
    return nextSource.asReadonly();
  }
}
