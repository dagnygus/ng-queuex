import { PriorityLevel, priorityNameToNumber, PriorityName } from './../scheduler/scheduler_utils';
import { assertInInjectionContext, assertNotInReactiveContext, DestroyRef, EffectCleanupRegisterFn, EffectRef, inject } from "@angular/core";
import { createWatch, Watch } from "@angular/core/primitives/signals";
import { scheduleTask } from "../instructions/instructions";
import { NG_DEV_MODE } from '../utils';
import { INTEGRATION_NOT_COMPLETED_MESSAGE, INTEGRATION_NOT_PROVIDED_MESSAGE, Integrator, SERVER_SIDE_MESSAGE } from '../environment/environment';

/**
 * Options to configure a concurrent effect created via `concurrentEffect()`.
 *
 * @interface ConcurrentEffectOptions
 *
 * @property {PriorityName} [priority]
 * Optional priority level (e.g. 'highest' | 'high' | 'normal' | 'low' | 'lowest').
 * Determines how soon the scheduled task should be executed by the concurrent scheduler.
 * Default is 'normal'
 *
 * @property {boolean} [manualCleanup]
 * If `true`, the effect will not automatically register cleanups and must be cleaned up manually.
 *
 * @property {DestroyRef} [destroyRef]
 * Optional Angular `DestroyRef` to automatically dispose of the effect when the hosting context is destroyed.
 *
 * @property {boolean} [allowSignalWrites]
 * Allows writing to signals within the effect execution context.
 * Defaults to `false` for safety.
 */
export interface ConcurrentEffectOptions {

  /**
   * Optional priority level (e.g. 'highest' | 'high' | 'normal' | 'low' | 'lowest').
   * Determines how soon the scheduled task should be executed by the concurrent scheduler.
   * Default is 'normal'
   */
  priority?: PriorityName,

  /**
   * If `true`, the effect will not automatically register cleanups and must be cleaned up manually.
   */
  manualCleanup?: boolean,

  /**
   * Optional Angular `DestroyRef` to automatically dispose of the effect when the hosting context is destroyed.
   */
  destroyRef?: DestroyRef,

  /**
   * Allows writing to signals within the effect execution context.
   * Defaults to `false` for safety.
   */
  allowSignalWrites?: boolean
}

class EffectRefImpl implements EffectRef {
  private _watcher: Watch;

  constructor(
    fn: (onCleanup: EffectCleanupRegisterFn) => void,
    priorityLevel: PriorityLevel,
    allowSignalWrites: boolean,
  ) {
    this._watcher = createWatch(
      fn,
      () => scheduleTask(() => this._watcher.run(), priorityLevel),
      allowSignalWrites
    );
    this._watcher.notify();
  }

  destroy(): void {
    this._watcher.destroy();
  }
}

/**
 * Creates a concurrent effect — a reactive computation scheduled and coordinated
 * by the concurrent scheduler from `ng-queuex/core`.
 *
 * Unlike Angular’s built-in `effect()`, this variant introduces: **Priority-based scheduling** (`highest` → `lowest`),
 *
 * The effect body is executed through a `Watch` that is detached from Angular’s
 * change detection cycles. Its execution is triggered by the scheduler at the
 * configured priority level, ensuring deterministic and efficient updates.
 *
 * @param effectFn - Effect function to execute.
 *   Receives a cleanup registration callback `(onCleanup) => { ... }` used to register
 *   teardown logic (e.g. clearing timers, unsubscribing observables).
 *
 * @param options - (Optional) effect configuration:
 * - `priority`: Scheduler priority (`'highest' | 'high' | 'normal' | 'low' | 'lowest'`).
 *   Defaults to `'normal'`.
 * - `manualCleanup`: If `true`, the effect must be explicitly destroyed.
 *   Defaults to `false`.
 * - `destroyRef`: An Angular `DestroyRef` to hook automatic cleanup into.
 *   If omitted and `manualCleanup` is `false`, one will be injected.
 * - `allowSignalWrites`: Enables writes to signals inside the effect.
 *   Defaults to `false`.
 *
 * @returns {@link EffectRef} A reference handle that allows manual destruction
 * of the effect via `effectRef.destroy()`.
 *
 * @throws If is used in reactive context.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 *
 * @example
 * ```ts
 * const ref = concurrentEffect((onCleanup) => {
 *   const id = setInterval(() => console.log('tick'), 1000);
 *   onCleanup(() => clearInterval(id));
 * }, { priority: 'high' });
 *
 * // Destroy manually if manualCleanup = true
 * ref.destroy();
 * ```
 */
export function concurrentEffect(effectFn: (onCleanup: EffectCleanupRegisterFn) => void, options?: ConcurrentEffectOptions): EffectRef {
  if (NG_DEV_MODE) {
    assertNotInReactiveContext(concurrentEffect);
    if (Integrator.instance === null) {
      throw new Error('concurrentEffect(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
    }
    if (Integrator.instance.isServer) {
      throw new Error('concurrentEffect(): ' + SERVER_SIDE_MESSAGE);
    }
    if (Integrator.instance.uncompleted) {
      throw new Error('concurrentEffect(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE)
    }
  }

  const priorityLevel = priorityNameToNumber(options?.priority ?? 'normal');
  const manualCleanup = options?.manualCleanup ?? false;
  const allowSignalWrites = options?.allowSignalWrites ?? false
  let destroyRef = options?.destroyRef ?? null;

  if (NG_DEV_MODE && !manualCleanup && !destroyRef) {
    assertInInjectionContext(concurrentEffect);
  }

  if (!manualCleanup && !destroyRef) {
    destroyRef = inject(DestroyRef);
  }

  const effectRef = new EffectRefImpl(effectFn, priorityLevel, allowSignalWrites);

  if (!manualCleanup) {
    (destroyRef ??= inject(DestroyRef)).onDestroy(() => effectRef.destroy())

  }

  return effectRef;
}
