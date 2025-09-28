import { assertInInjectionContext, DestroyRef, inject, signal, Signal } from '@angular/core';
import { JoinSignalCreationOptions, NG_DEV_MODE, ReusableDestroyRef } from '../shared';
import { ContextAwareSignalNode, createContextAwareSignal } from '../context_aware_signal/context_aware_signal';
import { subscribe } from '../subscribe/subscribe';
import { setActiveConsumer, SIGNAL } from '@angular/core/primitives/signals';

type UnwrapSignal<T> = T extends Signal<infer V> ? V : never;
type NotUndefinedIfPossible<T> = [Exclude<T, undefined>] extends [never] ? undefined : Exclude<T, undefined>;

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
export function merge(sources: []): Signal<undefined>;
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
export function merge<const S extends readonly Signal<any>[]>(sources: [...S]): Signal<NotUndefinedIfPossible<UnwrapSignal<S[number]>>>;
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
export function merge<const S extends readonly Signal<any>[]>(sources: [...S], options: JoinSignalCreationOptions | undefined): Signal<NotUndefinedIfPossible<UnwrapSignal<S[number]>>>;
export function merge(sources: Signal<any>[], options?: JoinSignalCreationOptions | undefined): Signal<any> {
  const strategy = options?.cleanupStrategy ?? 'reactive';

  if (strategy === 'reactive') {
    return mergeForReactiveContext(sources, options?.debugName);
  } else {
    return mergeForInjectionContext(sources, options);
  }

}

function mergeForReactiveContext(sources: Signal<any>[], debugName?: string | undefined): Signal<any> {
  sources = sources.slice();
  const destroyRef = new ReusableDestroyRef();

  const outputSignal = createContextAwareSignal<any>(
    undefined,
    (set) => {
      const consumer = setActiveConsumer(null);
      try {
        for (let i = 0; i < sources.length; i++) {
          subscribe(sources[i], (value) => set(value), destroyRef);
        }
      } finally {
        setActiveConsumer(consumer);
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


function mergeForInjectionContext(sources: Signal<any>[], options?: JoinSignalCreationOptions | undefined): Signal<any> {
  NG_DEV_MODE && !options?.destroyRef && assertInInjectionContext(merge);

  const destroyRef = options?.destroyRef ?? inject(DestroyRef);
  const outputSignal = signal<any>(undefined, options);

  const consumer = setActiveConsumer(null);
  try {
    for (let i = 0; i < sources.length; i++) {
      subscribe(sources[i], (value) => outputSignal.set(value), destroyRef);
    }
  } finally {
    setActiveConsumer(consumer);
  }

  return outputSignal.asReadonly();
}
