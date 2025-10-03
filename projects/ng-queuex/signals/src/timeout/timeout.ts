import { assertInInjectionContext, inject, Injector, Signal } from "@angular/core";
import { CleanupScope } from "../signals";
import { NG_DEV_MODE } from "../shared";
import { NgTimers } from "../ng_timers/ng_timers";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";

/**
 * Options passed to `timeout()` creation function.
 */
export interface CreateTimeoutOptions<T> {
  /**
   * An initial value of signal. Default is undefined.
   */
  initialValue?: T;

  /**
   * A required injector if `interval` must be created outside injection context.
   */
  injector?: Injector;

  /**
   * A debug name for the signal. Used in Angular DevTools to identify the signal.
   */
  debugName?: string;
}

/**
 * Creates a signal whose value will change after a given delay to the value provided by callback.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param delay time in milliseconds after which the signal will change.
 * @param callback A callback what will be use to update signal.
 */
export function timeout<T>(delay: number, callback: () => T): Signal<T | undefined>;
/**
 * Creates a signal whose value will change in the given date to the value provided by callback.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param at Date on which the value will be changed.
 * @param callback A callback what will be use to update signal.
 */
export function timeout<T>(at: Date, callback: () => T): Signal<T | undefined>;
/**
 * Creates a signal whose value will change after a given delay to the value provided by callback.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param delay time in milliseconds after which the signal will change.
 * @param callback A callback what will be use to update signal.
 * @param options An timeout options.
 *
 * @see {@link CreateTimeoutOptions}
 */
export function timeout<T>(delay: number, callback: (value: T) => T, options: ({ initialValue: T } & CreateTimeoutOptions<T>) | undefined ): Signal<T>;
/**
 * Creates a signal whose value will change after a given delay to the value provided by callback.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param delay time in milliseconds after which the signal will change.
 * @param callback A callback what will be use to update signal.
 * @param options An timeout options.
 *
 * @see {@link CreateTimeoutOptions}
 */
export function timeout<T>(delay: number, callback: () => T, options: CreateTimeoutOptions<T>): Signal<T | undefined>;
/**
 * Creates a signal whose value will change in the given date to the value provided by callback.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param at Date on which the value will be changed.
 * @param callback A callback what will be use to update signal.
 * @param options An timeout options.
 *
 * @see {@link CreateTimeoutOptions}
 */
export function timeout<T>(at: Date, callback: (value: T) => T, options: ({ initialValue: T } & CreateTimeoutOptions<T>) | undefined ): Signal<T>;
/**
 * Creates a signal whose value will change in the given date to the value provided by callback.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param at Date on which the value will be changed.
 * @param callback A callback what will be use to update signal.
 * @param options An timeout options.
 *
 * @see {@link CreateTimeoutOptions}
 */
export function timeout<T>(at: Date, callback: () => T, options: CreateTimeoutOptions<T>): Signal<T | undefined>;
export function timeout<T>(delayOrAt: number | Date, callback: (value?: T) => T, options?: CreateTimeoutOptions<T>): Signal<T | undefined> {

  NG_DEV_MODE && !CleanupScope.current() && !options?.injector && assertInInjectionContext(timeout);

  const injector = CleanupScope.current()?.injector ?? options?.injector ?? inject(Injector);
  const ngTimers = injector.get(NgTimers);
  const initialValue = options?.initialValue;
  let ms = typeof delayOrAt === 'number' ? delayOrAt : Date.now() - delayOrAt.getTime();

  let timeoutCleanup: VoidFunction = null!;


  ms = Math.min(0, ms);


  const outupSignal = createContextAwareSignal(
    initialValue,
    function(set) {
      timeoutCleanup = ngTimers.setTimeout(() => {
        set(callback(initialValue));
      })
    },
    () => {
      timeoutCleanup();
    },
    timeout,
    options?.debugName
  )

  return outupSignal;
}
