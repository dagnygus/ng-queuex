import { assertInInjectionContext, inject, Injector, Signal } from "@angular/core";
import { NG_DEV_MODE } from "../shared";
import { CleanupScope } from "../signals";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";
import { NgTimers } from "../ng_timers/ng_timers";

export interface CreateTimerOptions {
  period?: number;
  injector?: Injector;
  debugName?: string;
}

/**
 * Creates a signal that will wait for a specific time period before changing its value to 0. This signal
 * can be created only in injection context unless injector is provided to options and it can only be read
 * in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 */
export function timer(delay: number): Signal<undefined | 0>;
/**
 * Creates a signal that will wait for a specific time period before changing its value incrementally from 0 with provided interval period.
 * This signal can be created only in injection context unless injector is provided to options and it can only be read
 * in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 * @param period The interval size in milliseconds.
 */
export function timer(delay: number, period: number): Signal<undefined | number>;
/**
 * Creates a signal that will wait for a specific time period before changing its value. If a period is provided to options, then the timer will change
 * its value incrementally from 0, otherwise will change to zero. This signal can be created only in injection context unless injector is provided to options
 * and it can only be read in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 * @param options A timer creation options.
 *
 * @see {@link CreateTimerOptions}
 */
export function timer(delay: number, options: { period: number } & CreateTimerOptions | undefined): Signal<undefined | number>;
/**
 * Creates a signal that will wait for a specific time period before changing its value. If a period is provided to options, then the timer will change
 * its value incrementally from 0, otherwise will change to zero. This signal can be created only in injection context unless injector is provided to options
 * and it can only be read in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 * @param options A timer creation options.
 *
 * @see {@link CreateTimerOptions}
 */
export function timer(delay: number, options: CreateTimerOptions | undefined): Signal<undefined | 0>;
/**
 * Creates a signal that will wait for exact date before changing its value to 0. This signal
 * can be created only in injection context unless injector is provided to options  and it can only be read
 * in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 */
export function timer(startAt: Date): Signal<undefined | 0>;
/**
 * Creates a signal that will wait for exact date before changing its value incrementally from 0 with provided interval period.
 * This signal can be created only in injection context unless injector is provided to options and it can only be read
 * in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 * @param period The interval size in milliseconds.
 */
export function timer(startAt: Date, period: number): Signal<undefined | 0>;
/**
 * Creates a signal that will wait for exact date before changing its value. If a period is provided to options, then the timer will change
 * its value incrementally from 0, otherwise will change to zero. This signal can be created only in injection context unless injector is provided to options
 * and it can only be read in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 * @param options A timer creation options.
 *
 * @see {@link CreateTimerOptions}
 */
export function timer(startAt: Date, options: { period: number } & CreateTimerOptions | undefined): Signal<undefined | number>;
/**
 * Creates a signal that will wait for exact date before changing its value. If a period is provided to options, then the timer will change
 * its value incrementally from 0, otherwise will change to zero. This signal can be created only in injection context unless injector is provided to options
 * and it can only be read in reactive context like effect() or component template.
 * @param delay time in milliseconds after which the signal will change.
 * @param options A timer creation options.
 *
 * @see {@link CreateTimerOptions}
 */
export function timer(startAt: Date, options: CreateTimerOptions | undefined): Signal<undefined | 0>;
export function timer(delayOrStartAt: number | Date, periodOrOptions?: number | CreateTimerOptions | undefined): Signal<undefined | number> {
  const options = periodOrOptions != null && typeof periodOrOptions === 'object' ? periodOrOptions : undefined;
  const period = typeof periodOrOptions === 'number' ? periodOrOptions : options?.period;

  NG_DEV_MODE && !CleanupScope.current() && !options?.injector && assertInInjectionContext(timer);

  const injector = CleanupScope.current()?.injector ?? options?.injector ?? inject(Injector);
  const ngTimers = injector.get(NgTimers);
  const ms = typeof delayOrStartAt === 'number' ? delayOrStartAt : Date.now() - delayOrStartAt.getTime();

  let timeoutCleanup: VoidFunction = null!;
  let intervalCleanup: VoidFunction | null = null;

  const outputSignal = createContextAwareSignal<undefined | number>(
    undefined,
    function(set, update) {
      timeoutCleanup = ngTimers.setTimeout(() => {
        set(0);
        if (typeof period === 'number') {
          intervalCleanup = ngTimers.setInterval(() => {
            update((value) => ++value!);
          }, period);
        }
      }, ms)
    },
    function() {
      timeoutCleanup();
      intervalCleanup?.();
    },
    timer,
    options?.debugName
  )

  return outputSignal;
}
