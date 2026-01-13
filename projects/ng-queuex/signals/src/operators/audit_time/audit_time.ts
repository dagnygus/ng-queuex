import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";
import { Schedulers } from "../../schedulers/schedulers";

/**
 * Limits the rate of values forwarded from the source `Signal<T>` by
 * deferring emission until the specified time duration elapses.
 *
 * When the source signal emits a value and no audit window is active,
 * an audit window is opened. Source values emitted while the window is
 * active are collected, but nothing is forwarded. When the audit window
 * closes after the given `duration`, the most recent source value is
 * emitted.
 *
 * @param duration
 * The audit duration in milliseconds.
 *
 * @returns
 * A signal operator function that emits the most recent source value
 * at the end of each audit window.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const audited = signalPipe(
 *   source,
 *   [ auditTime(300) ]
 * );
 * ```
 *
 * @remarks
 * - No value is emitted when the audit window opens.
 * - Only the most recent source value is emitted when the duration elapses.
 * - Source values emitted while the audit window is active replace the pending value.
 */
export function auditTime<T>(duration: number): SignalOperatorFunction<T, T | undefined> {
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

      if (clearTimeout) { return; }

      clearTimeout = schedulers.setTimeout(() => {
        clearTimeout = null;
        nextSource.set(latestValue);
      }, duration);
    });

    return nextSource.asReadonly();
  }
}
