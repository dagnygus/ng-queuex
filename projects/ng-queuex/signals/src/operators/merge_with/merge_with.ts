import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, NotUndefinedIfPossible, SignalOperatorFunction, UnwrapSignal } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Merges the values from the source signal with one or more additional signals,
 * emitting whenever any of them produce a new defined value.
 *
 * Each emission from the source or any merged signal is forwarded immediately
 * to the output, preserving the relative order of updates as they occur.
 * Values of `undefined` are ignored.
 *
 * @param sources
 * One or more additional signals whose values will be merged with the source signal.
 *
 * @returns
 * A signal operator function that emits values from both the source and the provided signals.
 *
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal(2);
 *
 * const merged = signalPipe(
 *   a,
 *   mergeWith(b)
 * );
 * // Emits: 1, 2, whenever either signal updates
 * ```
 *
 * @remarks
 * - All input signals are observed concurrently.
 * - Initial value  `undefined` is skipped.
 * - Useful for combining related reactive sources into a single signal stream.
 */
export function mergeWith<T, S extends readonly Signal<any>[]>(...sources: [...S]): SignalOperatorFunction<T, NotUndefinedIfPossible<UnwrapSignal<[Signal<T>, ...S][number]>>> {
  sources = sources.slice() as any;
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(mergeWith)
    const scope = CleanupScope.assertCurrent(mergeWith);
    const outputSource = signal<any>(undefined)
    const innerSources = new Set<Signal<T>>();
    let sourcesCount = sources.length + 1;

    scope.add(() => innerSources.clear());

    for (let i = -1; i < sources.length; i++) {
      const innerSource = i > -1 ? sources[i] : prevSource

      if (innerSources.has(innerSource)) { continue; }

      const childScope = scope.createChild();
      let cleaned = false;

      childScope.add(() => {
        innerSources.delete(innerSource);
        cleaned = true;
        if (--sourcesCount === 0) {
          scope.cleanup();
        }
      })

      childScope.run(() => {
        subscribe(innerSource, (value) => { outputSource.set(value); });
      });

      if (cleaned) {
        childScope.destroy();
      } else {
        childScope.add(() => childScope.destroy());
      }
    }

    return outputSource.asReadonly();
  }
}
