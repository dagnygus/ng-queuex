import * as i0 from '@angular/core';
import { isSignal, computed, ɵglobal as _global, inject, ApplicationRef, PendingTasks, PLATFORM_ID, Injector, NgModuleRef, reflectComponentType, Injectable, makeEnvironmentProviders, provideEnvironmentInitializer, APP_BOOTSTRAP_LISTENER, assertInInjectionContext, EnvironmentInjector, signal, assertNotInReactiveContext, DestroyRef } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { REACTIVE_NODE, consumerDestroy, setPostSignalSetFn, isInNotificationPhase, consumerPollProducersForChange, consumerBeforeComputation, setActiveConsumer, consumerAfterComputation, consumerMarkDirty, createWatch } from '@angular/core/primitives/signals';

var TaskStatus;
(function (TaskStatus) {
    TaskStatus[TaskStatus["Pending"] = 0] = "Pending";
    TaskStatus[TaskStatus["Prepared"] = 1] = "Prepared";
    TaskStatus[TaskStatus["Executing"] = 2] = "Executing";
    TaskStatus[TaskStatus["Executed"] = 3] = "Executed";
    TaskStatus[TaskStatus["Aborted"] = 4] = "Aborted";
})(TaskStatus || (TaskStatus = {}));
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
var Priority;
(function (Priority) {
    Priority[Priority["Highest"] = 1] = "Highest";
    Priority[Priority["High"] = 2] = "High";
    Priority[Priority["Normal"] = 3] = "Normal";
    Priority[Priority["Low"] = 4] = "Low";
    Priority[Priority["Lowest"] = 5] = "Lowest";
})(Priority || (Priority = {}));
function push(heap, node) {
    const index = heap.length;
    heap.push(node);
    siftUp(heap, node, index);
}
function peek(heap) {
    const first = heap[0];
    return first === undefined ? null : first;
}
function pop(heap) {
    const first = heap[0];
    if (first !== undefined) {
        const last = heap.pop();
        if (last !== first) {
            heap[0] = last;
            siftDown(heap, last, 0);
        }
        return first;
    }
    else {
        return null;
    }
}
function siftUp(heap, node, i) {
    let index = i;
    while (true) {
        const parentIndex = (index - 1) >>> 1;
        const parent = heap[parentIndex];
        if (parent !== undefined && compare(parent, node) > 0) {
            // The parent is larger. Swap positions.
            heap[parentIndex] = node;
            heap[index] = parent;
            index = parentIndex;
        }
        else {
            // The parent is smaller. Exit.
            return;
        }
    }
}
function siftDown(heap, node, i) {
    let index = i;
    const length = heap.length;
    while (index < length) {
        const leftIndex = (index + 1) * 2 - 1;
        const left = heap[leftIndex];
        const rightIndex = leftIndex + 1;
        const right = heap[rightIndex];
        if (left !== undefined && compare(left, node) < 0) {
            if (right !== undefined && compare(right, left) < 0) {
                heap[index] = right;
                heap[rightIndex] = node;
                index = rightIndex;
            }
            else {
                heap[index] = left;
                heap[leftIndex] = node;
                index = leftIndex;
            }
        }
        else if (right !== undefined && compare(right, node) < 0) {
            heap[index] = right;
            heap[rightIndex] = node;
            index = rightIndex;
        }
        else {
            // Neither child is smaller. Exit.
            return;
        }
    }
}
function compare(a, b) {
    // Compare sort index first, then task id.
    const diff = a.sortIndex - b.sortIndex;
    return diff !== 0 ? diff : a.id - b.id;
}
function coercePriority(priority) {
    return Math.round(Math.max(1, Math.min(5, priority)));
}
function priorityNameToNumber(priorityName, debugFn = priorityNameToNumber) {
    switch (priorityName) {
        case 'highest':
            return Priority.Highest;
        case 'high':
            return Priority.High;
        case 'normal':
            return Priority.Normal;
        case 'low':
            return Priority.Low;
        case 'lowest':
            return Priority.Lowest;
        default:
            throw new Error(`${debugFn.name}(): Provided key '${priorityName}' is not recognized as priority!`);
    }
}
/**
 * @description
 * Transforms priority names to it's raw numeric value.
 * @param value Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5).
 * @returns Priority numeric level.
 * @see {@link PriorityInput}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 */
function priorityInputTransform(value) {
    if (typeof value === 'number') {
        return coercePriority(value);
    }
    else {
        return priorityNameToNumber(value, priorityInputTransform);
    }
}
/**
 * @description
 * Transforms priority names to it's raw numeric values or transforms signal to computed signal with the same manner.
 * @param value Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5) or signal providing the same values.
 * @see {@link PriorityInput}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link priorityInputTransform}
 */
function advancePriorityInputTransform(value) {
    if (isSignal(value)) {
        return computed(() => {
            const v = value();
            if (typeof v === 'number') {
                return coercePriority(v);
            }
            else {
                return priorityNameToNumber(v, advancePriorityInputTransform);
            }
        });
    }
    else {
        if (typeof value === 'number') {
            return coercePriority(value);
        }
        else {
            return priorityNameToNumber(value, advancePriorityInputTransform);
        }
    }
}
const noopFn = function () { };

const NG_DEV_MODE = typeof ngDevMode === 'undefined' || !!ngDevMode;

// see https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js
const global = _global;
const noopZone = { run(cb) { return cb(); } };
let getCurrentTime = null;
let onIdle = noopFn;
if (typeof performance === 'object') {
    if (typeof performance.now === 'function') {
        getCurrentTime = function () { return performance.now(); };
    }
}
if (getCurrentTime === null) {
    getCurrentTime = function () { return Date.now(); };
}
// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
const maxSigned31BitInt = 1073741823;
// Times out immediately
const HIGHEST_PRIORITY_TIMEOUT = -1;
// Eventually times out
const HIGH_PRIORITY_TIMEOUT = 250;
const NORMAL_PRIORITY_TIMEOUT = 5000;
const LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
const LOWEST_PRIORITY_TIMEOUT = maxSigned31BitInt;
// Tasks are stored on a min heap
const taskQueue = [];
// const timerQueue: SchedulerTask[] = [];
// All the promise resolvers returned by whenIdle() function.
const idleResolvers = [];
// Incrementing id counter. Used to maintain insertion order.
let taskIdCounter = 1;
let currentTask = null;
let currentPriorityLevel = Priority.Normal;
// This is set while performing work, to prevent re-entrancy.
let isPerformingWork = false;
let isHostCallbackScheduled = false;
function notifyTaskListenersAndCleanup(task) {
    try {
        while (task.onExecutedListeners && task.onExecutedListeners.length) {
            task.onExecutedListeners.shift()();
        }
        while (task.internalOnExecutedListeners && task.internalOnExecutedListeners.length) {
            task.internalOnExecutedListeners.shift()();
        }
    }
    finally {
        if ((task.onExecutedListeners && task.onExecutedListeners.length) ||
            (task.internalOnExecutedListeners && task.internalOnExecutedListeners.length)) {
            notifyTaskListenersAndCleanup(task);
        } /* else {
          task.cleanup(); // or just task.scopeToHandle = null;
           //Good reason for that will be a caching implementation;
        } */
    }
}
function flushWork(hasTimeRemaining, initialTime) {
    // We'll need a host callback the next time work is scheduled.
    isHostCallbackScheduled = false;
    isPerformingWork = true;
    const previousPriorityLevel = currentPriorityLevel;
    try {
        return workLoop(hasTimeRemaining, initialTime);
    }
    finally {
        currentTask = null;
        currentPriorityLevel = previousPriorityLevel;
        isPerformingWork = false;
    }
}
function workLoop(hasTimeRemaining, initialTime, _currentTask = null) {
    let currentTime = initialTime;
    if (_currentTask) {
        currentTask = _currentTask;
    }
    else {
        // advanceTimers(currentTime);
        currentTask = peek(taskQueue);
        //<MyCode>
        if (NG_DEV_MODE) {
            if (currentTask) {
                if (currentTask.callback !== null &&
                    currentTask.status !== TaskStatus.Pending &&
                    currentTask.status !== TaskStatus.Prepared) {
                    throw new Error('InternalError: Peeked task in workLoop() function has incorrect status!');
                }
            }
        }
        if (currentTask && currentTask.status === TaskStatus.Pending) {
            currentTask.status = TaskStatus.Prepared;
        }
        //</MyCode>
    }
    let zoneChanged = false;
    const hitDeadline = () => currentTask &&
        currentTask.expirationTime > currentTime &&
        (!hasTimeRemaining || shouldYieldToHost());
    if (!hitDeadline()) {
        const zone = currentTask?.zone ?? noopZone;
        zone.run(function () {
            while (currentTask !== null && !zoneChanged) {
                if (hitDeadline()) {
                    break;
                }
                const callback = currentTask.callback;
                //<MyCode>
                if (NG_DEV_MODE) {
                    if (callback === null &&
                        currentTask.status !== TaskStatus.Aborted &&
                        currentTask.status !== TaskStatus.Executed) {
                        throw new Error('InternalError: Task with null callback is not marked as aborted or executed!');
                    }
                }
                //</MyCode>
                if (typeof callback === 'function') {
                    currentTask.callback = null;
                    currentPriorityLevel = currentTask.priorityLevel;
                    //<MyCode>
                    currentTask.status = TaskStatus.Executing;
                    currentTask.beforeExecute();
                    try {
                        callback();
                    }
                    finally {
                        try {
                            notifyTaskListenersAndCleanup(currentTask);
                        }
                        finally {
                            currentTask.status = TaskStatus.Executed;
                            currentTime = getCurrentTime();
                        }
                    }
                }
                if (currentTask === peek(taskQueue)) {
                    pop(taskQueue);
                }
                //</MyCode>
                currentTask = peek(taskQueue);
                //<MyCode>
                if (currentTask && currentTask.status === TaskStatus.Pending) {
                    currentTask.status = TaskStatus.Prepared;
                }
                //</MyCode>
                zoneChanged = currentTask?.zone !== zone;
            }
        });
    }
    // we need to check if leaving `NgZone` (tick => detectChanges) caused other
    // directives to add tasks to the queue. If there is one and we still didn't
    // hit the deadline, run the workLoop again in order to flush everything thats
    // left.
    // Otherwise, newly added tasks won't run as `performingWork` is still `true`
    currentTask = currentTask ?? peek(taskQueue);
    //<MyCode>
    if (currentTask && currentTask.status === TaskStatus.Pending) {
        currentTask.status = TaskStatus.Prepared;
    }
    //</MyCode>
    // We should also re-calculate the currentTime, as we need to account for the execution
    // time of the NgZone tasks as well.
    // If there is still a task in the queue, but no time is left for executing it,
    // the scheduler will re-schedule the next tick anyway
    currentTime = getCurrentTime();
    if (zoneChanged || (currentTask && !hitDeadline())) {
        return workLoop(hasTimeRemaining, currentTime, currentTask);
    }
    // Return whether there's additional work
    if (currentTask !== null) {
        return true;
    }
    else {
        return false;
    }
}
function scheduleCallback(priorityLevel, callback) {
    const startTime = getCurrentTime();
    let expirationTime;
    switch (priorityLevel) {
        case Priority.Highest:
            expirationTime = HIGHEST_PRIORITY_TIMEOUT;
            break;
        case Priority.High:
            expirationTime = HIGH_PRIORITY_TIMEOUT;
            break;
        case Priority.Lowest:
            expirationTime = LOWEST_PRIORITY_TIMEOUT;
            break;
        case Priority.Low:
            expirationTime = LOW_PRIORITY_TIMEOUT;
            break;
        case Priority.Normal:
        default:
            expirationTime = NORMAL_PRIORITY_TIMEOUT;
            break;
    }
    const newTask = {
        id: taskIdCounter++,
        callback,
        priorityLevel,
        expirationTime,
        startTime,
        sortIndex: -1,
        zone: global.Zone?.current ?? noopZone,
        status: TaskStatus.Pending,
        scopeToHandle: null,
        abort: noopFn,
        beforeExecute: noopFn,
        isClean: true,
        onExecutedListeners: null,
        internalOnExecutedListeners: null,
        abortListeners: null,
        // cleanup: taskCleanup <-- Maybe if there will be implemented caching, then there is good reason to cleanup after task was executed, setting scopeToHandle to null;
    };
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    // Schedule a host callback, if needed. If we're already performing work,
    // wait until the next time we yield.
    if (isHostCallbackScheduled && isPerformingWork) {
        return newTask;
    }
    ;
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
    // <<<<----Perfect place for initialization logic.---->>>>
    // <<<<////Perfect place for initialization logic.---->>>>
    return newTask;
}
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
function whenIdle(attempts = 5) {
    if (typeof jasmine === 'undefined' && typeof jest === 'undefined') {
        throw new Error('whenIdle(): Supported test runner not detected! This function can by used in supported test frameworks (jasmine/jest).');
    }
    return new Promise((resolve) => {
        let counter = 0;
        attempts = Math.max(5, Math.round(attempts));
        const addToQueueOrResolve = () => {
            queueMicrotask(() => {
                if (counter >= attempts) {
                    resolve();
                    return;
                }
                if (taskQueue.length) {
                    idleResolvers.push(resolve);
                    return;
                }
                counter++;
                addToQueueOrResolve();
            });
        };
        addToQueueOrResolve();
    });
}
/**
 * Determines that the current stack frame is within concurrent task context.
 * @returns True if current stack frame is within concurrent task context.
 */
function isInConcurrentTaskContext() {
    return currentTask !== null && currentTask.status === TaskStatus.Executing;
}
/**
 * Asserts that the current stack frame is within an concurrent task context.
 * @param message Error message when assertion failed!.
 */
function assertInConcurrentTaskContext(message) {
    if (isInConcurrentTaskContext()) {
        return;
    }
    message = message ?? 'assertInConcurrentTaskContext(): assertion failed!';
    throw new Error(message);
}
/**
 * Determines that the current stack frame is within concurrent task context and that task is clean.
 * @returns True if current stack frame is within concurrent task context and that task is clean.
 */
function isInConcurrentCleanTaskContext() {
    return currentTask !== null && currentTask.status === TaskStatus.Executing && currentTask.isClean;
}
/**
 * Asserts that the current stack frame is within an concurrent task context and that task is clean.
 * @param message Error message when assertion failed!.
 */
function assertInConcurrentCleanTaskContext(message) {
    if (isInConcurrentCleanTaskContext()) {
        return;
    }
    message = message ?? 'assertInConcurrentCleanTaskContext(): assertion failed!';
    throw new Error(message);
}
/**
 * Determines that the current stack frame is within concurrent task context and that task is dirty.
 * @returns True if current stack frame is within concurrent task context and that task is dirty.
 */
function isInConcurrentDirtyTaskContext() {
    return currentTask !== null && currentTask.status === TaskStatus.Executing && !currentTask.isClean;
}
/**
 * Asserts that the current stack frame is within an concurrent task context and that task is dirty.
 * @param message Error message when assertion failed!.
 */
function assertInConcurrentDirtyTaskContext(message) {
    if (isInConcurrentDirtyTaskContext()) {
        return;
    }
    message = message ?? 'assertInConcurrentDirtyTaskContext(): assertion failed!';
    throw new Error(message);
}
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
function onTaskExecuted(listener) {
    assertInConcurrentTaskContext('onTaskExecuted(): Stack frame is not in concurrent task context');
    (currentTask.onExecutedListeners ??= []).push(listener);
}
function getCurrentTask() {
    return currentTask;
}
/**
 * Determines that there is any tasks object in queue. If there is at least one task of any status (executed, executing, pending, aborted) it returns false.
 * Otherwise return true. This functions can be used in supported test runners (jest/jasmine). If any of mentioned test runners will be not detected, it will
 * throw an error.
 */
function isTaskQueueEmpty() {
    if (typeof jasmine === 'undefined' && typeof jest === 'undefined') {
        throw new Error('isTaskQueueEmpty(): Supported test runner not detected! This function can by used in supported test frameworks (jasmine/jest).');
    }
    return taskQueue.length === 0;
}
function internalIsTaskQueueEmpty() {
    return taskQueue.length === 0;
}
function getQueueLength() {
    return taskQueue.length;
}
function getTaskAt(index) {
    return taskQueue[index];
}
function setOnIdle(fn) {
    fn ? onIdle = fn : onIdle = noopFn;
}
let isMessageLoopRunning = false;
let scheduledHostCallback = null;
// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let yieldInterval = 16;
let needsPaint = false;
let queueStartTime = -1;
function shouldYieldToHost() {
    if (needsPaint) {
        // There's a pending paint (signaled by `requestPaint`). Yield now.
        return true;
    }
    const timeElapsed = getCurrentTime() - queueStartTime;
    if (timeElapsed < yieldInterval) {
        // The main thread has only been blocked for a really short amount of time;
        // smaller than a single frame. Don't yield yet.
        return false;
    }
    // `isInputPending` isn't available. Yield now.
    return true;
}
// export function forceFrameRate(fps: number) {
//   if (fps < 0 || fps > 125) {
//     if (typeof ngDevMode === 'undefined' || ngDevMode) {
//       console.error(
//         'forceFrameRate takes a positive int between 0 and 125, ' +
//           'forcing frame rates higher than 125 fps is not supported',
//       );
//     }
//     return;
//   }
//   if (fps > 0) {
//     yieldInterval = Math.floor(1000 / fps);
//   } else {
//     // reset the framerate
//     yieldInterval = 5;
//   }
//   // be aware of browser housekeeping work (~6ms per frame)
//   // according to https://developers.google.com/web/fundamentals/performance/rendering
//   yieldInterval = Math.max(5, yieldInterval - 6);
// }
//<MyCode>
// forceFrameRate(60);
//</MyCode>
const performWorkUntilDeadline = function () {
    if (scheduledHostCallback !== null) {
        const currentTime = getCurrentTime();
        // Yield after `yieldInterval` ms, regardless of where we are in the vsync
        // cycle. This means there's always time remaining at the beginning of
        // the message event.
        queueStartTime = currentTime;
        const hasTimeRemaining = true;
        // If a scheduler task throws, exit the current browser task so the
        // error can be observed.
        //
        // Intentionally not using a try-catch, since that makes some debugging
        // techniques harder. Instead, if `scheduledHostCallback` errors, then
        // `hasMoreWork` will remain true, and we'll continue the work loop.
        let hasMoreWork = true;
        try {
            hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
        }
        finally {
            if (hasMoreWork) {
                // If there's more work, schedule the next message event at the end
                // of the preceding one.
                schedulePerformWorkUntilDeadline();
            }
            else {
                isMessageLoopRunning = false;
                scheduledHostCallback = null;
                // <<<<----Perfect place for hook and some cleanup logic. After all work compleat.---->>>>
                // Notifying that state is idle specs (see whenIdle() function in this file).
                while (idleResolvers.length) {
                    idleResolvers.shift()();
                }
                // Rising onIdle hook.
                onIdle();
                // <<<<////Perfect place for hook and some cleanup logic. After all work compleat.---->>>>
            }
        }
    }
    else {
        isMessageLoopRunning = false;
    }
    // Yielding to the browser will give it a chance to paint, so we can
    // reset this.
    needsPaint = false;
};
let schedulePerformWorkUntilDeadline;
if (typeof global.setImmediate === 'function') {
    // Node.js and old IE.
    // There's a few reasons for why we prefer setImmediate.
    //
    // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
    // (Even though this is a DOM fork of the Scheduler, you could get here
    // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
    // https://github.com/facebook/react/issues/20756
    //
    // But also, it runs earlier which is the semantic we want.
    // If other browsers ever implement it, it's better to use it.
    // Although both of these would be inferior to native scheduling.
    schedulePerformWorkUntilDeadline = () => {
        global.setImmediate(performWorkUntilDeadline);
    };
}
else if (typeof global.MessageChannel !== 'undefined') {
    const channel = new global.MessageChannel();
    const port = channel.port2;
    if (typeof Zone === 'undefined') {
        channel.port1.onmessage = performWorkUntilDeadline;
        schedulePerformWorkUntilDeadline = function () {
            port.postMessage(null);
        };
    }
    else {
        let zoneTask = null;
        const noopFn = () => { };
        const schedulerFn = (task) => {
            zoneTask = task;
            port.postMessage(null);
        };
        channel.port1.onmessage = function () { zoneTask.invoke(); };
        schedulePerformWorkUntilDeadline = function () {
            Zone.current.scheduleMacroTask('setImmediate', performWorkUntilDeadline, { isPeriodic: false, args: [] }, schedulerFn, noopFn);
        };
    }
}
else {
    // We should only fallback here in non-browser environments.
    schedulePerformWorkUntilDeadline = function () {
        global.setTimeout(performWorkUntilDeadline, 0);
    };
}
function requestHostCallback(callback) {
    scheduledHostCallback = callback;
    if (!isMessageLoopRunning) {
        isMessageLoopRunning = true;
        schedulePerformWorkUntilDeadline();
    }
}

const USAGE_EXAMPLE_IN_UNIT_TESTS = 'beforeEach(() => {\n' +
    ' TestBed.configureTestingModule({\n' +
    '   providers: [\n' +
    '     provideNgQueuexIntegration()\n' +
    '   ]\n' +
    ' }).runInInjectionContext(() => {\n' +
    '   completeIntegrationForTest();\n' +
    ' });\n';
'});\n' +
    'afterEach(() => {\n' +
    ' TestBed.resetTestingModule(); //Dispose integration between tests\n' +
    '});';
const INTEGRATION_NOT_PROVIDED_MESSAGE = '"@ng-queuex/core" integration was not provided to Angular! ' +
    'Use provideNgQueuexIntegration() function to in bootstrapApplication() function ' +
    'to add crucial environment providers for integration.';
const SERVER_SIDE_MESSAGE = 'Scheduling concurrent tasks on server is not allowed!';
const INTEGRATION_NOT_COMPLETED_MESSAGE = '"@ng-queuex/core" integration for tests is not competed. To make sure that integration is finalized ' +
    'use \'completeIntegrationForTest()\' function inside TestBed injection context as the example below shows:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS;
const COMMON_MESSAGE = '"@ng-queuex/core" is design for projects with standalone angular application where there ' +
    'is only one ApplicationRef instance and with one root bootstrapped component. ' +
    'Integration can not be provided in lazy loaded module but only at application root level ' +
    'and at root injection context of environment injector. Use bootstrapApplication() ' +
    'function with a standalone component. In case of unit tests you need to provide integration ' +
    'to test module and call function completeINtegrationForTest() in TestBed injection context ' +
    'just like example shows: \n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS;
class Integrator {
    appRef = inject(ApplicationRef);
    pendingNgTasks = inject(PendingTasks);
    pendingNgTaskCleanup = null;
    bootstrapCount = 0;
    uncompleted = true;
    testEnv = false;
    isServer = isPlatformServer(inject(PLATFORM_ID));
    subscription = null;
    static instance = null;
    constructor() {
        if (Integrator.instance) {
            throw new Error('provideNgQueuexIntegration(): Integration already provided! ' + COMMON_MESSAGE);
        }
        Integrator.instance = this;
    }
    assertInRoot() {
        if (this.appRef.injector === inject(Injector)) {
            return;
        }
        throw new Error('provideNgQueuexIntegration(): Integration provided not at root level! ' + COMMON_MESSAGE);
    }
    assertProject() {
        if (inject(NgModuleRef).instance === null) {
            return;
        }
        throw new Error('provideNgQueuexIntegration(): Non-standalone application detected. ' +
            'This library only supports Angular applications bootstrapped with standalone APIs. ' +
            'It seems that your application is still using the traditional NgModule-based ' +
            'bootstrap (e.g. platformBrowserDynamic().bootstrapModule(AppModule)).');
    }
    integrateWithAngular() {
        if (this.isServer) {
            this.uncompleted = false;
            return;
        }
        this.pendingNgTaskCleanup = this.pendingNgTasks.add();
        setOnIdle(() => {
            this.pendingNgTaskCleanup?.();
            this.pendingNgTaskCleanup = null;
        });
        const subscription = this.subscription = this.appRef.isStable.subscribe((value) => {
            if (value) {
                setOnIdle(null);
                subscription.unsubscribe();
            }
        });
        this.uncompleted = false;
    }
    onBootstrap(cmpRef) {
        if (this.isServer) {
            return;
        }
        if (this.bootstrapCount >= 1) {
            throw new Error('provideNgQueuexIntegration(): Multiple components were bootstrapped, which is not allowed! ' + COMMON_MESSAGE);
        }
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
            if (!reflectComponentType(cmpRef.componentType).isStandalone) {
                throw new Error('provideNgQueuexIntegration(): Application bootstrap with NgModule is not supported! ' +
                    'Use a standalone component instead.' + COMMON_MESSAGE);
            }
        }
        if (++this.bootstrapCount >= this.appRef.components.length && internalIsTaskQueueEmpty()) {
            // During bootstrap there was not scheduled any concurrent task.
            // That means that internal onIdle hook will not be invoke, so we need to cleanup
            // angular pending task manually. That will stabilize application and do rest of the cleanup.
            this.pendingNgTaskCleanup?.();
        }
    }
    ngOnDestroy() {
        this.pendingNgTaskCleanup?.();
        this.pendingNgTaskCleanup = null;
        this.subscription?.unsubscribe();
        this.subscription = null;
        Integrator.instance = null;
        setOnIdle(null);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.1", ngImport: i0, type: Integrator, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.1", ngImport: i0, type: Integrator, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.1", ngImport: i0, type: Integrator, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [] });
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
function provideNgQueuexIntegration() {
    return makeEnvironmentProviders([
        provideEnvironmentInitializer(() => {
            const integrator = inject(Integrator);
            integrator.assertInRoot();
            if ((typeof jasmine === 'object' && jasmine !== null) || (typeof jest === 'object' && jest !== null)) {
                return;
            }
            integrator.assertProject();
            integrator.integrateWithAngular();
        }),
        {
            provide: APP_BOOTSTRAP_LISTENER,
            multi: true,
            useValue: (cmpRef) => {
                Integrator.instance.onBootstrap(cmpRef);
            }
        }
    ]);
}
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
function completeIntegrationForTest() {
    assertInInjectionContext(() => 'completeIntegrationForTest(): This function was not used in injection context!');
    if (Integrator.instance === null) {
        throw new Error('completeIntegrationForTest(): Integration not provided! To complete integration "@ng-queuex/core" integration for test, ' +
            'provide integration to test module:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS);
    }
    const testBedInjector = TestBed.inject(EnvironmentInjector);
    if ((testBedInjector !== inject(Injector)) || Integrator.instance.appRef.injector !== testBedInjector) {
        throw new Error('completeIntegrationForTest(): Incorrect function usage. This function can be used only in TestBed injection context.' +
            'The correct usage of this function is illustrated in the following example:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS);
    }
    if (Integrator.instance.uncompleted) {
        Integrator.instance.uncompleted = false;
        Integrator.instance.testEnv = true;
    }
    else {
        if (Integrator.instance.testEnv) {
            return;
        }
        throw new Error('completeIntegrationForTest(): This function must be called within a test runner (Jasmine/Jest). No test framework detected.');
    }
}
/**
 * @description
 * Asserts that function `provideNgQueuexIntegration()` was used.
 *
 * @param message An error message.
 * @see {@link provideNgQueuexIntegration}
 */
function assertNgQueuexIntegrated(message) {
    if (Integrator.instance) {
        if (Integrator.instance.uncompleted) {
            message = message ?? 'assertNgQueuexIntegrationProvided(): assertion failed! Integration not completed.';
            throw new Error(message);
        }
        return;
    }
    message = message ?? 'assertNgQueuexIntegrationProvided(): assertion failed! Integration not provided.';
    throw new Error(message);
}

const coalescingScopes = new WeakMap();
function detectChanges(cdRef, priority = 3 /* Priority.Normal */) {
    if (NG_DEV_MODE) {
        if (Integrator.instance === null) {
            throw new Error('detectChanges(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        }
        if (Integrator.instance.isServer) {
            throw new Error('detectChanges(): ' + SERVER_SIDE_MESSAGE);
        }
        if (Integrator.instance.uncompleted) {
            throw new Error('detectChanges(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
        }
    }
    const relatedTask = coalescingScopes.get(cdRef);
    if (relatedTask) {
        if (NG_DEV_MODE) {
            if (relatedTask.status === TaskStatus.Aborted) {
                throw new Error('InternalError: Related task to CdRef is aborted to early!');
            }
            if (relatedTask.status === TaskStatus.Executed) {
                throw new Error('InternalError: Related task to cdRef is executed but coalescing scope is not deleted!');
            }
        }
        if (priority >= relatedTask.priorityLevel ||
            relatedTask.status === TaskStatus.Prepared ||
            relatedTask.status === TaskStatus.Executing) {
            return null;
        }
        // At this place related task is pending.
        // We need to abort this task because it has lower priority.
        relatedTask.abort();
    }
    let task = scheduleCallback(coercePriority(priority), function () {
        cdRef.detectChanges();
    });
    task.isClean = false;
    coalescingScopes.set(cdRef, task);
    task.beforeExecute = function () {
        task = null;
    };
    task.internalOnExecutedListeners = [];
    task.internalOnExecutedListeners.push(function () {
        coalescingScopes.delete(cdRef);
    });
    const abortTask = function () {
        if (task) {
            task.callback = null;
            task.status = TaskStatus.Aborted;
            const abortListeners = task.abortListeners;
            task = null;
            coalescingScopes.delete(cdRef);
            if (abortListeners) {
                while (abortListeners.length) {
                    abortListeners.shift()();
                }
            }
        }
    };
    abortTask.addAbortListener = function (listener) {
        if (task) {
            if (!task.abortListeners) {
                task.abortListeners = [];
            }
            task.abortListeners.push(listener);
        }
    };
    abortTask.removeAbortListener = function (listener) {
        if (task && task.abortListeners) {
            const index = task.abortListeners.indexOf(listener);
            if (index > -1) {
                task.abortListeners.splice(index, 1);
            }
        }
    };
    task.abort = abortTask;
    return abortTask;
}
function scheduleChangeDetection(callback, priority = 3, //Priority.Normal
cdRef = null) {
    if (NG_DEV_MODE) {
        if (Integrator.instance === null) {
            throw new Error('scheduleChangeDetection(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        }
        if (Integrator.instance.isServer) {
            throw new Error('scheduleChangeDetection(): ' + SERVER_SIDE_MESSAGE);
        }
        if (Integrator.instance.uncompleted) {
            throw new Error('scheduleChangeDetection(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
        }
    }
    if (cdRef) {
        const relatedTask = coalescingScopes.get(cdRef);
        if (relatedTask) {
            if (NG_DEV_MODE) {
                if (relatedTask.status === TaskStatus.Aborted) {
                    throw new Error('InternalError: Related task to CdRef is aborted to early!');
                }
                if (relatedTask.status === TaskStatus.Executed) {
                    throw new Error('InternalError: Related task to cdRef is executed but coalescing scope is not deleted!');
                }
            }
            if (priority >= relatedTask.priorityLevel || // Lower priority has bigger number
                relatedTask.status === TaskStatus.Prepared ||
                relatedTask.status === TaskStatus.Executing) {
                return null;
            }
            //We need to abort this task because it has lower priority.
            relatedTask.abort();
        }
    }
    let task = scheduleCallback(coercePriority(priority), callback);
    task.isClean = false;
    if (cdRef) {
        coalescingScopes.set(cdRef, task);
        task.scopeToHandle = cdRef;
    }
    task.beforeExecute = function () {
        task = null;
    };
    task.internalOnExecutedListeners = [];
    task.internalOnExecutedListeners.push(function () {
        if (cdRef) {
            coalescingScopes.delete(cdRef);
        }
    });
    const abortTask = function () {
        if (task) {
            task.callback = null;
            task.status = TaskStatus.Aborted;
            const abortListeners = task.abortListeners;
            task = null;
            if (cdRef) {
                coalescingScopes.delete(cdRef);
            }
            if (abortListeners) {
                while (abortListeners.length) {
                    abortListeners.shift()();
                }
            }
        }
    };
    abortTask.addAbortListener = function (listener) {
        if (task) {
            if (!task.abortListeners) {
                task.abortListeners = [];
            }
            task.abortListeners.push(listener);
        }
    };
    abortTask.removeAbortListener = function (listener) {
        if (task && task.abortListeners) {
            const index = task.abortListeners.indexOf(listener);
            if (index > -1) {
                task.abortListeners.splice(index, 1);
            }
        }
    };
    task.abort = abortTask;
    return abortTask;
}
function scheduleTask(callback, priority = 3 /* Priority.Normal */) {
    if (NG_DEV_MODE) {
        if (Integrator.instance === null) {
            throw new Error('scheduleTask(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        }
        if (Integrator.instance.isServer) {
            throw new Error('scheduleTask(): ' + SERVER_SIDE_MESSAGE);
        }
        if (Integrator.instance.uncompleted) {
            throw new Error('scheduleTask(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
        }
    }
    let task = scheduleCallback(coercePriority(priority), callback);
    task.beforeExecute = function () { task = null; };
    const abortTask = function () {
        if (task) {
            task.callback = null;
            task.status = TaskStatus.Aborted;
            const abortListeners = task.abortListeners;
            task = null;
            if (abortListeners) {
                while (abortListeners.length) {
                    abortListeners.shift()();
                }
            }
        }
    };
    abortTask.addAbortListener = function (listener) {
        if (task) {
            if (!task.abortListeners) {
                task.abortListeners = [];
            }
            task.abortListeners.push(listener);
        }
    };
    abortTask.removeAbortListener = function (listener) {
        if (task && task.abortListeners) {
            const index = task.abortListeners.indexOf(listener);
            if (index > -1) {
                task.abortListeners.splice(index, 1);
            }
        }
    };
    return abortTask;
}
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
function detectChangesSync(cdRef) {
    if (NG_DEV_MODE) {
        if (Integrator.instance === null) {
            throw new Error('detectChangesSync(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        }
        if (Integrator.instance.isServer) {
            throw new Error('detectChangesSync(): This function usage on server is not allowed!');
        }
        if (Integrator.instance.uncompleted) {
            throw new Error('detectChangesSync(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
        }
    }
    if (isInConcurrentCleanTaskContext()) {
        cdRef.detectChanges();
        return true;
    }
    const relatedTask = coalescingScopes.get(cdRef);
    if (relatedTask) {
        //Internal Errors
        if (NG_DEV_MODE) {
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
        if (relatedTask.status === TaskStatus.Prepared) {
            return false;
        }
        if (relatedTask.status === TaskStatus.Executing) {
            if (relatedTask.scopeToHandle === cdRef) {
                // scheduleChangeDetection(...) with cdRef as third arg was used to schedule this task. We must consume cdRef now.
                relatedTask.scopeToHandle = null;
                cdRef.detectChanges(); // Coalescing is handled by scheduleChangeDetection(...) function.
                return true;
            }
            else {
                return false;
            }
        }
        //At this place related task is pending. If there is prepared task already or executing right now,
        //we need abort related task and trigger cdRef.detectChanges(). if not, then nothing;
        if (isInConcurrentTaskContext()) {
            relatedTask.abort();
            const currentTask = getCurrentTask();
            coalescingScopes.set(cdRef, currentTask);
            cdRef.detectChanges();
            (currentTask.internalOnExecutedListeners ??= []).push(function () {
                coalescingScopes.delete(cdRef);
            });
            return true;
        }
        else {
            return false;
        }
    }
    else {
        // At that place we know that this cdRef was not scheduled at all.
        if (isInConcurrentTaskContext()) {
            const currentTask = getCurrentTask();
            coalescingScopes.set(cdRef, currentTask);
            cdRef.detectChanges();
            (currentTask.internalOnExecutedListeners ??= []).push(function () {
                coalescingScopes.delete(cdRef);
            });
        }
        else {
            cdRef.detectChanges();
        }
        return true;
    }
}

const trackByIdentity = (_, item) => item;
function iterateListLike(obj, fn) {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            fn(obj[i]);
        }
    }
    else {
        const iterator = obj[Symbol.iterator]();
        let item;
        while (!(item = iterator.next()).done) {
            fn(item.value);
        }
    }
}
class DefaultQueuexIterableDifferFactory {
    supports(collection) {
        return isListLikeIterable(collection);
    }
    create(trackByFn) {
        trackByFn = trackByFn ?? trackByIdentity;
        return new DefaultQueuexIterableDiffer(trackByFn);
    }
}
class DefaultQueuexIterableDiffer {
    _trackByFn;
    length = 0;
    // Keeps track of the used records at any point in time (during & across `_check()` calls)
    _linkedRecords = null;
    // Keeps track of the removed records at any point in time during `_check()` calls.
    _unlinkedRecords = null;
    // private _previousItHead: IterableChangeRecord_<T>|null = null;
    _itHead = null;
    _itTail = null;
    _additionsHead = null;
    _additionsTail = null;
    _movesHead = null;
    _movesTail = null;
    _removalsHead = null;
    _removalsTail = null;
    // Keeps track of records where custom track by is the same, but item identity has changed
    _identityChangesHead = null;
    _identityChangesTail = null;
    constructor(_trackByFn) {
        this._trackByFn = _trackByFn;
    }
    applyOperations(handler) {
        let nextIt = this._itHead;
        let nextRemove = this._removalsHead;
        let addRemoveOffset = 0;
        let moveOffsets = null;
        while (nextIt || nextRemove) {
            // Figure out which is the next record to process
            // Order: remove, add, move
            const record = !nextRemove ||
                nextIt &&
                    nextIt.currentIndex <
                        getPreviousIndex(nextRemove, addRemoveOffset, moveOffsets) ?
                nextIt :
                nextRemove;
            const adjPreviousIndex = getPreviousIndex(record, addRemoveOffset, moveOffsets);
            const currentIndex = record.currentIndex;
            // consume the item, and adjust the addRemoveOffset and update moveDistance if necessary
            if (record === nextRemove) {
                addRemoveOffset--;
                nextRemove = nextRemove._nextRemoved;
            }
            else {
                nextIt = nextIt._next;
                if (record.previousIndex == null) {
                    addRemoveOffset++;
                }
                else {
                    // INVARIANT:  currentIndex < previousIndex
                    if (!moveOffsets)
                        moveOffsets = [];
                    const localMovePreviousIndex = adjPreviousIndex - addRemoveOffset;
                    const localCurrentIndex = currentIndex - addRemoveOffset;
                    if (localMovePreviousIndex != localCurrentIndex) {
                        for (let i = 0; i < localMovePreviousIndex; i++) {
                            const offset = i < moveOffsets.length ? moveOffsets[i] : (moveOffsets[i] = 0);
                            const index = offset + i;
                            if (localCurrentIndex <= index && index < localMovePreviousIndex) {
                                moveOffsets[i] = offset + 1;
                            }
                        }
                        const previousIndex = record.previousIndex;
                        moveOffsets[previousIndex] = localCurrentIndex - localMovePreviousIndex;
                    }
                }
            }
            if (adjPreviousIndex !== currentIndex) {
                if (record.previousIndex == null) {
                    handler.add(record);
                }
                else if (currentIndex == null) {
                    handler.remove(record, adjPreviousIndex);
                }
                else if (adjPreviousIndex !== null) {
                    handler.move(record, adjPreviousIndex, record._isIdentityChange);
                }
            }
            else {
                handler.noop(record, record._isIdentityChange);
            }
        }
        handler.done();
    }
    diff(collection) {
        if (collection == null)
            collection = [];
        if (!isListLikeIterable(collection)) {
            throw new Error(`Error trying to diff '${collection}' of type '${getTypeName(collection)}'. Only arrays and iterables are allowed.`);
        }
        if (this._check(collection)) {
            return this;
        }
        else {
            return null;
        }
    }
    _check(collection) {
        this._reset();
        let record = this._itHead;
        let mayBeDirty = false;
        let index;
        let item;
        let itemTrackBy;
        if (Array.isArray(collection)) {
            this.length = collection.length;
            for (let index = 0; index < this.length; index++) {
                item = collection[index];
                itemTrackBy = this._trackByFn(index, item);
                if (record === null || !Object.is(record.trackById, itemTrackBy)) {
                    record = this._mismatch(record, item, itemTrackBy, index);
                    mayBeDirty = true;
                }
                else {
                    if (mayBeDirty) {
                        // TODO(misko): can we limit this to duplicates only?
                        record = this._verifyReinsertion(record, itemTrackBy, index);
                    }
                    if (!Object.is(record.item, item))
                        this._addIdentityChange(record, item);
                }
                record = record._next;
            }
        }
        else {
            index = 0;
            iterateListLike(collection, (item) => {
                itemTrackBy = this._trackByFn(index, item);
                if (record === null || !Object.is(record.trackById, itemTrackBy)) {
                    record = this._mismatch(record, item, itemTrackBy, index);
                    mayBeDirty = true;
                }
                else {
                    if (mayBeDirty) {
                        // TODO(misko): can we limit this to duplicates only?
                        record = this._verifyReinsertion(record, itemTrackBy, index);
                    }
                    if (!Object.is(record.item, item))
                        this._addIdentityChange(record, item);
                }
                record = record._next;
                index++;
            });
            this.length = index;
        }
        this._truncate(record);
        return this._isDirty();
    }
    /* CollectionChanges is considered dirty if it has any additions, moves, removals, or identity
     * changes.
     */
    _isDirty() {
        return !(this._removalsHead === null && this._additionsHead === null &&
            this._movesHead === null && this._identityChangesHead === null);
    }
    _reset() {
        if (this._isDirty()) {
            let record;
            // for (record = this._previousItHead = this._itHead; record !== null; record = record._next) {
            //   record._nextPrevious = record._next;
            // }
            for (record = this._additionsHead; record !== null; record = record._nextAdded) {
                record.previousIndex = record.currentIndex;
            }
            this._additionsHead = this._additionsTail = null;
            for (record = this._movesHead; record !== null; record = record._nextMoved) {
                record.previousIndex = record.currentIndex;
            }
            for (record = this._identityChangesHead; record !== null; record = record._nextIdentityChange) {
                record._isIdentityChange = false;
            }
            this._movesHead = this._movesTail = null;
            this._removalsHead = this._removalsTail = null;
            this._identityChangesHead = this._identityChangesTail = null;
            // TODO(vicb): when assert gets supported
            // assert(!this.isDirty);
        }
    }
    /**
     * This is the core function which handles differences between collections.
     *
     * - `record` is the record which we saw at this position last time. If null then it is a new
     *   item.
     * - `item` is the current item in the collection
     * - `index` is the position of the item in the collection
     */
    _mismatch(record, item, itemTrackBy, index) {
        // The previous record after which we will append the current one.
        let previousRecord;
        if (record === null) {
            previousRecord = this._itTail;
        }
        else {
            previousRecord = record._prev;
            // Remove the record from the collection since we know it does not match the item.
            this._remove(record);
        }
        // See if we have evicted the item, which used to be at some anterior position of _itHead list.
        record = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(itemTrackBy, null);
        if (record !== null) {
            // It is an item which we have evicted earlier: reinsert it back into the list.
            // But first we need to check if identity changed, so we can update in view if necessary.
            if (!Object.is(record.item, item))
                this._addIdentityChange(record, item);
            this._reinsertAfter(record, previousRecord, index);
        }
        else {
            // Attempt to see if the item is at some posterior position of _itHead list.
            record = this._linkedRecords === null ? null : this._linkedRecords.get(itemTrackBy, index);
            if (record !== null) {
                // We have the item in _itHead at/after `index` position. We need to move it forward in the
                // collection.
                // But first we need to check if identity changed, so we can update in view if necessary.
                if (!Object.is(record.item, item))
                    this._addIdentityChange(record, item);
                this._moveAfter(record, previousRecord, index);
            }
            else {
                // It is a new item: add it.
                record = this._addAfter(new IterableChangeRecord_(item, itemTrackBy), previousRecord, index);
            }
        }
        return record;
    }
    /**
     * This check is only needed if an array contains duplicates. (Short circuit of nothing dirty)
     *
     * Use case: `[a, a]` => `[b, a, a]`
     *
     * If we did not have this check then the insertion of `b` would:
     *   1) evict first `a`
     *   2) insert `b` at `0` index.
     *   3) leave `a` at index `1` as is. <-- this is wrong!
     *   3) reinsert `a` at index 2. <-- this is wrong!
     *
     * The correct behavior is:
     *   1) evict first `a`
     *   2) insert `b` at `0` index.
     *   3) reinsert `a` at index 1.
     *   3) move `a` at from `1` to `2`.
     *
     *
     * Double check that we have not evicted a duplicate item. We need to check if the item type may
     * have already been removed:
     * The insertion of b will evict the first 'a'. If we don't reinsert it now it will be reinserted
     * at the end. Which will show up as the two 'a's switching position. This is incorrect, since a
     * better way to think of it is as insert of 'b' rather then switch 'a' with 'b' and then add 'a'
     * at the end.
     *
     * @internal
     */
    _verifyReinsertion(record, 
    // item: T,
    itemTrackBy, index) {
        let reinsertRecord = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(itemTrackBy, null);
        if (reinsertRecord !== null) {
            record = this._reinsertAfter(reinsertRecord, record._prev, index);
        }
        else if (record.currentIndex != index) {
            record.currentIndex = index;
            this._addToMoves(record, index);
        }
        return record;
    }
    /**
     * Get rid of any excess {@link IterableChangeRecord_}s from the previous collection
     *
     * - `record` The first excess {@link IterableChangeRecord_}.
     *
     */
    _truncate(record) {
        // Anything after that needs to be removed;
        while (record !== null) {
            const nextRecord = record._next;
            this._addToRemovals(this._unlink(record));
            record = nextRecord;
        }
        if (this._unlinkedRecords !== null) {
            this._unlinkedRecords.clear();
        }
        if (this._additionsTail !== null) {
            this._additionsTail._nextAdded = null;
        }
        if (this._movesTail !== null) {
            this._movesTail._nextMoved = null;
        }
        if (this._itTail !== null) {
            this._itTail._next = null;
        }
        if (this._removalsTail !== null) {
            this._removalsTail._nextRemoved = null;
        }
        if (this._identityChangesTail !== null) {
            this._identityChangesTail._nextIdentityChange = null;
        }
    }
    _reinsertAfter(record, prevRecord, index) {
        if (this._unlinkedRecords !== null) {
            this._unlinkedRecords.remove(record);
        }
        const prev = record._prevRemoved;
        const next = record._nextRemoved;
        if (prev === null) {
            this._removalsHead = next;
        }
        else {
            prev._nextRemoved = next;
        }
        if (next === null) {
            this._removalsTail = prev;
        }
        else {
            next._prevRemoved = prev;
        }
        this._insertAfter(record, prevRecord, index);
        this._addToMoves(record, index);
        return record;
    }
    _moveAfter(record, prevRecord, index) {
        this._unlink(record);
        this._insertAfter(record, prevRecord, index);
        this._addToMoves(record, index);
        return record;
    }
    _addAfter(record, prevRecord, index) {
        this._insertAfter(record, prevRecord, index);
        if (this._additionsTail === null) {
            // TODO(vicb):
            // assert(this._additionsHead === null);
            this._additionsTail = this._additionsHead = record;
        }
        else {
            // TODO(vicb):
            // assert(_additionsTail._nextAdded === null);
            // assert(record._nextAdded === null);
            this._additionsTail = this._additionsTail._nextAdded = record;
        }
        return record;
    }
    _insertAfter(record, prevRecord, index) {
        // TODO(vicb):
        // assert(record != prevRecord);
        // assert(record._next === null);
        // assert(record._prev === null);
        const next = prevRecord === null ? this._itHead : prevRecord._next;
        // TODO(vicb):
        // assert(next != record);
        // assert(prevRecord != record);
        record._next = next;
        record._prev = prevRecord;
        if (next === null) {
            this._itTail = record;
        }
        else {
            next._prev = record;
        }
        if (prevRecord === null) {
            this._itHead = record;
        }
        else {
            prevRecord._next = record;
        }
        if (this._linkedRecords === null) {
            this._linkedRecords = new _DuplicateMap();
        }
        this._linkedRecords.put(record);
        record.currentIndex = index;
        return record;
    }
    _remove(record) {
        return this._addToRemovals(this._unlink(record));
    }
    _unlink(record) {
        if (this._linkedRecords !== null) {
            this._linkedRecords.remove(record);
        }
        const prev = record._prev;
        const next = record._next;
        // TODO(vicb):
        // assert((record._prev = null) === null);
        // assert((record._next = null) === null);
        if (prev === null) {
            this._itHead = next;
        }
        else {
            prev._next = next;
        }
        if (next === null) {
            this._itTail = prev;
        }
        else {
            next._prev = prev;
        }
        return record;
    }
    _addToMoves(record, toIndex) {
        // TODO(vicb):
        // assert(record._nextMoved === null);
        if (record.previousIndex === toIndex) {
            return record;
        }
        if (this._movesTail === null) {
            // TODO(vicb):
            // assert(_movesHead === null);
            this._movesTail = this._movesHead = record;
        }
        else {
            // TODO(vicb):
            // assert(_movesTail._nextMoved === null);
            this._movesTail = this._movesTail._nextMoved = record;
        }
        return record;
    }
    _addToRemovals(record) {
        if (this._unlinkedRecords === null) {
            this._unlinkedRecords = new _DuplicateMap();
        }
        this._unlinkedRecords.put(record);
        record.currentIndex = null;
        record._nextRemoved = null;
        if (this._removalsTail === null) {
            // TODO(vicb):
            // assert(_removalsHead === null);
            this._removalsTail = this._removalsHead = record;
            record._prevRemoved = null;
        }
        else {
            // TODO(vicb):
            // assert(_removalsTail._nextRemoved === null);
            // assert(record._nextRemoved === null);
            record._prevRemoved = this._removalsTail;
            this._removalsTail = this._removalsTail._nextRemoved = record;
        }
        return record;
    }
    _addIdentityChange(record, item) {
        record.item = item;
        record._isIdentityChange = true;
        if (this._identityChangesTail === null) {
            this._identityChangesTail = this._identityChangesHead = record;
        }
        else {
            this._identityChangesTail = this._identityChangesTail._nextIdentityChange = record;
        }
        return record;
    }
}
class _DuplicateItemRecordList {
    /** @internal */
    _head = null;
    /** @internal */
    _tail = null;
    /**
     * Append the record to the list of duplicates.
     *
     * Note: by design all records in the list of duplicates hold the same value in record.item.
     */
    add(record) {
        if (this._head === null) {
            this._head = this._tail = record;
            record._nextDup = null;
            record._prevDup = null;
        }
        else {
            // TODO(vicb):
            // assert(record.item ==  _head.item ||
            //       record.item is num && record.item.isNaN && _head.item is num && _head.item.isNaN);
            this._tail._nextDup = record;
            record._prevDup = this._tail;
            record._nextDup = null;
            this._tail = record;
        }
    }
    // Returns a IterableChangeRecord_ having IterableChangeRecord_.trackById == trackById and
    // IterableChangeRecord_.currentIndex >= atOrAfterIndex
    get(trackById, atOrAfterIndex) {
        let record;
        for (record = this._head; record !== null; record = record._nextDup) {
            if ((atOrAfterIndex === null || atOrAfterIndex <= record.currentIndex) &&
                Object.is(record.trackById, trackById)) {
                return record;
            }
        }
        return null;
    }
    /**
     * Remove one {@link IterableChangeRecord_} from the list of duplicates.
     *
     * Returns whether the list of duplicates is empty.
     */
    remove(record) {
        const prev = record._prevDup;
        const next = record._nextDup;
        if (prev === null) {
            this._head = next;
        }
        else {
            prev._nextDup = next;
        }
        if (next === null) {
            this._tail = prev;
        }
        else {
            next._prevDup = prev;
        }
        return this._head === null;
    }
}
class _DuplicateMap {
    map = new Map();
    put(record) {
        const key = record.trackById;
        let duplicates = this.map.get(key);
        if (!duplicates) {
            duplicates = new _DuplicateItemRecordList();
            this.map.set(key, duplicates);
        }
        duplicates.add(record);
    }
    /**
     * Retrieve the `value` using key. Because the IterableChangeRecord_ value may be one which we
     * have already iterated over, we use the `atOrAfterIndex` to pretend it is not there.
     *
     * Use case: `[a, b, c, a, a]` if we are at index `3` which is the second `a` then asking if we
     * have any more `a`s needs to return the second `a`.
     */
    get(trackById, atOrAfterIndex) {
        const key = trackById;
        const recordList = this.map.get(key);
        return recordList ? recordList.get(trackById, atOrAfterIndex) : null;
    }
    /**
     * Removes a {@link IterableChangeRecord_} from the list of duplicates.
     *
     * The list of duplicates also is removed from the map if it gets empty.
     */
    remove(record) {
        const key = record.trackById;
        const recordList = this.map.get(key);
        // Remove the list of duplicates when it gets empty
        if (recordList.remove(record)) {
            this.map.delete(key);
        }
        return record;
    }
    get isEmpty() {
        return this.map.size === 0;
    }
    clear() {
        this.map.clear();
    }
}
class IterableChangeRecord_ {
    item;
    trackById;
    currentIndex = null;
    previousIndex = null;
    /** @internal */
    _nextPrevious = null;
    /** @internal */
    _prev = null;
    /** @internal */
    _next = null;
    /** @internal */
    _prevDup = null;
    /** @internal */
    _nextDup = null;
    /** @internal */
    _prevRemoved = null;
    /** @internal */
    _nextRemoved = null;
    /** @internal */
    _nextAdded = null;
    /** @internal */
    _nextMoved = null;
    /** @internal */
    _nextIdentityChange = null;
    /** @internal */
    _isIdentityChange = false;
    constructor(item, trackById) {
        this.item = item;
        this.trackById = trackById;
    }
}
function getPreviousIndex(item, addRemoveOffset, moveOffsets) {
    const previousIndex = item.previousIndex;
    if (previousIndex === null)
        return previousIndex;
    let moveOffset = 0;
    if (moveOffsets && previousIndex < moveOffsets.length) {
        moveOffset = moveOffsets[previousIndex];
    }
    return previousIndex + addRemoveOffset + moveOffset;
}
function isListLikeIterable(obj) {
    if (!isJsObject(obj))
        return false;
    return Array.isArray(obj) ||
        (!(obj instanceof Map) && // JS Map are iterables but return entries as [k, v]
            Symbol.iterator in obj); // JS Iterable have a Symbol.iterator prop
}
function isJsObject(o) {
    return o !== null && (typeof o === 'function' || typeof o === 'object');
}

/**
 * A repository of different iterable diffing strategies.
 */
class QueuexIterableDiffers {
    _factories;
    constructor(_factories) {
        this._factories = _factories;
    }
    find(iterable) {
        const factory = this._factories.find((f) => f.supports(iterable));
        if (factory) {
            return factory;
        }
        else {
            throw new Error(`Cannot find a differ supporting object '${iterable}' of type '${getTypeName(iterable)}'!`);
        }
    }
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
    static extend(factories) {
        return {
            provide: QueuexIterableDiffers,
            useFactory: () => {
                const parent = inject(QueuexIterableDiffers, { optional: true, skipSelf: true });
                // if parent is null, it means that we are in the root injector and we have just overridden
                // the default injection mechanism for QueuexIterableDiffers.
                return QueuexIterableDiffers._create(factories, parent || new QueuexIterableDiffers([new DefaultQueuexIterableDifferFactory()]));
            }
        };
    }
    static _create(factories, parent) {
        if (parent != null) {
            factories = factories.concat(parent._factories);
        }
        return new QueuexIterableDiffers(factories);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.1", ngImport: i0, type: QueuexIterableDiffers, deps: "invalid", target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.1", ngImport: i0, type: QueuexIterableDiffers, providedIn: 'root', useFactory: () => new QueuexIterableDiffers([new DefaultQueuexIterableDifferFactory]) });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.1", ngImport: i0, type: QueuexIterableDiffers, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root', useFactory: () => new QueuexIterableDiffers([new DefaultQueuexIterableDifferFactory]) }]
        }], ctorParameters: () => [{ type: undefined }] });
function getTypeName(arg) {
    if (typeof arg === 'object' || typeof arg === 'function') {
        return arg.constructor.name;
    }
    return typeof arg;
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
function sharedSignal(initialValue, debugName) {
    const internalSource = signal(initialValue, ...(ngDevMode ? [{ debugName: "internalSource" }] : []));
    const externalSource = isSignal(initialValue) ? initialValue : null;
    const signalRef = {
        __internalSource__: internalSource,
        __externalSource__: externalSource,
        set(value) {
            if (isSignal(value)) {
                this.__externalSource__ = value;
            }
            else {
                this.__externalSource__ = null;
            }
            this.__internalSource__.set(value);
        },
        ref: null
    };
    const compotation = (function () {
        const result = this.__internalSource__();
        if (this.__externalSource__) {
            return this.__externalSource__();
        }
        return result;
    }).bind(signalRef);
    const options = typeof debugName === 'string' ? { debugName } : undefined;
    Object.defineProperty(signalRef, 'ref', {
        value: computed(compotation, options),
        writable: false
    });
    if (NG_DEV_MODE) {
        signalRef.toString = () => `[SharedSignalRef.ref: ${signalRef.ref}]`;
        if (typeof debugName === 'string') {
            signalRef.debugName = debugName;
        }
        else {
            signalRef.debugName = 'SharedSignalRef';
        }
    }
    return signalRef;
}

function hook(node) {
    this.node = node;
    this.run();
}
const SYNC_WATCH_NODE = /* @__PURE__ */ (() => {
    return {
        ...REACTIVE_NODE,
        consumerIsAlwaysLive: true,
        consumerAllowSignalWrites: false,
        consumerMarkedDirty: (node) => {
            node.prevHook = setPostSignalSetFn(node.hook);
        },
        run() {
            try {
                setPostSignalSetFn(this.prevHook);
                if (this.prevHook) {
                    const prevHook = this.prevHook;
                    prevHook(this.node);
                }
            }
            finally {
                if (this.fn === null) {
                    // trying to run a destroyed watch is noop
                    return;
                }
                if (isInNotificationPhase()) {
                    throw new Error(NG_DEV_MODE
                        ? 'Schedulers cannot synchronously execute watches while scheduling.'
                        : '');
                }
                this.dirty = false;
                if (this.version > 0 && !consumerPollProducersForChange(this)) {
                    return;
                }
                this.version++;
                if (this.version <= 0) {
                    this.version = 2;
                }
                const prevConsumer = consumerBeforeComputation(this);
                try {
                    const value = this.source();
                    const fn = this.fn;
                    const prevConsumer = setActiveConsumer(null);
                    try {
                        fn(value);
                    }
                    finally {
                        setActiveConsumer(prevConsumer);
                    }
                }
                finally {
                    consumerAfterComputation(this, prevConsumer);
                }
            }
        },
        destroy() {
            this.destroyed = true;
            consumerDestroy(this);
            this.fn = null;
        },
    };
})();
const BASE_VALUE_REF = {
    set(value) {
        if (this.__node__) {
            this.__node__.destroy();
        }
        if (isSignal(value)) {
            this.__node__ = watchSignal(value, (v) => this.__value__ = v);
            return;
        }
        this.__value__ = value;
    },
    get value() {
        return this.__value__;
    }
};
function watchSignal(source, effectFn) {
    const node = Object.create(SYNC_WATCH_NODE);
    node.hook = hook.bind(node);
    node.fn = effectFn;
    node.source = source;
    consumerMarkDirty(node);
    node.run();
    return node;
}
function value(initialValue, arg2, arg3) {
    (NG_DEV_MODE) &&
        assertNotInReactiveContext(value);
    let destroyRef = null;
    let debugName = 'ValueRef';
    if (typeof arg2 === 'object' && typeof arg2.onDestroy === 'function' && typeof arg2.destroyed === 'boolean') {
        destroyRef = arg2;
    }
    if (typeof arg2 === 'string') {
        debugName = arg2;
    }
    if (typeof arg3 === 'string') {
        debugName = arg3;
    }
    if (!destroyRef) {
        (NG_DEV_MODE) &&
            assertInInjectionContext(value);
        destroyRef = inject(DestroyRef);
    }
    const ref = Object.create(BASE_VALUE_REF);
    ref.__value__ = undefined;
    ref.__node__ = null;
    ref.set(initialValue);
    if (NG_DEV_MODE) {
        ref.toString = () => `[ValueRef.value: ${ref.__value__}]`;
        ref.debugName = debugName;
    }
    destroyRef.onDestroy(() => {
        if (ref.__node__) {
            ref.__node__.destroy();
        }
    });
    return ref;
}

class EffectRefImpl {
    _watcher;
    constructor(fn, priorityLevel, allowSignalWrites) {
        this._watcher = createWatch(fn, () => scheduleTask(() => this._watcher.run(), priorityLevel), allowSignalWrites);
        this._watcher.notify();
    }
    destroy() {
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
function concurrentEffect(effectFn, options) {
    if (NG_DEV_MODE) {
        assertNotInReactiveContext(concurrentEffect);
        if (Integrator.instance === null) {
            throw new Error('concurrentEffect(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        }
        if (Integrator.instance.isServer) {
            throw new Error('concurrentEffect(): ' + SERVER_SIDE_MESSAGE);
        }
        if (Integrator.instance.uncompleted) {
            throw new Error('concurrentEffect(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
        }
    }
    const priorityLevel = priorityNameToNumber(options?.priority ?? 'normal');
    const manualCleanup = options?.manualCleanup ?? false;
    const allowSignalWrites = options?.allowSignalWrites ?? false;
    let destroyRef = options?.destroyRef ?? null;
    if (NG_DEV_MODE && !manualCleanup && !destroyRef) {
        assertInInjectionContext(concurrentEffect);
    }
    if (!manualCleanup && !destroyRef) {
        destroyRef = inject(DestroyRef);
    }
    const effectRef = new EffectRefImpl(effectFn, priorityLevel, allowSignalWrites);
    if (!manualCleanup) {
        (destroyRef ??= inject(DestroyRef)).onDestroy(() => effectRef.destroy());
    }
    return effectRef;
}

/*
 * Public API Surface of core
 */

/**
 * Generated bundle index. Do not edit.
 */

export { Priority, QueuexIterableDiffers, advancePriorityInputTransform, assertInConcurrentCleanTaskContext, assertInConcurrentDirtyTaskContext, assertInConcurrentTaskContext, assertNgQueuexIntegrated, completeIntegrationForTest, concurrentEffect, detectChanges, detectChangesSync, isInConcurrentCleanTaskContext, isInConcurrentDirtyTaskContext, isInConcurrentTaskContext, isTaskQueueEmpty, onTaskExecuted, priorityInputTransform, priorityNameToNumber, provideNgQueuexIntegration, scheduleChangeDetection, scheduleTask, sharedSignal, value, whenIdle };
//# sourceMappingURL=ng-queuex-core.mjs.map
