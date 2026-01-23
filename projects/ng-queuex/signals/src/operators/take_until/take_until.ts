import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalMonoTypeOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Forwards values from the source `Signal<T>` until the provided
 * `notifier` signal emits.
 *
 * When the `notifier` signal emits, the operator immediately deinitializes
 * the `signalPipe`, stopping further observation of the source.
 * The pipeline is re-initialized only when all consumers are removed and
 * a new active consumer appears again.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param notifier
 * A signal whose emission triggers deinitialization of the pipeline.
 *
 * @returns
 * A signal operator function that forwards source values while the notifier
 * has not emitted.
 *
 * @example
 * ```ts
 * const source = signal(0);
 * const stop = signal(0);
 *
 * const gated = signalPipe(
 *   source,
 *   [takeUntil(stop)]
 * );
 *
 * stop.set(1); // deinitializes the pipeline
 * ```
 *
 * @remarks
 * - Emission from the notifier immediately deinitializes the signal pipeline.
 * - After deinitialization, source changes are ignored.
 * - The pipeline is re-initialized only after all consumers are removed
 *   and a new active consumer is registered.
 */
export function takeUntil<T>(notifier: Signal<any>): SignalMonoTypeOperatorFunction<T> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(takeUntil);
    const scope = CleanupScope.assertCurrent(takeUntil);
    const nextSource = signal<any>(undefined);

    subscribe(prevSource, (value) => { nextSource.set(value); });

    let sync = true;
    subscribe(notifier, () => {
      if (sync) { return; }
      scope.cleanup();
    });
    sync = false;

    return nextSource.asReadonly();
  }
}
