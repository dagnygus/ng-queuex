import { assertInInjectionContext, DestroyRef, inject, signal, Signal } from '@angular/core';
import { DEFAULT_CLEANUP_STRATEGY, JoinSignalCreationOptions, NG_DEV_MODE, NotUndefinedIfPossible, ReusableDestroyRef, UnwrapSignal } from '../shared';
import { createContextAwareSignal } from '../context_aware_signal/context_aware_signal';
import { subscribe } from '../subscribe/subscribe';
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { CleanupScope } from '../signals';

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
export function merge(sources: [], options: JoinSignalCreationOptions | undefined): Signal<undefined>;
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
  const strategy = options?.cleanupStrategy ?? DEFAULT_CLEANUP_STRATEGY;

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
  const scope = CleanupScope.current();

  NG_DEV_MODE && !scope && !options?.destroyRef && assertInInjectionContext(merge);

  const destroyRef = scope ? options?.destroyRef ?? inject(DestroyRef) : null;
  const outputSignal = signal<any>(undefined, options);

  const consumer = setActiveConsumer(null);
  try {
    for (let i = 0; i < sources.length; i++) {
      if (scope) {
        scope.run(() => {
          subscribe(sources[i], (value) => outputSignal.set(value), destroyRef);
        });
      } else {
        subscribe(sources[i], (value) => outputSignal.set(value), destroyRef);
      }
    }
  } finally {
    setActiveConsumer(consumer);
  }

  return outputSignal.asReadonly();
}
