import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Provides an initial fallback value when the source `Signal<T>` has not
 * yet produced a defined value.
 *
 * If the source signal’s current value is `undefined`, the provided
 * `value` is emitted instead. Once the source emits a defined value,
 * that value is forwarded.
 *
 * @param value
 * A fallback value used when the source signal has no defined value yet.
 *
 * @returns
 * A signal operator function that emits the fallback value initially and
 * then forwards defined source values.
 *
 * @example
 * ```ts
 * const source = signal<number | undefined>(undefined);
 *
 * const withDefault = signalPipe(
 *   source,
 *   [ withInitial(0) ]
 * );
 * ```
 *
 * @remarks
 * - The fallback value is used only while the source value is `undefined`.
 * - Only defined source values are forwarded after initialization.
 */
export function withInitial<T, D = Exclude<T, undefined>>(value: D): SignalOperatorFunction<T, D | Exclude<T, undefined>> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(withInitial) && assertNotInReactiveContext(withInitial);
    const nextSource = signal<D | Exclude<T, undefined>>(value);

    subscribe(prevSource, (value) => { nextSource.set(value); });

    return nextSource.asReadonly();
  }
}
