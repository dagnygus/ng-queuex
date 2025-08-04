import type {
  ViewRef,
  EmbeddedViewRef,
} from "@angular/core";
import type {
  assertConcurrentTaskContext,
  assertConcurrentCleanTaskContext,
  assertConcurrentDirtyTaskContext,
  isConcurrentDirtyTaskContext
} from "../scheduler/scheduler";
import { ChangeDetectorRef, inject } from "@angular/core";
import {
  coercePriority,
  Priority,
  SchedulerTask,
  TaskStatus,
  noopFn
} from "../scheduler/scheduler_utils";
import {
  getCurrentTask,
  isConcurrentCleanTaskContext,
  isConcurrentTaskContext,
  scheduleCallback
} from "../scheduler/scheduler";

declare const ngDevMode: boolean | undefined;

type _ViewRef = ChangeDetectorRef & { _lView?: object };

const coalescingScopes = new WeakMap<object, SchedulerTask>();

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
 * Change detection scheduled with higher priority will abort this one with lower.
 *
 * @param cdRef A component ```ChangeDetectorRef``` or ```ViewRef``` of the embedded view.
 * @returns abort task function.
 * @see {@link Priority}
 * @see {@link ChangeDetectorRef}
 * @see {@link ViewRef}
 * @see {@link EmbeddedViewRef}
 */
export function detectChanges(cdRef: ChangeDetectorRef): VoidFunction;
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
 * Change detection scheduled with higher priority will abort this one with lower.
 * @param cdRef A component `ChangeDetectorRef` or `ViewRef` of the embedded view.
 * @param priority Concurrent task execution priority.
 * @returns abort task function.
 * @see {@link Priority}
 * @see {@link ChangeDetectorRef}
 * @see {@link ViewRef}
 * @see {@link EmbeddedViewRef}
 */
export function detectChanges(cdRef: ChangeDetectorRef, priority: Priority): VoidFunction;
export function detectChanges(cdRef: ChangeDetectorRef, priority: Priority = 2): VoidFunction {

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
      return noopFn;
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

  task.internalOnExecutedListeners.push(function () {
    coalescingScopes.delete(scope)
  })

  function abortTask(): void {
    if (task) {
      task.callback = null;
      task.status = TaskStatus.Aborted;
      task = null;
      coalescingScopes.delete(scope);
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
 * mechanism can abort dirty tasks for you. See description of `detectChanges()` function.
 *
 * @param callback Concurrent task callback.
 * @returns Abort task function.
 * @see {@link Priority}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 */
export function scheduleChangeDetection(callback: VoidFunction): VoidFunction;
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
 * function `scheduleTask()` is called `clean task`. ```Clean task``` can be aborted only by function returned by `scheduleTask()`.
 *
 * @caution
 * There is nothing to prevent you to use multiple `ChangeDetectionRef` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort tasks for you. See description of `detectChanges()` function.
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @returns Abort task function.
 * @see {@link Priority}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 */
export function scheduleChangeDetection(callback: VoidFunction, priority: Priority): VoidFunction;
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
 * There is nothing to prevent you to use multiple ```ChangeDetectionRef``` objects in callbacks body, but remember that internal coalescing
 * mechanism can abort tasks for you. See description of ```detectChanges()``` function.
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @param cdRef A object of type ```ChangeDetectorRef``` what will be potentially consumed in callbacks body or null.
 * @returns Abort task function.
 * @see {@link ChangeDetectorRef}
 * @see {@link Priority}
 * @see {@link detectChangesSync}
 * @see {@link detectChanges}
 */
export function scheduleChangeDetection(callback: VoidFunction, priority: Priority, cdRef: ChangeDetectorRef | null): VoidFunction;
export function scheduleChangeDetection(
  callback: VoidFunction,
  priority: Priority = Priority.Normal,
  cdRef: ChangeDetectorRef | null = null,
): VoidFunction {

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
        return noopFn;
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

  task.beforeExecute = function() { task = null; }

  task.internalOnExecutedListeners.push(function() {
    if (scope) {
      coalescingScopes.delete(scope);
    }
  });



  function abortTask() {
    if (task) {
      task.callback = null;
      task.status = TaskStatus.Aborted;
      task.scopeToHandle = null;
      task = null;
      if (scope) {
        coalescingScopes.delete(scope);
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
 * @see {@link assertConcurrentTaskContext}
 * @see {@link assertConcurrentCleanTaskContext}
 * @see {@link isConcurrentTaskContext}
 * @see {@link isConcurrentCleanTaskContext}
 */
export function scheduleTask(callback: VoidFunction): VoidFunction;
/**
 * Schedules a task with provided callback witch will be executed. Task created with that function is called `clean task`.
 * That means there is not involved any coalescing system related to change detection, and that task can be aborted only by
 * function returned by `scheduleTask()`. If you want to know more about difference between `clean task` and
 * `dirty task` , read a description of `scheduleChangeDetection()` function.
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @returns Abort task function.
 *  * @see {@link assertConcurrentTaskContext}
 * @see {@link assertConcurrentCleanTaskContext}
 * @see {@link isConcurrentTaskContext}
 * @see {@link isConcurrentCleanTaskContext}
 */
export function scheduleTask(callback: VoidFunction, priority: Priority): VoidFunction;
export function scheduleTask(callback: VoidFunction, priority: Priority = Priority.Normal): VoidFunction {

  let task: SchedulerTask | null = scheduleCallback(coercePriority(priority), callback);

  task.beforeExecute = function() { task = null; }

  return function() {
    if (task) {
      task.callback = null;
      task.status = TaskStatus.Aborted
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
 * @see {@link scheduleTask}
 * @see {@link detectChanges}
 * @see {@link ChangeDetectorRef}
 * @see {@link ViewRef}
 * @see {@link EmbeddedViewRef}
 */
export function detectChangesSync(cdRef: ChangeDetectorRef): boolean {

  if (isConcurrentCleanTaskContext()) {
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
    if (isConcurrentTaskContext()) {
      relatedTask.abort();
      const currentTask = getCurrentTask()!
      coalescingScopes.set(scope, currentTask);
      cdRef.detectChanges();
      currentTask.internalOnExecutedListeners.push(function() {
        coalescingScopes.delete(scope);
      });
      return true;
    } else {
      return false;
    }
  } else {
    // At that place we know that this cdRef was not scheduled at all.
    if (isConcurrentTaskContext()) {
      const currentTask = getCurrentTask()!;
      coalescingScopes.set(scope, currentTask);
      cdRef.detectChanges();
      currentTask.internalOnExecutedListeners.push(function() {
        coalescingScopes.delete(scope);
      });
    } else {
      cdRef.detectChanges();
    }
    return true;
  }
}
