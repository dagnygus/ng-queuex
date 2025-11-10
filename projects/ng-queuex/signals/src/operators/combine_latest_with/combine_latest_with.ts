import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction, UnwrapSignal } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { combineLatest } from "../../combine_latest/combine_latest";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Combines the latest values from the source signal and the provided signals
 * into a single tuple that updates whenever any of them emit a new value.
 *
 * The output signal emits only after all participating signals have emitted
 * at least once, and then re-emits whenever any of them change.
 *
 * @param sources
 * One or more additional signals whose latest values will be combined
 * with the source signal into a tuple.
 *
 * @returns
 * A signal operator function that emits a tuple containing the latest values
 * from the source and all provided signals.
 *
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal('x');
 * const c = signal(true);
 *
 * const combined = signalPipe(
 *   a,
 *   combineLatestWith(b, c)
 * );
 * // Emits: [1, 'x', true]
 * ```
 *
 * @remarks
 * - The output updates whenever any participating signal emits a new value.
 * - Emission starts only after all signals have produced their first defined value.
 * - Useful for deriving state from multiple reactive sources simultaneously.
 */
export function combineLatestWith<T, S extends readonly Signal<any>[]>(...sources: [...S]): SignalOperatorFunction<T, [T, ...{ [K in keyof S]: UnwrapSignal<S[K]>; }]> {
  sources = sources.slice() as any;
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(combineLatestWith);
    let output = Array(sources.length + 1);
    const outputSource = signal<any>(output);
    const scope = CleanupScope.assertCurrent(combineLatestWith);

    let sync = true;

    subscribe(prevSource, (value) => {
      if (sync) {
        output[0] = value
      } else {
        output = output.slice();
        output[0] = value;
        outputSource.set(output);
      }
    });

    for (let i = 0; i < sources.length; i++) {
      const childScope = scope.createChild();
      let cleaned = false;
      childScope.add(() => { cleaned = true; });

      childScope.run(() => {
        subscribe(sources[i], (value) => {
          if (sync) {
            output[i + 1] = value;
          } else {
            output = output.slice();
            output[i + 1] = value;
            outputSource.set(output);
          }
        });
      });

      if (cleaned) {
        childScope.cleanup();
      }
    }

    sync = false;

    return outputSource.asReadonly();
  }
}
