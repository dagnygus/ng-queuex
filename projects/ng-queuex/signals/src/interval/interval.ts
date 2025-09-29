import { assertInInjectionContext, inject, Injector, Signal } from "@angular/core";
import { CleanupScope } from "../signals";
import { NG_DEV_MODE } from "../shared";
import { NgTimers } from "../ng_timers/ng_timers";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";

interface CreateIntervalOptions {
  period: number;
  from?: number;
  to?: number;
  injector?: Injector;
  debugName?: string
}



export function interval(period: number): Signal<number>;
export function interval(period: number, from: number): Signal<number>;
export function interval(period: number, from: number, to: number): Signal<number>;
export function interval(period: number, from: number, to: number): Signal<number>;
export function interval(options: CreateIntervalOptions): Signal<number>;
export function interval(periodOrOptions: number | CreateIntervalOptions, from?: number, to?: number): Signal<number> {
  const cleanupScope = CleanupScope.current();
  const options = typeof periodOrOptions === 'object' ? periodOrOptions : undefined;

  NG_DEV_MODE && !cleanupScope && !options?.injector && assertInInjectionContext(interval);

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

  const injector = cleanupScope?.injector ?? options?.injector ?? inject(Injector);
  const ngTimers = injector.get(NgTimers);

  let intervalCleanup: VoidFunction = null!;

  const outputSignal = createContextAwareSignal<number>(
    undefined!,
    (set, update) => {
      set(localFrom);
      intervalCleanup = ngTimers.setInterval(() => {
        update((prev) => !localToDefined ? ++prev : ++prev > localTo! ? localFrom : prev)
      }, period)
    },
    () => {
      intervalCleanup();
    },
    interval,
    options?.debugName
  );

  return outputSignal;
}
