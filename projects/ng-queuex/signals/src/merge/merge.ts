import { assertInInjectionContext, DestroyRef, inject, signal, Signal } from '@angular/core';
import { NG_DEV_MODE, ReusableDestroyRef } from '../utils';
import { ContextAwareSignalNode, createContextAwareSignal } from '../context_aware_signal/context_aware_signal';
import { subscribe } from '../subscribe/subscribe';
import { SIGNAL } from '@angular/core/primitives/signals';

type UnwrapSignal<T> = T extends Signal<infer V> ? V : never;

/**
 * Options passed to the `merge` creation function.
 */
export interface CreateMergeSignalOptions {

  /**
   * A debug name for the signal. Used in Angular DevTools to identify the signal.
   */
  debugName?: string;

  /**
   * Defines how the signal handles initialization and cleanup.
   *
   * - `'reactive'` — the signal manages its lifecycle based on reactive consumers (e.g. `effect()` or Angular's component templates).
   *   It initializes when the first consumer subscribes and deinitializes when the last consumer is removed. However, if the consumer
   *   reappears, the signal will be reinitialized.
   *   **Restriction:** the signal can only be read inside a reactive context like `effect()` or component template.
   *
   * - `'injection'` — A signal is tied to the Angular DI lifecycle. Cleanup is managed via the provided `DestroyRef` or the current injection context.
   *   A signal can be created anywhere (as long as it has a provided `DestroyRef`) and read without reactive-context restriction.
   *
   * @default 'reactive'
   */
  cleanupStrategy?: 'reactive' | 'injection';

  /**
   * object of type `DestroyRef` for injection context cleanup strategy.
   */
  destroyRef?: DestroyRef;

}

/**
 * Merges multiple signals into a single signal that emits whenever any of the source signals change. The resulting signal produces
 * the latest value from the signal that triggered the change.
 *
 *  * @returns A new signal emitting values from all provided sources,
 *          typed as a union of their value types.
 *
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal('hello');
 *
 * const merged = merge(a, b);
 *
 * effect(() => {
 *   console.log(merged()); // log: 'hello'
 * });
 *
 * a.set(2) // log: 2
 * b.set('world') // log: 'world'
 */
export function merge<const S extends readonly Signal<any>[]>(sources: [...S]): Signal<UnwrapSignal<S[number]>>;
/**
 * Merges multiple signals into a single signal that emits whenever any of the source signals change. The resulting signal produces
 * the latest value from the signal that triggered the change.
 *
 *  * @returns A new signal emitting values from all provided sources,
 *          typed as a union of their value types.
 *
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal('hello');
 *
 * const merged = merge(a, b);
 *
 * effect(() => {
 *   console.log(merged()); // log: 'hello'
 * });
 *
 * a.set(2) // log: 2
 * b.set('world') // log: 'world'
 */
export function merge<const S extends readonly Signal<any>[]>(sources: [...S], options: CreateMergeSignalOptions | undefined): Signal<UnwrapSignal<S[number]>>;
export function merge(sources: Signal<any>[], options?: CreateMergeSignalOptions | undefined): Signal<any> {
  const strategy = options?.cleanupStrategy ?? 'reactive';

  if (strategy === 'reactive') {
    return mergeForReactiveContext(sources, options?.debugName);
  } else {
    return mergeForInjectionContext(sources, options);
  }

}

declare const s1: Signal<string>;
declare const s2: Signal<boolean>;
declare const s3: Signal<number>;


merge([s1, s2, s3])


function mergeForReactiveContext(sources: Signal<any>[], debugName?: string | undefined): Signal<any> {
  sources = sources.slice();
  const destroyRef = new ReusableDestroyRef();

  const outputSignal = createContextAwareSignal<any>(
    undefined,
    (set) => {
      for (let i = 0; i < sources.length; i++) {
        subscribe(sources[i], (value) => set(value), destroyRef);
      }
    },
    () => {
      destroyRef.destroy();
    },
    merge,
    debugName
  );

  return outputSignal;
}


function mergeForInjectionContext(sources: Signal<any>[], options?: CreateMergeSignalOptions | undefined): Signal<any> {
  NG_DEV_MODE && !options?.destroyRef && assertInInjectionContext(merge);

  const destroyRef = options?.destroyRef ?? inject(DestroyRef);
  const outputSignal = signal<any>(undefined, options);

  for (let i = 0; i < sources.length; i++) {
    subscribe(sources[i], (value) => outputSignal.set(value), destroyRef);
  }

  return outputSignal.asReadonly();
}
