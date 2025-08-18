import { ɵglobal } from "@angular/core"
import {
  peek,
  pop,
  push,
  SchedulerTask,
  Priority,
  ZoneType,
  ZoneMinApi,
  ZoneTask,
  TaskStatus,
  noopFn,
  // taskCleanup
} from './scheduler_utils';

interface FlushWorkFn {
  (hasTimeRemaining: boolean, initialTime: number): boolean
}

declare const ngDevMode: boolean | undefined;
declare const Zone: ZoneType | undefined

const global = ɵglobal as typeof globalThis & { Zone?: ZoneType, setImmediate(cb: Function): number };

const noopZone: ZoneMinApi = { run(cb: Function) { return cb(); } };

let getCurrentTime: () => number = null!;
let onIdle: Function = noopFn;

if (typeof performance === 'object') {
  if (typeof performance.now === 'function') {
    getCurrentTime = function() { return performance.now(); };
  }
}

if (getCurrentTime === null) {
  getCurrentTime = function() { return Date.now() }
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
const taskQueue: SchedulerTask[] = [];
// const timerQueue: SchedulerTask[] = [];
// All the promise resolvers returned by whenIdle() function.
const idleResolvers: Function[] = [];

// Incrementing id counter. Used to maintain insertion order.
let taskIdCounter = 1;

let currentTask: SchedulerTask | null = null;
let currentPriorityLevel = Priority.Normal;

// This is set while performing work, to prevent re-entrancy.
let isPerformingWork = false;

let isHostCallbackScheduled = false;

function notifyTaskListenersAndCleanup(task: SchedulerTask) {
  try {
    while (task.onExecutedListeners && task.onExecutedListeners.length) {
      task.onExecutedListeners.shift()!();
    }
    while (task.internalOnExecutedListeners && task.internalOnExecutedListeners.length) {
      task.internalOnExecutedListeners.shift()!();
    }
  } finally {
    if (
      (task.onExecutedListeners && task.onExecutedListeners.length) ||
      (task.internalOnExecutedListeners && task.internalOnExecutedListeners.length)
    ) {
      notifyTaskListenersAndCleanup(task);
    } /* else {
      task.cleanup(); // or just task.scopeToHandle = null;
       //Good reason for that will be a caching implementation;
    } */
  }
}

function flushWork(hasTimeRemaining: boolean, initialTime: number): boolean {
  // We'll need a host callback the next time work is scheduled.
  isHostCallbackScheduled = false;

  isPerformingWork = true;
  const previousPriorityLevel = currentPriorityLevel;
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}

function workLoop(
  hasTimeRemaining: boolean,
  initialTime: number,
  _currentTask: SchedulerTask | null = null
): boolean {

  let currentTime = initialTime;
  if (_currentTask) {
    currentTask = _currentTask;
  } else {
    // advanceTimers(currentTime);
    currentTask = peek(taskQueue);
    //<MyCode>
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (currentTask) {
          if (
            currentTask.callback !== null &&
            currentTask.status !== TaskStatus.Pending &&
            currentTask.status !== TaskStatus.Prepared
          ) {
            throw new Error('InternalError: Peeked task in workLoop() function has incorrect status!')
          }
        }
      }
    if (currentTask && currentTask.status === TaskStatus.Pending) {
      currentTask.status = TaskStatus.Prepared;
    }
    //</MyCode>
  }
  let zoneChanged = false;
  const hitDeadline = () =>
    currentTask &&
    currentTask.expirationTime > currentTime &&
    (!hasTimeRemaining || shouldYieldToHost());

  if (!hitDeadline()) {
    const zone = currentTask?.zone ?? noopZone;
    zone.run(function() {
      while (currentTask !== null && !zoneChanged) {
        if (hitDeadline()) {
          break;
        }
        const callback = currentTask.callback;
        //<MyCode>
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
          if (
            callback === null &&
            currentTask.status !== TaskStatus.Aborted &&
            currentTask.status !== TaskStatus.Executed
          ) {
            throw new Error('InternalError: Task with null callback is not marked as aborted or executed!')
          }
        }
        //</MyCode>
        if (typeof callback === 'function') {
          currentTask.callback = null;
          currentPriorityLevel = currentTask.priorityLevel;
          //<MyCode>
          currentTask.status = TaskStatus.Executing
          currentTask.beforeExecute()
          try {
            callback();
          } finally {
            try {
              notifyTaskListenersAndCleanup(currentTask);
            } finally {
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
  } else {
    return false;
  }
}

export function scheduleCallback(
  priorityLevel: Priority,
  callback: VoidFunction,
): SchedulerTask {
  const startTime = getCurrentTime();

  let expirationTime: number;
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


  const newTask: SchedulerTask = {
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
    onAbort: noopFn,
    // cleanup: taskCleanup <-- Maybe if there will be implemented caching, then there is good reason to cleanup after task was executed, setting scopeToHandle to null;
  };

  newTask.sortIndex = expirationTime;
  push(taskQueue, newTask);
  // Schedule a host callback, if needed. If we're already performing work,
  // wait until the next time we yield.
  if (isHostCallbackScheduled && isPerformingWork) { return newTask };
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
 *
 * @example
 * ```ts
 * it('should wait until all microtasks are flushed', async () => {
 *   await whenIdle();
 *   expect(callbackSpy).toHaveBeenCalled();
 * });
 * ```
 */
export function whenIdle(attempts: number = 5): Promise<void> {
  return new Promise((resolve) => {
    let counter = 0;
    attempts = Math.max(5, Math.round(attempts));

    const addToQueueOrResolve = () => {
      queueMicrotask(() => {
        if (counter === attempts) {
        resolve();
        return;
      }

      if (taskQueue.length) {
        idleResolvers.push(resolve);
        return;
      }

      counter++
      addToQueueOrResolve();
      });
    }

    addToQueueOrResolve();
  });
}

/**
 * Determines that the current stack frame is within concurrent task context.
 * @returns True if current stack frame is within concurrent task context.
 */
export function isInConcurrentTaskContext(): boolean {
  return currentTask !== null && currentTask.status === TaskStatus.Executing;
}

/**
 * Asserts that the current stack frame is within an concurrent task context.
 * @param message Error message when assertion failed!.
 */
export function assertInConcurrentTaskContext(message?: string): void {
  if (isInConcurrentTaskContext()) { return; }
  message = message ?? 'assertInConcurrentTaskContext(): assertion failed!';
  throw new Error(message);
}

/**
 * Determines that the current stack frame is within concurrent task context and that task is clean.
 * @returns True if current stack frame is within concurrent task context and that task is clean.
 */
export function isInConcurrentCleanTaskContext(): boolean {
  return currentTask !== null && currentTask.status === TaskStatus.Executing && currentTask.isClean;
}

/**
 * Asserts that the current stack frame is within an concurrent task context and that task is clean.
 * @param message Error message when assertion failed!.
 */
export function assertInConcurrentCleanTaskContext(message?: string): void {
if (isInConcurrentCleanTaskContext()) { return; }
  message = message ?? 'assertInConcurrentCleanTaskContext(): assertion failed!';
  throw new Error(message);
}

/**
 * Determines that the current stack frame is within concurrent task context and that task is dirty.
 * @returns True if current stack frame is within concurrent task context and that task is dirty.
 */
export function isInConcurrentDirtyTaskContext(): boolean {
  return currentTask !== null && currentTask.status === TaskStatus.Executing && !currentTask.isClean;
}

/**
 * Asserts that the current stack frame is within an concurrent task context and that task is dirty.
 * @param message Error message when assertion failed!.
 */
export function assertInConcurrentDirtyTaskContext(message?: string): void {
  if (isInConcurrentDirtyTaskContext()) { return; }
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
export function onTaskExecuted(listener: VoidFunction): void {
  assertInConcurrentTaskContext('onTaskExecuted(): Stack frame is not in concurrent task context');
  (currentTask!.onExecutedListeners ??= []).push(listener);
}

export function getCurrentTask(): SchedulerTask | null {
  return currentTask
}

export function isTaskQueueEmpty(): boolean {
  return taskQueue.length === 0;
}

export function getQueueLength(): number {
  return taskQueue.length;
}

export function getTaskAt(index: number): SchedulerTask {
  return taskQueue[index];
}

export function setOnIdle(fn: Function | null): void {
  fn ? onIdle = fn : onIdle = noopFn;
}


let isMessageLoopRunning = false;
let scheduledHostCallback: FlushWorkFn | null = null;
let taskTimeoutID = -1;

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

export function forceFrameRate(fps: number) {
  if (fps < 0 || fps > 125) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.error(
        'forceFrameRate takes a positive int between 0 and 125, ' +
          'forcing frame rates higher than 125 fps is not supported',
      );
    }
    return;
  }
  if (fps > 0) {
    yieldInterval = Math.floor(1000 / fps);
  } else {
    // reset the framerate
    yieldInterval = 5;
  }
  // be aware of browser housekeeping work (~6ms per frame)
  // according to https://developers.google.com/web/fundamentals/performance/rendering
  yieldInterval = Math.max(5, yieldInterval - 6);
}
//<MyCode>
forceFrameRate(60);
//</MyCode>
const performWorkUntilDeadline = function() {
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
    } finally {
      if (hasMoreWork) {
        // If there's more work, schedule the next message event at the end
        // of the preceding one.
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;

        // <<<<----Perfect place for hook and some cleanup logic. After all work compleat.---->>>>
        // Notifying that state is idle specs (see whenIdle() function in this file).
        while (idleResolvers.length) {
          idleResolvers.shift()!();
        }
        // Rising onIdle hook.
        onIdle();
        // <<<<////Perfect place for hook and some cleanup logic. After all work compleat.---->>>>
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
  // Yielding to the browser will give it a chance to paint, so we can
  // reset this.
  needsPaint = false;
};

let schedulePerformWorkUntilDeadline: () => void;
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
} else if (typeof global.MessageChannel !== 'undefined') {


  const channel = new  global.MessageChannel();
  const port = channel.port2;

  if (typeof Zone === 'undefined') {

    channel.port1.onmessage = performWorkUntilDeadline;
    schedulePerformWorkUntilDeadline = function () {
      port.postMessage(null);
    };

  } else {

    let zoneTask: ZoneTask = null!
    const noopFn = () => {};
    const schedulerFn = (task: ZoneTask) => {
      zoneTask = task;
      port.postMessage(null)
    }

    channel.port1.onmessage = function() { zoneTask.invoke(); }

    schedulePerformWorkUntilDeadline = function() {
        Zone.current.scheduleMacroTask(
        'setImmediate',
        performWorkUntilDeadline,
        { isPeriodic: false, args: [] },
        schedulerFn,
        noopFn,
      );
    }

  }

} else {
  // We should only fallback here in non-browser environments.
  schedulePerformWorkUntilDeadline = function() {
    global.setTimeout(performWorkUntilDeadline, 0);
  };
}

function requestHostCallback(callback: FlushWorkFn) {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}
