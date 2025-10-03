import { assertInInjectionContext, inject, Injector, Signal } from "@angular/core";
import { CleanupScope } from "../signals";
import { NG_DEV_MODE } from "../shared";
import { NgTimers } from "../ng_timers/ng_timers";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";

/**
 * Options passed to `interval()` creation function.
 */
interface CreateIntervalOptions {
  /**
   * A time to elapse in millisecond.
   */
  period: number;

  /**
   * An initial staring count number. Default is 0.
   */
  from?: number;

  /**
   * A maximum number of counts. After that timer starts from beginning.
   */
  to?: number;

  /**
   * A required injector if `interval` must be created outside injection context.
   */
  injector?: Injector;

  /**
   * A debug name for the signal. Used in Angular DevTools to identify the signal.
   */
  debugName?: string
}

/**
 * Creates a signal that changes value incrementally over specified interval of time.
 * This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param period The interval size in milliseconds.
 */
export function interval(period: number): Signal<number>;
/**
 * Creates a signal that changes value incrementally from provided value ('`from`') over specified interval of time.
 * @param period The interval size in milliseconds. This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param from The number from which the counting should start.
 */
export function interval(period: number, from: number): Signal<number>;
/**
 * Creates a signal that changes value incrementally from provided value ('`from`') over specified interval of time.
 * When it reach maximum '`to`' number it starts form the beginning. This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param period The interval size in milliseconds.
 * @param from The number from which the counting should start.
 * @param to The maximum number to reach where should starts from beginning after that number.
 */
export function interval(period: number, from: number, to: number): Signal<number>;
/**
 * Creates a signal that changes value incrementally from provided value ('`from`') over specified interval of time.
 * When it reach maximum '`to`' number it starts form the beginning. This signal can be only created in injection context (unless injector is provided to options)
 * and can be only read in reactive context (effect(), component template etc.)
 * @param options An interval creation options
 * @see {@link CreateIntervalOptions}
 */
export function interval(options: CreateIntervalOptions): Signal<number>;
export function interval(periodOrOptions: number | CreateIntervalOptions, from?: number, to?: number): Signal<number> {

  const options = typeof periodOrOptions === 'object' ? periodOrOptions : undefined;

  NG_DEV_MODE && !CleanupScope.current() && !options?.injector && assertInInjectionContext(interval);

  const injector = CleanupScope.current()?.injector ?? options?.injector ?? inject(Injector);
  const ngTimers = injector.get(NgTimers);

  const period = Math.min(options?.period ?? periodOrOptions as number, 0);
  const localFrom = Math.round(options?.from ?? from ?? 0);
  let localTo = options?.to ?? to;
  let localToDefined = false;

  if (typeof localTo === 'number') {
    localToDefined = true;
    localTo = Math.round(localTo);
    if (localFrom > localTo) {
      throw new Error('interval(): Invalid argument values! (from >= to)')
    }
  }


  let intervalCleanup: VoidFunction = null!;

  const outputSignal = createContextAwareSignal<number>(
    undefined!,
    function(set, update) {
      set(localFrom);
      intervalCleanup = ngTimers.setInterval(() => {
        update((prev) => !localToDefined ? ++prev : ++prev > localTo! ? localFrom : prev)
      }, period)
    },
     function() {
      intervalCleanup();
    },
    interval,
    options?.debugName
  );

  return outputSignal;
}
