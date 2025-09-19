import * as i0 from '@angular/core';
import { Signal, ChangeDetectorRef, EnvironmentProviders, NgIterable, IterableChangeRecord, TrackByFunction, StaticProvider, DestroyRef, EffectCleanupRegisterFn, EffectRef } from '@angular/core';

/**
 * A string representation of priority.
 */
type PriorityName = 'highest' | 'high' | 'normal' | 'low' | 'lowest';
/**
 * A numeric representation of priority.
 */
type PriorityLevel = 1 | 2 | 3 | 4 | 5;
/**
 * Component input type of priority, representing priority numeric value or priority name.
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 */
type PriorityInput = PriorityLevel | PriorityName;
/**
 *  Concurrent task priority.
 *  ```
 *    Highest = 1
 *    High = 2
 *    Normal = 3 (Mostly a default one)
 *    Low = 4
 *    Lowest = 5
 *  ```
 */
declare enum Priority {
    Highest = 1,
    High = 2,
    Normal = 3,
    Low = 4,
    Lowest = 5
}
/**
 * @description
 * Converts Priority name to corresponding numeric value ('highest' => 1, 'high' => 2, 'normal' => 3, 'low' => 4, 'lowest' => 5).
 * @param priorityName A name of priority ('highest', 'high', 'normal', 'low', 'lowest').
 * @returns Numeric value of priority (1, 2, 3, 4, 5).
 * @throws Error in invalid priority name is provided.
 */
declare function priorityNameToNumber(priorityName: PriorityName): PriorityLevel;
/**
 * @description
 * Converts Priority name to corresponding numeric value ('highest' => 1, 'high' => 2, 'normal' => 3, 'low' => 4, 'lowest' => 5).
 * @param priorityName A name of priority ('highest', 'high', 'normal', 'low', 'lowest').
 * @param debugFn A reference to the function making the assertion (used for the error message).
 * @returns Numeric value of priority (1, 2, 3, 4, 5).
 * @throws Error in invalid priority name is provided.
 */
declare function priorityNameToNumber(priorityName: PriorityName, debugFn: Function): PriorityLevel;
/**
 * @description
 * Transforms priority names to it's raw numeric value.
 * @param value Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5).
 * @returns Priority numeric level.
 * @see {@link PriorityInput}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 */
declare function priorityInputTransform(value: PriorityInput): PriorityLevel;
/**
 * @description
 * Transforms priority names to it's raw numeric values or transforms signal to computed signal with the same manner.
 * @param value Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5) or signal providing the same values.
 * @see {@link PriorityInput}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link priorityInputTransform}
 */
declare function advancePriorityInputTransform(value: PriorityInput | Signal<PriorityInput>): PriorityLevel | Signal<PriorityLevel>;

/**
 * @description
 * An interface describing task aborting function. Invoking this function without arguments will abort task. However if you provide a function, it will not abort task but instead it
 * will set a callback what will run when task gets aborted. If there already is a callback, it will be overridden.
 */
interface AbortTaskFunction {
    /**
     * @description
     * Aborting task call.
     */
    (): void;
    addAbortListener(listener: VoidFunction): void;
    removeAbortListener(listener: VoidFunction): void;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
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
declare function detectChanges(cdRef: ChangeDetectorRef): AbortTaskFunction | null;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
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
declare function detectChanges(cdRef: ChangeDetectorRef, priority: PriorityLevel): AbortTaskFunction | null;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
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
declare function scheduleChangeDetection(callback: VoidFunction): AbortTaskFunction;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
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
declare function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel): AbortTaskFunction;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
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
declare function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: null): AbortTaskFunction;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
 * ```
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @param cdRef An object of type `ChangeDetectorRef` what will be potentially consumed in callbacks body or null.
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
declare function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: ChangeDetectorRef): AbortTaskFunction | null;
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
 * coalescing mechanism, you can always set abort listener or even remove it.
 * ```ts
 *  const abortTask = detectChanges(this._cdRef);
 *
 *  const abortListener () => { console.log('onAbort'); }
 *  abortTask.addAbortListener(abortListener);
 *
 *  //later
 *  abortTask.removeAbortListener(abortListener);
 * ```
 *
 * @param callback Concurrent task callback.
 * @param priority Task priority.
 * @param cdRef An object of type `ChangeDetectorRef` what will be potentially consumed in callbacks body or null.
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
declare function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: ChangeDetectorRef | null): AbortTaskFunction | null;
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
declare function scheduleTask(callback: VoidFunction): AbortTaskFunction;
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
declare function scheduleTask(callback: VoidFunction, priority: PriorityLevel): AbortTaskFunction;
/**
 * @description
 * Tries to invoke `cdRef.detectChanges()` method synchronously, unless internal coalescing system will prevent this action.
 * To learn more, see descriptions of `scheduleChangeDetection()` and `detectChanges()` functions.
 *
 * @param cdRef A component `ChangeDetectorRef` or `ViewRef` of embedded view.
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
declare function detectChangesSync(cdRef: ChangeDetectorRef): boolean;

/**
 * Waits until the task queue is considered "idle" by repeatedly checking
 * whether any tasks remain in the `taskQueue`. This is useful in unit tests
 * to defer assertions or teardown logic until all microtasks have settled.
 *
 * The function ensures at least 5 microtask passes (or the given number of attempts,
 * whichever is greater) before resolving, to give time for queued tasks to complete.
 *
 * If the queue is not empty, the `resolve` callback is added to a shared
 * `idleResolvers` list to be triggered once the queue clears.
 *
 * @param attempts - The number of times to check for queue emptiness. Minimum is 5.
 * @returns A Promise that resolves when the system appears to be idle.
 * @throws `Error` if supported test runner was not detected (jasmine/jest).
 *
 * @example
 * ```ts
 * it('should wait until all microtasks are flushed', async () => {
 *   await whenIdle();
 *   expect(callbackSpy).toHaveBeenCalled();
 * });
 * ```
 */
declare function whenIdle(attempts?: number): Promise<void>;
/**
 * Determines that the current stack frame is within concurrent task context.
 * @returns True if current stack frame is within concurrent task context.
 */
declare function isInConcurrentTaskContext(): boolean;
/**
 * Asserts that the current stack frame is within an concurrent task context.
 * @param message Error message when assertion failed!.
 */
declare function assertInConcurrentTaskContext(message?: string): void;
/**
 * Determines that the current stack frame is within concurrent task context and that task is clean.
 * @returns True if current stack frame is within concurrent task context and that task is clean.
 */
declare function isInConcurrentCleanTaskContext(): boolean;
/**
 * Asserts that the current stack frame is within an concurrent task context and that task is clean.
 * @param message Error message when assertion failed!.
 */
declare function assertInConcurrentCleanTaskContext(message?: string): void;
/**
 * Determines that the current stack frame is within concurrent task context and that task is dirty.
 * @returns True if current stack frame is within concurrent task context and that task is dirty.
 */
declare function isInConcurrentDirtyTaskContext(): boolean;
/**
 * Asserts that the current stack frame is within an concurrent task context and that task is dirty.
 * @param message Error message when assertion failed!.
 */
declare function assertInConcurrentDirtyTaskContext(message?: string): void;
/**
 * Adds additional work to current executing task, still in the same context. Below example illustrates usage of
 * this function.
 * ```ts
 *  if (isConcurrentTaskContext()) {
 *    onTaskExecuted(() => {
 *      // Some additional work.
 *    });
 *
 *    onTaskExecuted(() => {
 *      // Some additional work.
 *    });
 *  }
 * ```
 * Keep in mind thad once added listener can not be removed.
 *
 * @param listener A function what will be invoke right after current task callback.
 * @throws If called outside concurrent task context.
 */
declare function onTaskExecuted(listener: VoidFunction): void;
/**
 * Determines that there is any tasks object in queue. If there is at least one task of any status (executed, executing, pending, aborted) it returns false.
 * Otherwise return true. This functions can be used in supported test runners (jest/jasmine). If any of mentioned test runners will be not detected, it will
 * throw an error.
 */
declare function isTaskQueueEmpty(): boolean;

/**
 * @description
 * Provides integration with angular which enables the use of `scheduleTask()` `scheduleChangeDetection()` `detectChanges()` `detectChangesSync()`
 * functions and provides compatibility with hydration if zoneless change detection is provided.
 *
 * In unit tests integration can be provided to test module fallowed by `completeIntegrationForTest()` function called in injection context.
 * The example below illustrates this best.
 *
 * ```ts
 *  beforeEach(() => {
 *    TestBed.configureTestingModule({
 *      providers: []
 *    }).runInInjectionContext(() => {
 *      completeIntegrationForTest();
 *    })
 *  };
 *  afterEach(() => {
 *    TestBed.resetTestingModule(); //To dispose integration between tests
 *  });
 * ```
 *
 * @returns Environment providers
 * @see {@link EnvironmentProviders}
 * @see {@link completeIntegrationForTest}
 * @see {@link scheduleTask}
 * @see {@link scheduleChangeDetection}
 * @see {@link detectChanges}
 * @see {@link detectChangesSync}
 * @see {@link assertNgQueuexIntegrated}
 */
declare function provideNgQueuexIntegration(): EnvironmentProviders;
/**
 * Finalizes the "@ng-queuex/core" integration inside a TestBed context.
 *
 * This function must be called when using `provideNgQueuexIntegration()`
 * within Angular's testing utilities, to ensure all test-related hooks
 * (Jasmine/Jest detection, schedulers, etc.) are correctly initialized.
 *
 * Usage example:
 * ```ts
 *  beforeEach(() => {
 *    TestBed.configureTestingModule({
 *      providers: [provideNgQueuexIntegration()]
 *    }).runInInjectionContext(() => {
 *      completeIntegrationForTest();
 *    });
 *  });
 *  afterEach(() => {
 *    TestBed.resetTestingModule() //To dispose integration between tests.
 *  });
 * ```
 * @see {@link provideNgQueuexIntegration}
 */
declare function completeIntegrationForTest(): void;
/**
 * @description
 * Asserts that function `provideNgQueuexIntegration()` was used.
 *
 * @param message An error message.
 * @see {@link provideNgQueuexIntegration}
 */
declare function assertNgQueuexIntegrated(message?: string): void;

type StillPresentIterableChangeRecord<T> = IterableChangeRecord<T> & {
    readonly previousIndex: number;
    readonly currentIndex: number;
};
type RemovedIterableChangeRecord<T> = IterableChangeRecord<T> & {
    readonly previousIndex: number;
    readonly currentIndex: null;
};
type AddedIterableChangeRecord<T> = IterableChangeRecord<T> & {
    readonly previousIndex: null;
    readonly currentIndex: number;
};
/**
 * A strategy for tracking changes over time to an iterable.
 */
interface QueuexIterableDiffer<T> {
    /**
     * Compute a difference between the previous state and the new `object` state.
     *
     * @param object containing the new value.
     * @returns an object describing the difference. The return value is only valid until the next
     * `diff()` invocation.
     */
    diff(object: NgIterable<T> | undefined | null): QueuexIterableChanges<T> | null;
}
/**
 * An object describing the changes in the `Iterable` collection since last time
 * `QueuexIterableDiffer#diff()` was invoked.
 */
interface QueuexIterableChanges<T> {
    /**
     * Provide changes to handler by iterating through all records (`IterableChangeRecord`).
     * @param handler An object that handles changes.
     * @see {@link IterableChangeRecord}
     */
    applyOperations(handler: QueuexIterableChangeOperationHandler<T>): void;
    /**
     * A current state collection length, reflecting items count.
     */
    readonly length: number;
}
/**
 * A strategy for handling collection changes.
 */
interface QueuexIterableChangeOperationHandler<T> {
    /**
     * Handles a new added item.
     * @param record Added record.
     */
    add(record: AddedIterableChangeRecord<T>): void;
    /**
     * Handles a removed item.
     * @param record Removed record
     * @param adjustedIndex Position from where item should be removed, adjusted to current changing state during iteration.
     */
    remove(record: RemovedIterableChangeRecord<T>, adjustedIndex: number): void;
    /**
     * Handles a moved item.
     * @param record Moved record.
     * @param adjustedPreviousIndex A previous position of item, adjusted to current changing state during iteration.
     * @param changed True if identity has changed, otherwise false.
     */
    move(record: StillPresentIterableChangeRecord<T>, adjustedPreviousIndex: number, changed: boolean): void;
    /**
     * It is invoked for item where you should not do changes to target state during iteration. To illustrate that, lets
     * consider an array ['a', 'b', 'c] where 'b' was removed. There are two changes:
     *  1) 'b' is removed,
     *  2) 'c' moved from index 2 to 1.
     * During change providing , when on target array you remove second element, third one will already change position,
     * so there is no need to made that change. However if target state relies on current item position, this hook can provide that handling.
     * @param record Unchanged record.
     * @param changed True if identity has changed, otherwise false.
     */
    noop(record: StillPresentIterableChangeRecord<T>, changed: boolean): void;
    /**
     * This callback is called when iteration is finished.
     */
    done(): void;
}
interface QueuexIterableDifferFactory {
    supports(object: any): boolean;
    create<T>(trackByFn: TrackByFunction<T>): QueuexIterableDiffer<T>;
}
/**
 * A repository of different iterable diffing strategies.
 */
declare class QueuexIterableDiffers {
    private _factories;
    constructor(_factories: QueuexIterableDifferFactory[]);
    find(iterable: any): QueuexIterableDifferFactory;
    /**
     * Takes an array of {@link QueuexIterableDifferFactory} and returns a provider used to extend the
     * inherited {@link QueuexIterableDiffers} instance with the provided factories and return a new
     * {@link QueuexIterableDiffers} instance.
     *
     * @usageNotes
     * ### Example
     *
     * The following example shows how to extend an existing list of factories,
     * which will only be applied to the injector for this component and its children.
     * This step is all that's required to make a new {@link QueuexIterableDiffer} available.
     *
     * ```ts
     * @Component({
     *   viewProviders: [
     *     QueuexIterableDiffers.extend([new ImmutableListDiffer()])
     *   ]
     * })
     * ```
     */
    static extend(factories: QueuexIterableDifferFactory[]): StaticProvider;
    private static _create;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexIterableDiffers, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<QueuexIterableDiffers>;
}

/**
 * Represents a reference to a shared signal.
 *
 * Provides access to the underlying signal (`ref`)
 * and a method (`set`) to update its value directly or
 * by linking it to another signal.
 *
 */
interface SharedSignalRef<T> {
    /**
    * The underlying signal reference.
    */
    readonly ref: Signal<T>;
    /**
    * Updates the signal value.
    *
    * If a plain value is provided, the signal is set directly.
    * If another signal is provided, the reference will follow that signal.
    *
    * @param value A new value or another signal to bind.
    */
    set<T>(value: T | Signal<T>): void;
}
/**
 * Creates a shared signal reference.
 *
 * A shared signal allows you to either wrap a plain value into a signal
 * or forward another signal reference. The returned object provides
 * access to the underlying signal (`ref`) and a `set` method for updating
 * its value or re-linking it to a different signal.
 *
 *
 * @param initialValue The initial value of the signal, or another signal to bind.
 * @param debugName Optional developer-friendly label for debugging purposes.
 *
 * @returns A {@link SharedSignalRef} object containing the signal reference and mutation API.
 *
 * @example
 * ```ts
 * const count = sharedSignal(0, 'counter');
 * count.set(1);
 * console.log(count.ref()); // 1
 *
 * const source = signal(42);
 * count.set(source);
 * console.log(count.ref()); // 42
 * ```
 */
declare function sharedSignal<T>(initialValue: T | Signal<T>, debugName?: string): SharedSignalRef<T>;

/**
 * Represents reference to value directly provided by `set` method or
 * to the most recent value of provided signal. In case of signal, it allows safely
 * access to recent value in notification faze without touching internal signal node.
 */
interface ValueRef<T> {
    /**
     * The underlying value.
     */
    readonly value: T;
    /**
     * Updates the value.
     *
     * If plain value is provided, directly sets the underlying value.
     * If signal is provided, reference will fallow that signal.
     *
     * @param value A new value or signal to observe and extracts values in synchronic way.
     */
    set(value: T | Signal<T>): void;
}
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @throws Error if is used not in injection context.
 * @throws Error if is used in reactive context.
 */
declare function value<T>(initialValue: T | Signal<T>): ValueRef<T>;
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @param destroyRef The object that implements `DestroyRef` abstract class.
 * @throws Error if is used in reactive context.
 *
 * @see {@link DestroyRef}
 */
declare function value<T>(initialValue: T | Signal<T>, destroyRef: DestroyRef): ValueRef<T>;
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @param debugName Optional developer-friendly label for debugging purposes.
 * @throws Error if is used not in injection context.
 * @throws Error if is used in reactive context.
 */
declare function value<T>(initialValue: T | Signal<T>, debugName: string | undefined): ValueRef<T>;
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @param destroyRef The object that implements `DestroyRef` abstract class.
 * @param debugName Optional developer-friendly label for debugging purposes.
 * @throws Error if is used in reactive context.
 *
 * @see {@link DestroyRef}
 */
declare function value<T>(initialValue: T | Signal<T>, destroyRef: DestroyRef, debugName: string | undefined): ValueRef<T>;

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
interface ConcurrentEffectOptions {
    /**
     * Optional priority level (e.g. 'highest' | 'high' | 'normal' | 'low' | 'lowest').
     * Determines how soon the scheduled task should be executed by the concurrent scheduler.
     * Default is 'normal'
     */
    priority?: PriorityName;
    /**
     * If `true`, the effect will not automatically register cleanups and must be cleaned up manually.
     */
    manualCleanup?: boolean;
    /**
     * Optional Angular `DestroyRef` to automatically dispose of the effect when the hosting context is destroyed.
     */
    destroyRef?: DestroyRef;
    /**
     * Allows writing to signals within the effect execution context.
     * Defaults to `false` for safety.
     */
    allowSignalWrites?: boolean;
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
declare function concurrentEffect(effectFn: (onCleanup: EffectCleanupRegisterFn) => void, options?: ConcurrentEffectOptions): EffectRef;

export { Priority, QueuexIterableDiffers, advancePriorityInputTransform, assertInConcurrentCleanTaskContext, assertInConcurrentDirtyTaskContext, assertInConcurrentTaskContext, assertNgQueuexIntegrated, completeIntegrationForTest, concurrentEffect, detectChanges, detectChangesSync, isInConcurrentCleanTaskContext, isInConcurrentDirtyTaskContext, isInConcurrentTaskContext, isTaskQueueEmpty, onTaskExecuted, priorityInputTransform, priorityNameToNumber, provideNgQueuexIntegration, scheduleChangeDetection, scheduleTask, sharedSignal, value, whenIdle };
export type { AbortTaskFunction, AddedIterableChangeRecord, ConcurrentEffectOptions, PriorityInput, PriorityLevel, PriorityName, QueuexIterableChangeOperationHandler, QueuexIterableChanges, QueuexIterableDiffer, QueuexIterableDifferFactory, RemovedIterableChangeRecord, SharedSignalRef, StillPresentIterableChangeRecord, ValueRef };
