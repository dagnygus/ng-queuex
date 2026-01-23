import { assertInInjectionContext, DestroyRef, inject, signal, Signal } from '@angular/core';
import { createContextAwareSignal } from '../context_aware_signal/context_aware_signal';
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { subscribe } from '../subscribe/subscribe';
import { CleanupScope } from '../cleanup_scope/cleanup_scope';
import { UnwrapSignal, JoinSignalCreationOptions, DEFAULT_CLEANUP_STRATEGY, ReusableDestroyRef, NG_DEV_MODE } from '../common';

/**
 * Combines a tuple (array) of source signals into a single signal whose value is a tuple of the latest values from each source.
 *
 * The resulting signal updates whenever any source changes and always reflects the current/latest values of all sources in the same order as provided.
 *
 * @returns A Signal whose value is a tuple of each source's value in the same order.
 *
 * @example
 * ```ts
 * const s1 = signal(0);
 * const s2 = signal('a');
 * const s3 = signal(true);
 *
 * const combined = combineLatest([s1, s2, s3]);
 * // combined: Signal<[number, string, boolean]>
 *
 * effect(() => {
 *   const [n, str, b] = combined();
 *   console.log(n, str, b);
 * });
 * ```
 */
export function combineLatest<const S extends readonly Signal<any>[]>(sources: [...S]): Signal<{ [K in keyof S]: UnwrapSignal<S[K]> }>;
/**
 * Combines a tuple (array) of source signals into a single signal whose value is a tuple of the latest values from each source.
 *
 * The resulting signal updates whenever any source changes and always reflects the current/latest values of all sources in the same order as provided.
 *
 * @returns A Signal whose value is a tuple of each source's value in the same order.
 *
 * @example
 * ```ts
 * const s1 = signal(0);
 * const s2 = signal('a');
 * const s3 = signal(true);
 *
 * const combined = combineLatest([s1, s2, s3]);
 * // combined: Signal<[number, string, boolean]>
 *
 * effect(() => {
 *   const [n, str, b] = combined();
 *   console.log(n, str, b);
 * });
 * ```
 * @see {@link JoinSignalCreationOptions}
 */
export function combineLatest<const S extends readonly Signal<any>[]>(sources: [...S], options: JoinSignalCreationOptions | undefined): Signal<{ [K in keyof S]: UnwrapSignal<S[K]> }>;
/**
 * Combines an object of source signals into a single signal whose value is an object with the same keys, where each property contains the latest
 * value from the corresponding source signal.
 *
 * The resulting signal updates whenever any source changes and always reflects the current/latest values of all sources.
 *
 * @returns A Signal of an object with the same keys, each mapped to the corresponding signal's value.
 *
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal('x');
 *
 * const combined = combineLatest({ a, b });
 * // combined: Signal<{ a: number; b: string }>
 *
 * effect(() => {
 *   const { a: num, b: str } = combined();
 *   console.log(num, str);
 * });
 * ```
 */
export function combineLatest<O extends Record<string, Signal<any>>>(sources: O): Signal<{ [K in keyof O]: UnwrapSignal<O[K]> }>;
/**
 * Combines an object of source signals into a single signal whose value is an object with the same keys, where each property contains the latest
 * value from the corresponding source signal.
 *
 * The resulting signal updates whenever any source changes and always reflects the current/latest values of all sources.
 *
 * @returns A Signal of an object with the same keys, each mapped to the corresponding signal's value.
 *
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal('x');
 *
 * const combined = combineLatest({ a, b });
 * // combined: Signal<{ a: number; b: string }>
 *
 * effect(() => {
 *   const { a: num, b: str } = combined();
 *   console.log(num, str);
 * });
 * ```
 * @see {@link JoinSignalCreationOptions}
 */
export function combineLatest<O extends Record<string, Signal<any>>>(sources: O, options: JoinSignalCreationOptions | undefined): Signal<{ [K in keyof O]: UnwrapSignal<O[K]> }>;
export function combineLatest(sources: any, options?: JoinSignalCreationOptions): Signal<any> {
  const strategy = options?.cleanupStrategy ?? DEFAULT_CLEANUP_STRATEGY;

  if (strategy === 'reactive') {
    return combineLatestForReactiveContext(sources, options?.debugName);
  } else {
    return combineLatestForInjectionContext(sources, options)
  }
}

function combineLatestForReactiveContext(sources: any, debugName?: string | undefined): Signal<any> {
  const destroyRef = new ReusableDestroyRef();
  const isArray = Array.isArray(sources);
  let initialized = false;

  if (isArray) {
    sources = sources.slice();
  } else {
    sources = Object.assign({}, sources);
  }

  const outputSignal = createContextAwareSignal<any>(
    undefined,
    function(set, update) {
      const consumer = setActiveConsumer(null);
      let output: any;

      if (isArray) {
        output = Array(sources.length);
        for (let i = 0; i < sources.length; i++) {
          output[i] = sources[i]();
        }
      } else {
        output = {}
        for (const key in sources) {
          output[key] = sources[key]()
        }
      }

      set(output);

      try {
        if (isArray) {
          for (let i = 0; i < sources.length; i++) {
            subscribe(sources[i], (value) => {
              if (initialized) {
                update((prev) => {
                  const curr = [...prev];
                  curr[i] = value;
                  return curr;
                });
              }
            }, destroyRef);
          }
        } else {
          for (const key in sources) {
            subscribe(sources[key], (value) => {
              if (initialized) {
                update((prev) => {
                  const curr = { ...prev }
                  curr[key] = value;
                  return curr;
                })
              }
            }, destroyRef);
          }
        }
      } finally {
        setActiveConsumer(consumer);
        initialized = true
      }
    },
    function() {
      destroyRef.destroy();
      initialized = false;
    },
    combineLatest,
    debugName
  );

  return outputSignal;
}


function combineLatestForInjectionContext(sources: any, options?: JoinSignalCreationOptions): Signal<any> {
  const scope = CleanupScope.current();

  NG_DEV_MODE && !scope && !options?.destroyRef && assertInInjectionContext(combineLatest);

  const destroyRef = scope ? options?.destroyRef ?? inject(DestroyRef) : null;
  const isArray = Array.isArray(sources);

  let output: any;

  if (isArray) {
    sources = sources.slice();
    output = Array(sources.length);
    for (let i = 0; i < sources.length; i++) {
      output[i] = sources[i]();
    }
  } else {
    sources = Object.assign({}, sources);
    output = {}
    for (const key in sources) {
      output[key] = sources[key]()
    }
  }

  const outoutSignal = signal(output, options);

  let prepared = false;
  const consumer = setActiveConsumer(null);
  try {
    if (isArray) {
      for (let i = 0; i < sources.length; i++) {
        if (scope) {
          scope.run(() => {
            subscribe(sources[i], (value) => {
              if (prepared) {
                outoutSignal.update((prev) => {
                  const curr = [...prev];
                  curr[i] = value
                  return curr;
                });
              }
            }, destroyRef);
          });
        } else {
          subscribe(sources[i], (value) => {
            if (prepared) {
              outoutSignal.update((prev) => {
                const curr = [...prev];
                curr[i] = value
                return curr;
              });
            }
          }, destroyRef);
        }
      }
    } else {
      for (const key in sources) {
        if (scope) {
          scope.run(() => {
            subscribe(sources[key], (value) => {
              if (prepared) {
                outoutSignal.update((prev) => {
                  const curr = { ...prev };
                  curr[key] = value;
                  return curr;
                });
              }
            }, destroyRef);
          })
        } else {
          subscribe(sources[key], (value) => {
            if (prepared) {
              outoutSignal.update((prev) => {
                const curr = { ...prev };
                curr[key] = value;
                return curr;
              });
            }
          }, destroyRef);
        }
      }
    }
  } finally {
    setActiveConsumer(consumer);
    prepared = true;
  }

  return outoutSignal.asReadonly();
}
