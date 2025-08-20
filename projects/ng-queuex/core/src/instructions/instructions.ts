import type {
  assertInConcurrentTaskContext,
  assertInConcurrentCleanTaskContext,
  assertInConcurrentDirtyTaskContext,
  isInConcurrentDirtyTaskContext
} from "../scheduler/scheduler";
import type {
  provideNgQueuexIntegration
} from "../environment/environment";
import {
  ChangeDetectorRef,
} from "@angular/core";
import {
  coercePriority,
  noopFn,
  Priority,
  SchedulerTask,
  TaskStatus,
  PriorityLevel,
  PriorityName
} from "../scheduler/scheduler_utils";
import {
  getCurrentTask,
  isInConcurrentCleanTaskContext,
  isInConcurrentTaskContext,
  scheduleCallback
} from "../scheduler/scheduler";
import { Integrator, USAGE_EXAMPLE_IN_UNIT_TESTS } from "../environment/environment";

declare const ngDevMode: boolean | undefined;

type _ViewRef = ChangeDetectorRef & { _lView?: object };

const INTEGRATION_NOT_PROVIDED_MESSAGE =
  '"@ng-queuex/core" integration was not provided to Angular! ' +
  'Use provideNgQueuexIntegration() function to in bootstrapApplication() function ' +
  'to add crucial environment providers for integration.';

const SERVER_SIDE_MESSAGE = 'Scheduling concurrent tasks on server is not allowed!'
const INTEGRATION_NOT_COMPLETED_MESSAGE =
  '"@ng-queuex/core" integration for tests is not competed. To make sure that integration is finalized ' +
  'use \'completeIntegrationForTest()\' function inside TestBed injection context as the example below shows:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS

const coalescingScopes = new WeakMap<object, SchedulerTask>();

/**
 * @description
 * An interface describing task aborting function. Invoking this function without arguments will abort task. However if you provide a function, it will not abort task but instead it
 * will set a callback what will run when task gets aborted. If there already is a callback, it will be overridden.
 */
export interface AbortTaskFunction {
  /**
   * @description
   * Aborting task call.
   */
  (): void;

  /**
   * @description
   * Sets a callback what will run when task gets aborted. If there already is a callback, it will be overridden.
   */
  (abortCallback: VoidFunction | null): void;
}

/**
 * @description
 * Schedules a task with default priority (`Priority.Normal`) what will trigger cdRef.detectChanges() method, unless it was schedules earle before
 * with same or higher priority. Under the hood there is coalescing mechanism implement.
 *
 * Lest look at this example.
 * ```ts
 *  private _cdRef = inject(ChangeDetectorRef)
 *
 *  public onButtonClick(): void {
 *    detectChanges(this._cdRef); // Task successfully scheduled.
 *    detectChanges(this._cdRef); // Scheduling prevented.
 *    detectChanges(this._cdRef); // Scheduling prevented.
 *  }
 * ```
 * In example above change detection is coalesced. Lets consider different example with task abortion.
 * ```ts
 *  private _cdRef = inject(ChangeDetectorRef)
 *
 *  public onButtonClick(): void {
 *    const abort = detectChanges(this._cdRef); // Task successfully scheduled.
 *    abort() // Task from above is now aborted.
 *    detectChanges(this._cdRef); // Task successfully scheduled.
 *    detectChanges(this._cdRef); // Scheduling prevented.
 *  }
 * ```
 * From this now you know how you can delegate change detection to other task. There is also one more scenario when task can be aborted without
 * calling abort function.
 * ```ts
 *  private _cdRef = inject(ChangeDetectorRef)
 *
 *  public onButtonClick(): void {
 *    detectChanges(this._cdRef); // Task successfully scheduled, but will be aborted.
 *    detectChanges(this._cdRef); // Scheduling prevented.
 *
 *    // Previous task is aborted and change detection is rescheduled, to be executed earlier.
 *    detectChanges(this._cdRef, Priority.High);
 *  }
 * ```
 * Change detection scheduled with higher priority will abort this one with lower. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param cdRef A component `ChangeDetectorRef` or `ViewRef` of the embedded view.
 * @returns Abort task function if change detection was successfully scheduled. Null if change detection was coalesced.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link ChangeDetectorRef}
 * @see ViewRef from "@angular/core"
 * @see EmbeddedViewRef from "@angular/core"
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function detectChanges(cdRef: ChangeDetectorRef): AbortTaskFunction | null;
/**
 * @description
 * Schedules a task with default priority (`Priority.Normal`) what will trigger cdRef.detectChanges() method, unless it was schedules earle before
 * with same or higher priority. Under the hood there is coalescing mechanism implement.
 *
 * Lest look at this example.
 * ```ts
 *  private _cdRef = inject(ChangeDetectorRef)
 *
 *  public onButtonClick(): void {
 *    detectChanges(this._cdRef, Priority.Normal); // Task successfully scheduled.
 *    detectChanges(this._cdRef, Priority.Normal); // Scheduling prevented.
 *    detectChanges(this._cdRef, Priority.Normal); // Scheduling prevented.
 *  }
 * ```
 * In example above change detection is coalesced. Lets consider different example with task abortion.
 * ```ts
 *  private _cdRef = inject(ChangeDetectorRef)
 *
 *  public onButtonClick(): void {
 *    const abort = detectChanges(this._cdRef, Priority.Normal); // Task successfully scheduled.
 *    abort() // Task from above is now aborted.
 *    detectChanges(this._cdRef, Priority.Normal); // Task successfully scheduled.
 *    detectChanges(this._cdRef, Priority.Normal); // Scheduling prevented.
 *  }
 * ```
 * From this now you know how you can delegate change detection to other task. There is also one more scenario when task can be aborted without
 * calling abort function.
 * ```ts
 *  private _cdRef = inject(ChangeDetectorRef)
 *
 *  public onButtonClick(): void {
 *    detectChanges(this._cdRef, Priority.Normal); // Task successfully scheduled, but will be aborted.
 *    detectChanges(this._cdRef, Priority.Normal); // Scheduling prevented.
 *
 *    // Previous task is aborted and change detection is rescheduled, to be executed earlier.
 *    detectChanges(this._cdRef, Priority.High);
 *  }
 * ```
 * Change detection scheduled with higher priority will abort this one with lower. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param cdRef A component `ChangeDetectorRef` or `ViewRef` of the embedded view.
 * @param priority Concurrent task execution priority.
 * @returns Abort task function if change detection was successfully scheduled. Null if change detection was coalesced.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link ChangeDetectorRef}
 * @see ViewRef from "@angular/core"
 * @see EmbeddedViewRef from "@angular/core"
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function detectChanges(cdRef: ChangeDetectorRef, priority: PriorityLevel): AbortTaskFunction | null;
export function detectChanges(cdRef: ChangeDetectorRef, priority: PriorityLevel = 3 /* Priority.Normal */): AbortTaskFunction | null {

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    if (Integrator.instance === null) {
      throw new Error('detectChanges(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
    }
    if (Integrator.instance.isServer) {
      throw new Error('detectChanges(): ' + SERVER_SIDE_MESSAGE);
    }
    if (Integrator.instance.uncompleted) {
      throw new Error('detectChanges(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE)
    }
  }

  let scope: object = cdRef;

  if (typeof (cdRef as _ViewRef)._lView === 'object') {
    scope = (cdRef as _ViewRef)._lView!
  }

  const relatedTask = coalescingScopes.get(scope);

  if (relatedTask) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (relatedTask.status === TaskStatus.Aborted) {
        throw new Error('InternalError: Related task to CdRef is aborted to early!');
      }
      if (relatedTask.status === TaskStatus.Executed) {
        throw new Error('InternalError: Related task to cdRef is executed but coalescing scope is not deleted!');
      }
    }

    if (priority >= relatedTask.priorityLevel ||
      relatedTask.status === TaskStatus.Prepared ||
      relatedTask.status === TaskStatus.Executing
    ) {
      return null;
    }

    // At this place related task is pending.
    // We need to abort this task because it has lower priority.
    relatedTask.abort();
  }

  let task: SchedulerTask | null = scheduleCallback(coercePriority(priority), function() {
    cdRef.detectChanges();
  });

  task.isClean = false;

  coalescingScopes.set(scope, task);

  task.beforeExecute = function() {
    task = null;
  };

  task.internalOnExecutedListeners = [];

  task.internalOnExecutedListeners.push(function () {
    coalescingScopes.delete(scope)
  })

  function abortTask(cb?: VoidFunction | null): void {
    if (task) {
      if (typeof cb === 'function') {
        task.onAbort = cb;
      } else if (cb === null) {
        task.onAbort = noopFn;
      } else {
        task.callback = null;
        task.status = TaskStatus.Aborted;
        const onAbort = task.onAbort;
        task = null;
        onAbort();
        coalescingScopes.delete(scope);
      }

    }
  }

  task.abort = abortTask;

  return abortTask;
}


/**
 * @description
 * Schedules a task with default priority (`Priority.Normal`) and with provided callback which will be executed. The main difference
 * from `scheduleTask()` is that it is involved internal coalescing mechanism. Consider to use `detectChangesSync()` function to
 * improve coalescing. The example below illustrates how coalescing works.
 * ```ts
 *  private _cdRef = inject(ChangeDetectionRef);
 *
 *  public onButtonClick(): void {
 *    scheduleChangeDetection(() => {
 *      detectChangesSync(this._cdRef); //This line will trigger change detection. returns true.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *    });
 *  }
 * ```
 * As you can see, in concurrent task execution context you can trigger change detection once. With ```detectChanges()``` function
 * used side by side, there is a situation where coalescing will appear.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    // This call will abort task created bellow, because that task doesn't have a higher priority
 *    detectChangesSync(this._cdRef);
 *  });
 *
 *  detectChanges(this._cdRer); // Task successfully scheduled, but will be aborted
 * ```
 * However if you provide higher priority to `detectChanges()` function, coalescing will failed and change detection will be triggered twice.
 * ```ts
 *  //This task has default Priority.Normal.
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  });
 *
 *  // Task successfully scheduled and will be execute earlier then task from above.
 *  detectChanges(this._cdRer, Priority.High);
 * ```
 * For same priorities, coalescing will also failed if you change execution order.
 * ```ts
 *  //Task successfully scheduled and will be executed earlier then task below.
 *  detectChanges(this._cdRer);
 *
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  });
 * ```
 * To improve coalescing for these unfavorable scenarios, provide `cdRef` to `scheduleChangeDetection()` function,
 * as a third argument.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, this._cdRef);
 *
 *  detectChanges(this._cdRef);
 * ```
 * Task in witch is involved coalescing system of change detection is called `dirty task`. In contrast task created with
 * function `scheduleTask()` is called `clean task`. `Clean task` can be aborted only by function returned by `scheduleTask()`.
 *
 * @caution
 * There is nothing to prevent you to use multiple `ChangeDetectionRef` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort dirty tasks for you. See description of `detectChanges()` function. If you want do add teardown logic to task abortion
 * see the description of `AbortTaskFunction` interface. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param callback Concurrent task callback.
 * @returns Abort task function.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentDirtyTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentDirtyTaskContext}
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleChangeDetection(callback: VoidFunction): AbortTaskFunction;
/**
 * @description
 * Schedules a task with provided callback which will be executed. The main difference from `scheduleTask()` is that it is involved
 * internal coalescing mechanism. Consider to use `detectChangesSync()` function to improve coalescing. The example
 * below illustrates how coalescing works.
 * ```ts
 *  private _cdRef = inject(ChangeDetectionRef);
 *
 *  public onButtonClick(): void {
 *    scheduleChangeDetection(() => {
 *      detectChangesSync(this._cdRef); //This line will trigger change detection. returns true.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *    }, Priority.Normal);
 *  }
 * ```
 * As you can see, in concurrent task execution context you can trigger change detection once. With ```detectChanges()``` function
 * used side by side, there is a situation where coalescing will appear.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    // This call will abort task created bellow, because that task doesn't have a higher priority
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal);
 *
 *  detectChanges(this._cdRer); // Task successfully scheduled, but will be aborted
 * ```
 * However if you provide higher priority to `detectChanges()` function, coalescing will failed and change detection will be triggered twice.
 * ```ts
 *  //This task has default Priority.Normal.
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal);
 *
 *  // Task successfully scheduled and will be execute earlier then task from above.
 *  detectChanges(this._cdRer, Priority.High);
 * ```
 * For same priorities, coalescing will also failed if you change execution order.
 * ```ts
 *  //Task successfully scheduled and will be executed earlier then task below.
 *  detectChanges(this._cdRer);
 *
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal);
 * ```
 * To improve coalescing for these unfavorable scenarios, provide `cdRef` to `scheduleChangeDetection()` function,
 * as a third argument.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, this._cdRef);
 *
 *  detectChanges(this._cdRef);
 * ```
 * Task in witch is involved coalescing system of change detection is called `dirty task`. In contrast task created with
 * function `scheduleTask()` is called `clean task`. `Clean task` can be aborted only by function returned by `scheduleTask()`.
 *
 * @caution
 * There is nothing to prevent you to use multiple `ChangeDetectionRef` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort tasks for you. See description of `detectChanges()` function. If you want do add teardown logic to task abortion
 * see the description of `AbortTaskFunction` interface. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = scheduleChangeDetection(...);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @returns Abort task function.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentDirtyTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentDirtyTaskContext}
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel): AbortTaskFunction;
/**
 * @description
 * Schedules a task with provided callback which will be executed. The main difference from `scheduleTask()` is that it is involved
 * internal coalescing mechanism. Consider to use `detectChangesSync()` function to improve coalescing. The example
 * below illustrates how coalescing works.
 * ```ts
 *  private _cdRef = inject(ChangeDetectionRef);
 *
 *  public onButtonClick(): void {
 *    scheduleChangeDetection(() => {
 *      detectChangesSync(this._cdRef); //This line will trigger change detection. returns true.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *    }, Priority.Normal, null);
 *  }
 * ```
 * As you can see, in concurrent task execution context you can trigger change detection once. With ```detectChanges()``` function
 * used side by side, there is a situation where coalescing will appear.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    // This call will abort task created bellow, because that task doesn't have a higher priority
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, null);
 *
 *  detectChanges(this._cdRer); // Task successfully scheduled, but will be aborted
 * ```
 * However if you provide higher priority to `detectChanges()` function, coalescing will failed and change detection will be triggered twice.
 * ```ts
 *  //This task has default Priority.Normal.
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal, null);
 *
 *  // Task successfully scheduled and will be execute earlier then task from above.
 *  detectChanges(this._cdRer, Priority.High);
 * ```
 * For same priorities, coalescing will also failed if you change execution order.
 * ```ts
 *  //Task successfully scheduled and will be executed earlier then task below.
 *  detectChanges(this._cdRer);
 *
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal, null);
 * ```
 * To improve coalescing for these unfavorable scenarios, provide `cdRef` to `scheduleChangeDetection()` function,
 * as a third argument.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, this._cdRef);
 *
 *  detectChanges(this._cdRef);
 * ```
 * Task in witch is involved coalescing system of change detection is called `dirty task`. In contrast task created with
 * function `scheduleTask()` is called `clean task`. `Clean task` can be aborted only by function returned by `scheduleTask()`.
 *
 * @caution
 * There is nothing to prevent you to use multiple `ChangeDetectionRef` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort tasks for you. See description of `detectChanges()` function. If you want do add teardown logic to task abortion
 * see the description of `AbortTaskFunction` interface. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = scheduleChangeDetection(...);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @returns Abort task function.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentDirtyTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentDirtyTaskContext}
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: null): AbortTaskFunction;
/**
 * @description
 * Schedules a task with provided callback which will be executed. The main difference from `scheduleTask()` is that it is involved
 * internal coalescing mechanism. Consider to use `detectChangesSync()` function to improve coalescing. The example
 * below illustrates how coalescing works.
 * ```ts
 *  private _cdRef = inject(ChangeDetectionRef);
 *
 *  public onButtonClick(): void {
 *    scheduleChangeDetection(() => {
 *      detectChangesSync(this._cdRef); //This line will trigger change detection. returns true.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *    }, Priority.Normal);
 *  }
 * ```
 * As you can see, in concurrent task execution context you can trigger change detection once. With `detectChanges()` function
 * used side by side, there is a situation where coalescing will appear.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    // This call will abort task created bellow, because that task doesn't have a higher priority
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal);
 *
 *  detectChanges(this._cdRer); // Task successfully scheduled, but will be aborted
 * ```
 * However if you provide higher priority to `detectChanges()` function, coalescing will failed and change detection will be triggered twice.
 * ```ts
 *  //This task has default Priority.Normal.
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal);
 *
 *  // Task successfully scheduled and will be execute earlier then task from above.
 *  detectChanges(this._cdRer, Priority.High);
 * ```
 * For same priorities, coalescing will also failed if you change execution order.
 * ```ts
 *  //Task successfully scheduled and will be executed earlier then task below.
 *  detectChanges(this._cdRer);
 *
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal);
 * ```
 * To improve coalescing for these unfavorable scenarios, provide `cdRef` to `scheduleChangeDetection()` function,
 * as a third argument.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, this._cdRef);
 *
 *  detectChanges(this._cdRef);
 * ```
 * Task in witch is involved coalescing system of change detection is called `dirty task`. In contrast task created with
 * function `scheduleTask()` is called `clean task`. `Clean tas`` can be aborted only by function returned by `scheduleTask()`.
 *
 * @caution
 * There is nothing to prevent you to use multiple `ChangeDetectionRef` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort tasks for you. See description of `detectChanges()` function. If you want do add teardown logic to task abortion
 * see the description of `AbortTaskFunction` interface. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = scheduleChangeDetection(...);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @param cdRef A object of type `ChangeDetectorRef` what will be potentially consumed in callbacks body or null.
 * @returns Abort task function if task was successfully scheduled. Null if change detection was coalesced.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link ChangeDetectorRef}
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentDirtyTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentDirtyTaskContext}
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: ChangeDetectorRef): AbortTaskFunction | null;
/**
 * @description
 * Schedules a task with provided callback which will be executed. The main difference from `scheduleTask()` is that it is involved
 * internal coalescing mechanism. Consider to use `detectChangesSync()` function to improve coalescing. The example
 * below illustrates how coalescing works.
 * ```ts
 *  private _cdRef = inject(ChangeDetectionRef);
 *
 *  public onButtonClick(): void {
 *    scheduleChangeDetection(() => {
 *      detectChangesSync(this._cdRef); //This line will trigger change detection. returns true.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *      detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
 *    }, Priority.Normal, null);
 *  }
 * ```
 * As you can see, in concurrent task execution context you can trigger change detection once. With `detectChanges()` function
 * used side by side, there is a situation where coalescing will appear.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    // This call will abort task created bellow, because that task doesn't have a higher priority
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, null);
 *
 *  detectChanges(this._cdRer); // Task successfully scheduled, but will be aborted
 * ```
 * However if you provide higher priority to `detectChanges()` function, coalescing will failed and change detection will be triggered twice.
 * ```ts
 *  //This task has default Priority.Normal.
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal, null);
 *
 *  // Task successfully scheduled and will be execute earlier then task from above.
 *  detectChanges(this._cdRer, Priority.High);
 * ```
 * For same priorities, coalescing will also failed if you change execution order.
 * ```ts
 *  //Task successfully scheduled and will be executed earlier then task below.
 *  detectChanges(this._cdRer);
 *
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef); // This call will trigger change detection.
 *  }, Priority.Normal, null);
 * ```
 * To improve coalescing for these unfavorable scenarios, provide `cdRef` to `scheduleChangeDetection()` function,
 * as a third argument.
 * ```ts
 *  scheduleChangeDetection(() => {
 *    detectChangesSync(this._cdRef);
 *  }, Priority.Normal, this._cdRef);
 *
 *  detectChanges(this._cdRef);
 * ```
 * Task in witch is involved coalescing system of change detection is called `dirty task`. In contrast task created with
 * function `scheduleTask()` is called `clean task`. `Clean tas`` can be aborted only by function returned by `scheduleTask()`.
 *
 * @caution
 * There is nothing to prevent you to use multiple `ChangeDetectionRef` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort tasks for you. See description of `detectChanges()` function. If you want do add teardown logic to task abortion
 * see the description of `AbortTaskFunction` interface. Regardless of whatever the task gets aborted by you or by internal
 * coalescing mechanism, you can always set abort callback what will be call when task gets aborted.
 * ```ts
 *  const abortTask = scheduleChangeDetection(...);
 *
 *  abortTask(() => {...}) // abort callback is now set;
 *  abortTask(() => {...}) // abort callback is overridden by new one;
 * ```
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @param cdRef A object of type `ChangeDetectorRef` what will be potentially consumed in callbacks body or null.
 * @returns Abort task function if task was successfully scheduled. Null if change detection was coalesced.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link ChangeDetectorRef}
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentDirtyTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentDirtyTaskContext}
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: ChangeDetectorRef | null): AbortTaskFunction | null;
export function scheduleChangeDetection(
  callback: VoidFunction,
  priority: PriorityLevel = 3, //Priority.Normal
  cdRef: ChangeDetectorRef | null = null,
): AbortTaskFunction | null {

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    if (Integrator.instance === null) {
      throw new Error('scheduleChangeDetection(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
    }
    if (Integrator.instance.isServer) {
      throw new Error('scheduleChangeDetection(): ' + SERVER_SIDE_MESSAGE);
    }
    if (Integrator.instance.uncompleted) {
      throw new Error('scheduleChangeDetection(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE)
    }
  }

  let scope: object | null = cdRef;

  if (cdRef) {
    if (typeof (cdRef as _ViewRef)._lView === 'object') {
      scope = (cdRef as _ViewRef)._lView!
    }
  }

  if (scope) {
    const relatedTask = coalescingScopes.get(scope);

    if (relatedTask) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (relatedTask.status === TaskStatus.Aborted) {
          throw new Error('InternalError: Related task to CdRef is aborted to early!');
        }
        if (relatedTask.status === TaskStatus.Executed) {
          throw new Error('InternalError: Related task to cdRef is executed but coalescing scope is not deleted!');
        }
      }

      if (
        priority >= relatedTask.priorityLevel || // Lower priority has bigger number
        relatedTask.status === TaskStatus.Prepared ||
        relatedTask.status === TaskStatus.Executing
      ) {
        return null;
      }

      //We need to abort this task because it has lower priority.
      relatedTask.abort();
    }
  }

  let task: SchedulerTask | null = scheduleCallback(coercePriority(priority), callback);

  task.isClean = false;

  if (scope) {
    coalescingScopes.set(scope, task)
    task.scopeToHandle = scope;
  }

  task.beforeExecute = function() {
    task!.onAbort = noopFn;
    task = null;
  }

  task.internalOnExecutedListeners = [];

  task.internalOnExecutedListeners.push(function() {
    if (scope) {
      coalescingScopes.delete(scope);
    }
  });



  function abortTask(cb?: VoidFunction | null) {
    if (task) {
      if (typeof cb === 'function') {
        task.onAbort = cb;
      } else if (cb === null) {
        task.onAbort = noopFn;
      } else {
        task.callback = null;
        task.status = TaskStatus.Aborted;
        // task.scopeToHandle = null; // When scheduler will have implement caching, then we can uncomment that line.
        const onAbort = task.onAbort;
        task = null;
        onAbort();
        if (scope) {
          coalescingScopes.delete(scope);
        }
      }

    }
  }

  task.abort = abortTask;

  return abortTask;
}

/**
 * Schedules a task with default priority (`Priority.Normal`) and with provided callback witch will be executed.
 * Task created with that function is called `clean task`. That means there is not involved any coalescing system related to
 * change detection, and that task can be aborted only by function returned by `scheduleTask()`. If you want to know more
 * about difference between `clean task` and `dirty task` , read a description of `scheduleChangeDetection()` function.
 *
 * @param callback Concurrent task callback.
 * @returns Abort task function.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentCleanTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentCleanTaskContext}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleTask(callback: VoidFunction): AbortTaskFunction;
/**
 * Schedules a task with provided callback witch will be executed. Task created with that function is called `clean task`.
 * That means there is not involved any coalescing system related to change detection, and that task can be aborted only by
 * function returned by `scheduleTask()`. If you want to know more about difference between `clean task` and
 * `dirty task` , read a description of `scheduleChangeDetection()` function.
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @returns Abort task function.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link Priority}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link assertInConcurrentTaskContext}
 * @see {@link assertInConcurrentCleanTaskContext}
 * @see {@link isInConcurrentTaskContext}
 * @see {@link isInConcurrentCleanTaskContext}
 * @see {@link AbortTaskFunction}
 * @see {@link provideNgQueuexIntegration}
 */
export function scheduleTask(callback: VoidFunction, priority: PriorityLevel): AbortTaskFunction;
export function scheduleTask(callback: VoidFunction, priority: Priority = 3 /* Priority.Normal */): AbortTaskFunction {

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    if (Integrator.instance === null) {
      throw new Error('scheduleTask(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
    }
    if (Integrator.instance.isServer) {
      throw new Error('scheduleTask(): ' + SERVER_SIDE_MESSAGE);
    }
    if (Integrator.instance.uncompleted) {
      throw new Error('scheduleTask(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE)
    }
  }

  let task: SchedulerTask | null = scheduleCallback(coercePriority(priority), callback);

  task.beforeExecute = function() { task = null; }

  return function(cb?: VoidFunction | null) {
    if (task) {
      if (typeof cb === 'function') {
        task.onAbort = cb;
      } else if (cb === null) {
        task.onAbort = noopFn;
      } else {
        task.callback = null;
        task.status = TaskStatus.Aborted;
        const onAbort = task.onAbort;
        task = null;
        onAbort();
      }
    }
  };
}

/**
 * @description
 * Tries to invoke `cdRef.detectChanges()` method synchronously, unless internal coalescing system will prevent this action.
 * To learn more, see descriptions of `scheduleChangeDetection()` and `detectChanges()` functions.
 *
 * @param cdRef a component `ChangeDetectorRef` or `ViewRef` of embedded view.
 * @returns true if succeeded, other wise it was coalesced with concurrent task.
 * @throws `Error` if integration was not provided.
 * @throws `Error` if is server environment.
 * @throws `Error` if integration for unit test is not completed.
 * @see {@link scheduleTask}
 * @see {@link detectChanges}
 * @see {@link ChangeDetectorRef}
 * @see ViewRef from "@angular/core"
 * @see EmbeddedViewRef from "@angular/core"
 * @see {@link provideNgQueuexIntegration}
 */
export function detectChangesSync(cdRef: ChangeDetectorRef): boolean {

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    if (Integrator.instance === null) {
      throw new Error('detectChangesSync(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
    }
    if (Integrator.instance.isServer) {
      throw new Error('detectChangesSync(): This function usage on server is not allowed!');
    }
    if (Integrator.instance.uncompleted) {
      throw new Error('detectChangesSync(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE)
    }
  }

  if (isInConcurrentCleanTaskContext()) {
    cdRef.detectChanges();
    return true;
  }

  let scope: object = cdRef;

  if (typeof (cdRef as _ViewRef)._lView === 'object') {
    scope = (cdRef as _ViewRef)._lView!
  }

  const relatedTask = coalescingScopes.get(scope);
  if (relatedTask) {

    //Internal Errors
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (relatedTask.status === TaskStatus.Aborted) {
        throw new Error('InternalError: Related task to CdRef is aborted to early!');
      }
      if (relatedTask.status === TaskStatus.Executed) {
        throw new Error('InternalError: Related task to cdRef is executed but coalescing scope is not deleted!');
      }
    }

    // According to internal scheduler implementation, we can not have one task marked as "prepared"
    // and other as "executing". For the task what is prepared or executing, the next one in queue
    // is marked as pending for sure. This is the situation where detectChangesSync() outside
    // concurrent task context.
    if (relatedTask.status === TaskStatus.Prepared) { return false; }

    if (relatedTask.status === TaskStatus.Executing) {
      if (relatedTask.scopeToHandle === scope) {
        // scheduleChangeDetection(...) with cdRef as third arg was used to schedule this task. We must consume cdRef now.
        relatedTask.scopeToHandle = null;
        cdRef.detectChanges(); // Coalescing is handled by scheduleChangeDetection(...) function.
        return true;
      } else {
        return false
      }
    }

    //At this place related task is pending. If there is prepared task already or executing right now,
    //we need abort related task and trigger cdRef.detectChanges(). if not, then nothing;
    if (isInConcurrentTaskContext()) {
      relatedTask.abort();
      const currentTask = getCurrentTask()!;
      coalescingScopes.set(scope, currentTask);
      cdRef.detectChanges();
      (currentTask.internalOnExecutedListeners ??= []).push(function() {
        coalescingScopes.delete(scope);
      });
      return true;
    } else {
      return false;
    }
  } else {
    // At that place we know that this cdRef was not scheduled at all.
    if (isInConcurrentTaskContext()) {
      const currentTask = getCurrentTask()!;
      coalescingScopes.set(scope, currentTask);
      cdRef.detectChanges();
      (currentTask.internalOnExecutedListeners ??= []).push(function() {
        coalescingScopes.delete(scope);
      });
    } else {
      cdRef.detectChanges();
    }
    return true;
  }
}
