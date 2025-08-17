import type { ZoneMinApi } from './scheduler_utils';
import { ɵglobal } from '@angular/core';

interface Runtime {
  advanceTime(ms: number): void;
  fireMessageEvent(): void;
  log(value: string): void;
  isLogEmpty(): boolean;
  assertLog(expected: string[]): void;
  hasPendingMicrotask(): boolean;
  flushMicrotasks(): void;
  assertPendingMicrotask(): void
  assertNoPendingMicrotask(): void;
}

const originalPerformance = ɵglobal.performance;
const originalSetTimeout = ɵglobal.setTimeout;
const originalClearTimeout = ɵglobal.clearTimeout;
const originalSetImmediate = ɵglobal.setImmediate;
const originalClearImmediate = ɵglobal.clearImmediate;
const originalRequestAnimationFrame = ɵglobal.requestAnimationFrame;
const originalCancelAnimationFrame = ɵglobal.cancelAnimationFrame;
const originalMessageChannel = ɵglobal.MessageChannel;
const originalPromise = ɵglobal.Promise;
const originalQueueMicrotask = ɵglobal.queueMicrotask;

enum Priority {
  Highest = 1,
  High = 2,
  Normal = 3,
  Low = 4,
  Lowest = 5
}

const Priorities = [Priority.Lowest, Priority.Low, Priority.Normal, Priority.High, Priority.Highest];

const enum LogEvent {
    Task = 'Task',
    SetTimer = 'Set Timer',
    SetImmediate = 'Set Immediate',
    PostMessage = 'Post Message',
    MessageEvent = 'Message Event',
    Continuation = 'Continuation',
    Idle = 'Idle'
}

function installMockPromise(): (() => void)[] {
  const microtasks: (() => void)[] = [];

  function isPromiseLike<T>(arg: T | PromiseLike<T>): arg is PromiseLike<T> {
    if (arg != null && (typeof arg === 'object' || typeof arg === 'function') && typeof (arg as any).then === 'function' ) {
      return true;
    } else {
      return false
    }
  }

  class MockPromise<T> implements Promise<T> {
    #thenHandlers: ((value: T) => void)[] = [];
    #catchHandlers: ((reason: any) => void)[] = [];

    constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void) {
      executor(
        (value) => {
          microtasks.push(() => {
            this.#thenHandlers.forEach(h => h(value));
          });
        },
        (reason) => {
          microtasks.push(() => {
            this.#catchHandlers.forEach(h => h(reason));
          });
        }
      );
    }

    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {

      return new MockPromise((resolve, reject) => {
        if (onfulfilled) this.#thenHandlers.push((v) => {
          const result = onfulfilled(v);
          if(isPromiseLike(result)) {
            result.then((value) => resolve(value), typeof onrejected === 'function' ? null : (r) => reject(r));
          } else {
            resolve(result);
          }
        });

        if (onrejected) this.#catchHandlers.push((e) => {
          const result = onrejected(e);
          if (isPromiseLike(result)) {
            result.then(null, (r) => reject(r));
          } else {
            reject(result);
          }
        });
      });
    }

    catch<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
    ): Promise<T | TResult> {
      return this.then(null, onrejected);
    }

    finally(onfinally?: (() => void) | null): Promise<T> {
      return this.then(
        (v) => {
          onfinally?.();
          return v;
        },
        (e) => {
          onfinally?.();
          throw e;
        }
      );
    }

    [Symbol.toStringTag] = "Promise";
  }

  ɵglobal.Promise = MockPromise;
  ɵglobal.queueMicrotask = (cb: () => void) => microtasks.push(cb);

  return microtasks;
}

function installMockBrowserRuntime(): Runtime {
  let timerIdCounter = 0;
  let currentTime = 0;
  let eventLogs: string[] = [];
  let hasPendingMessageEvent = false;
  const microtasks = installMockPromise();


  ɵglobal.performance.now = () => {
    return currentTime;
  };

  ɵglobal.requestAnimationFrame = ɵglobal.cancelAnimationFrame = () => {};

  ɵglobal.setTimeout = () => {
    const id = timerIdCounter++;
    log(LogEvent.SetTimer);
    return id;
  };

  ɵglobal.clearTimeout = () => {};

  const port1 = {} as MessagePort;
  const port2 = {
    postMessage() {
      if (hasPendingMessageEvent) {
        throw Error('Message event already scheduled');
      }
      log(LogEvent.PostMessage);
      hasPendingMessageEvent = true;
    },
  };

  ɵglobal.MessageChannel = function MessageChannel() {
    this.port1 = port1;
    this.port2 = port2;
  };

  ɵglobal.setImmediate = undefined;

  function ensureLogIsEmpty(): void | never {
    if (eventLogs.length !== 0) {
      throw Error('Log is not empty. Call assertLog before continuing.');
    }
  }

  function advanceTime(ms: number): void {
    currentTime += ms;
  }

  function fireMessageEvent(): void {
    ensureLogIsEmpty();
    if (!hasPendingMessageEvent) {
      throw Error('No message event was scheduled');
    }
    flushMicrotasks();
    hasPendingMessageEvent = false;
    const onMessage = port1.onmessage as any;
    log(LogEvent.MessageEvent);
    onMessage.call(port1);
  }

  function log(value: string): void {
    eventLogs.push(value);
  }

  function isLogEmpty(): boolean {
    return eventLogs.length === 0;
  }

  function assertLog(expected: string[]): void {
    const actual = eventLogs;
    eventLogs = [];
    expect(actual).toEqual(expected);
  }

  function hasPendingMicrotask(): boolean {
    return microtasks.length > 0;
  }

  function flushMicrotasks(): void {
    while(microtasks.length) {
      microtasks.shift()!();
    }
  }

  function assertPendingMicrotask(): void {
    expect(microtasks.length).toBeGreaterThan(0);
  }

  function assertNoPendingMicrotask(): void {
    expect(microtasks.length).toBe(0);
  }

  return {
    advanceTime,
    fireMessageEvent,
    log,
    isLogEmpty,
    assertLog,
    hasPendingMicrotask,
    flushMicrotasks,
    assertPendingMicrotask,
    assertNoPendingMicrotask
  };
}

function installMockNodeRuntime(): Runtime {
  const _runtime = installMockBrowserRuntime();
  let immediateIdCounter = 0;
  let pendingExhaust: (() => void) | null = null;

  ɵglobal.setImmediate = (cb: () => void) => {
    if (pendingExhaust) {
      throw Error('Message event already scheduled');
    }
    const id = immediateIdCounter++;
    _runtime.log(LogEvent.SetImmediate);
    pendingExhaust = cb;
    return id;
  };

  ɵglobal.clearImmediate = () => {};

  function fireMessageEvent(): void {
    if (!pendingExhaust) {
      throw Error('No message event was scheduled');
    }
    _runtime.flushMicrotasks();
    _runtime.log(LogEvent.MessageEvent);
    const exhaust = pendingExhaust;
    pendingExhaust = null;
    exhaust();
  }
  return {
    advanceTime: _runtime.advanceTime,
    fireMessageEvent,
    log: _runtime.log,
    isLogEmpty: _runtime.isLogEmpty,
    assertLog: _runtime.assertLog,
    hasPendingMicrotask: _runtime.hasPendingMicrotask,
    flushMicrotasks: _runtime.flushMicrotasks,
    assertPendingMicrotask: _runtime.assertPendingMicrotask,
    assertNoPendingMicrotask: _runtime.assertNoPendingMicrotask
  };
}

function installMockNonBrowserRuntime(): Runtime {
  const _runtime = installMockBrowserRuntime();
    let immediateIdCounter = 0;
    let pendingExhaust: (() => void) | null = null;
    ɵglobal.MessageChannel = undefined;
    ɵglobal.setTimeout = (cb: () => void) => {
      const id = immediateIdCounter++;
      _runtime.log(LogEvent.SetTimer);
      pendingExhaust = cb;
      return id;
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ɵglobal.clearTimeout = () => {};

    function fireMessageEvent(): void {
      if (!pendingExhaust) {
        throw Error('No message event was scheduled');
      }
      _runtime.flushMicrotasks();
      _runtime.log(LogEvent.MessageEvent);
      const exhaust = pendingExhaust;
      pendingExhaust = null;
      exhaust();
    }
    return {
      advanceTime: _runtime.advanceTime,
      fireMessageEvent,
      log: _runtime.log,
      isLogEmpty: _runtime.isLogEmpty,
      assertLog: _runtime.assertLog,
      hasPendingMicrotask: _runtime.hasPendingMicrotask,
      flushMicrotasks: _runtime.flushMicrotasks,
      assertPendingMicrotask: _runtime.assertPendingMicrotask,
      assertNoPendingMicrotask: _runtime.assertNoPendingMicrotask
    };
}

function getMockZone(startCb?: VoidFunction, endCb?: VoidFunction): ZoneMinApi {
    const run = jest.fn((fn: (...args: any[]) => any) => {
      if (startCb) {
        startCb();
      }

      const result = fn();

      if (endCb) {
        endCb();
      }

      return result;
    });
    return { run };
  }

function cancelCallback(task: import('./scheduler_utils').SchedulerTask) {
  task.callback = null;
  task.status = 4 //Aborted;
}

function describePriorityLevel(priorityLevel: Priority, fn: jest.EmptyFunction): void {
  describe(`Priority level = ${Priority[priorityLevel]}`, fn)
}

describe('Scheduler.', () => {
  let runtime: Runtime;
  let performance: Performance;
  let schedulingMessageEvent: LogEvent;
  let scheduleCallback: typeof import('./scheduler').scheduleCallback;
  let assertInConcurrentTaskContext: typeof import('./scheduler').assertInConcurrentTaskContext;
  let assertInConcurrentCleanTaskContext: typeof import('./scheduler').assertInConcurrentCleanTaskContext;
  let assertInConcurrentDirtyTaskContext: typeof import('./scheduler').assertInConcurrentDirtyTaskContext;
  let isInConcurrentTaskContext: typeof import('./scheduler').isInConcurrentTaskContext;
  let isInConcurrentCleanTaskContext: typeof import('./scheduler').isInConcurrentCleanTaskContext;
  let isInConcurrentDirtyTaskContext: typeof import('./scheduler').isInConcurrentDirtyTaskContext;
  let whenIdle: typeof import('./scheduler').whenIdle;


  describe.each([['Browser'], ['Node'], ['NonBrowser']])('%p', (env) => {
    beforeEach(() => {
      jest.resetModules();
      jest.mock('./scheduler.ts', () => jest.requireActual('./scheduler.ts'));
      switch (env) {
        case 'Browser':
          runtime = installMockBrowserRuntime();
          schedulingMessageEvent = LogEvent.PostMessage;
          break;
        case 'Node':
          runtime = installMockNodeRuntime();
          schedulingMessageEvent = LogEvent.SetImmediate;
          break;
        case 'NonBrowser':
          runtime = installMockNonBrowserRuntime();
          schedulingMessageEvent = LogEvent.SetTimer;
          break;
      }
      performance = ɵglobal.performance;
      const Scheduler = require('./scheduler') as typeof import('./scheduler');
      scheduleCallback = Scheduler.scheduleCallback;
      assertInConcurrentTaskContext = Scheduler.assertInConcurrentTaskContext;
      assertInConcurrentCleanTaskContext = Scheduler.assertInConcurrentCleanTaskContext;
      assertInConcurrentDirtyTaskContext = Scheduler.assertInConcurrentDirtyTaskContext;
      isInConcurrentTaskContext = Scheduler.isInConcurrentTaskContext;
      isInConcurrentCleanTaskContext = Scheduler.isInConcurrentCleanTaskContext;
      isInConcurrentDirtyTaskContext = Scheduler.isInConcurrentDirtyTaskContext;
      whenIdle = Scheduler.whenIdle;
    })

    afterEach(() => {
      if (!runtime.isLogEmpty()) {
        throw Error('Test ended without clearing log.');
      }
      if (runtime.hasPendingMicrotask()) {
        throw new Error('Test ended with pending microtask.')
      }
    });

    afterAll(() => {
      ɵglobal.performance = originalPerformance;
      ɵglobal.setTimeout = originalSetTimeout;
      ɵglobal.clearTimeout = originalClearTimeout;
      ɵglobal.setImmediate = originalSetImmediate;
      ɵglobal.clearImmediate = originalClearImmediate;
      ɵglobal.requestAnimationFrame = originalRequestAnimationFrame;
      ɵglobal.cancelAnimationFrame = originalCancelAnimationFrame;
      ɵglobal.MessageChannel = originalMessageChannel;
      ɵglobal.Promise = originalPromise;
      ɵglobal.queueMicrotask = originalQueueMicrotask;
    });

    Priorities.forEach((priorityLevel) => {

      describePriorityLevel(priorityLevel, () => {

        it('Small task should finish before deadline.', () => {
          whenIdle().then(() => {
            runtime.log(LogEvent.Idle)
          });

          scheduleCallback(priorityLevel, () => {
            runtime.log(LogEvent.Task);
          });

          runtime.assertLog([schedulingMessageEvent])
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, LogEvent.Task]);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);

        });

        it('Small multiple tasks should finish before deadline.', () => {
          whenIdle().then(() => {
            runtime.log(LogEvent.Idle);
          });
          scheduleCallback(priorityLevel, () => {
            runtime.log('A');
          });
          scheduleCallback(priorityLevel, () => {
            runtime.log('B');
          });

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A', 'B']);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);
        });

        if (priorityLevel === Priority.Highest) {
          it('Two tasks where firs one hits deadline, should not yeld next task, if priority is highest', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle))
            scheduleCallback(priorityLevel, () => {
              runtime.log('A');
              runtime.advanceTime(20);
            });
            scheduleCallback(priorityLevel, () => {
              runtime.log('B');
            });

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([
              LogEvent.MessageEvent,
              'A',
              'B',
            ]);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });
        } else {
          it('Two tasks where firs one hits deadline, should yeld next task, if priority is not highest', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            scheduleCallback(priorityLevel, () => {
              runtime.log('A');
              runtime.advanceTime(20);
            });
            scheduleCallback(priorityLevel, () => {
              runtime.log('B');
            });

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([
              LogEvent.MessageEvent,
              'A',
              // Ran out of time. Post a continuation event.
              schedulingMessageEvent,
            ]);
            runtime.assertNoPendingMicrotask();
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'B']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });
        }

        it('Canceled task should not be executed.', () => {
          whenIdle().then(() => runtime.log(LogEvent.Idle));
          const task = scheduleCallback(priorityLevel, () => {
            runtime.log(LogEvent.Task);
          });

          runtime.assertLog([schedulingMessageEvent]);
          cancelCallback(task);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent]);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle])
        });

        it('After error thrown it should continues in a new event.', () => {
          whenIdle().then(() => runtime.log(LogEvent.Idle))
          scheduleCallback(priorityLevel, () => {
            runtime.log('Oops!');
            throw Error('Oops!');
          });
          scheduleCallback(priorityLevel, () => {
            runtime.log('Yay');
          });

          runtime.assertLog([schedulingMessageEvent]);

          expect(() => runtime.fireMessageEvent()).toThrow('Oops!');
          runtime.assertLog([
            LogEvent.MessageEvent,
            'Oops!',
            schedulingMessageEvent,
          ]);

          runtime.assertNoPendingMicrotask();

          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'Yay']);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);
        });

        it('When task queue gets empty, new task should be scheduled with new event.', () => {
          whenIdle().then(() => runtime.log(LogEvent.Idle));
          scheduleCallback(priorityLevel, () => {
            runtime.log('A');
          });

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A']);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);

          whenIdle().then(() => runtime.log(LogEvent.Idle));
          scheduleCallback(priorityLevel, () => {
            runtime.log('B');
          });
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertNoPendingMicrotask();

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'B']);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);
        });

        it('When task queue gets empty with aborted task, new task should be scheduled with new event.', () => {
          whenIdle().then(() => runtime.log(LogEvent.Idle));
          const task = scheduleCallback(priorityLevel, () => {
            runtime.log('A');
          });

          runtime.assertLog([schedulingMessageEvent]);
          cancelCallback(task);

          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent]);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);

          whenIdle().then(() => runtime.log(LogEvent.Idle));
          scheduleCallback(priorityLevel, () => {
            runtime.log('B');
          });
          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'B']);
          runtime.assertPendingMicrotask();
          runtime.flushMicrotasks();
          runtime.assertLog([LogEvent.Idle]);
        });


      });

    });// Prios Loop

    describe('Zone', () => {
      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Should run task in provided zone.', () => {
            const zone = getMockZone(
              () => runtime.log('zone_enter'),
              () => runtime.log('zone_leave')
            );

            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('A');
            });
            task.zone = zone;

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            expect(zone.run).toHaveBeenCalledTimes(1);
            runtime.assertLog([LogEvent.MessageEvent, 'zone_enter', 'A', 'zone_leave']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('Should run multiple task in different zones.', () => {
            const zone1 = getMockZone(() => runtime.log('zone1_enter'), () => runtime.log('zone1_leave'));
            const zone2 = getMockZone(() => runtime.log('zone2_enter'), () => runtime.log('zone2_leave'));

            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task1 = scheduleCallback(priorityLevel, () => runtime.log('A'));
            const task2 = scheduleCallback(priorityLevel, () => runtime.log('B'));
            const task3 = scheduleCallback(priorityLevel, () => runtime.log('C'));
            task1.zone = zone1;
            task2.zone = zone2;
            task3.zone = zone1;

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            expect(zone1.run).toHaveBeenCalledTimes(2);
            expect(zone2.run).toHaveBeenCalledTimes(1);
            runtime.assertLog([
              LogEvent.MessageEvent,
              'zone1_enter',
              'A',
              'zone1_leave',
              'zone2_enter',
              'B',
              'zone2_leave',
              'zone1_enter',
              'C',
              'zone1_leave',
            ]);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          if (priorityLevel === Priority.Highest) {

            it('Should run multiple task in different zones, where if deadline is reached and priority is highest, should not yield in between.', () => {
              const zone1 = getMockZone(() => runtime.log('zone1_enter'), () => runtime.log('zone1_leave'));
              const zone2 = getMockZone(() => runtime.log('zone2_enter'), () => runtime.log('zone2_leave'));

              whenIdle().then(() => runtime.log(LogEvent.Idle));
              const task1 = scheduleCallback(priorityLevel, () => {
                runtime.log('A');
              });
              const task2 = scheduleCallback(priorityLevel, () => {
                runtime.log('B');
                runtime.advanceTime(20);
              });
              const task3 = scheduleCallback(priorityLevel, () => {
                runtime.log('C');
              });

              task1.zone = zone1;
              task2.zone = zone2;
              task3.zone = zone1;
              runtime.assertLog([schedulingMessageEvent]);
              runtime.fireMessageEvent();
              runtime.assertLog([
                LogEvent.MessageEvent,
                'zone1_enter',
                'A',
                'zone1_leave',
                'zone2_enter',
                'B',
                'zone2_leave',
                'zone1_enter',
                'C',
                'zone1_leave',
              ]);
              expect(zone2.run).toHaveBeenCalledTimes(1);
              expect(zone1.run).toHaveBeenCalledTimes(2);
              runtime.assertPendingMicrotask();
              runtime.flushMicrotasks();
              runtime.assertLog([LogEvent.Idle]);
            });

          } else {

            it('Should run multiple task in different zones, where if deadline is reached and priority is not highest, should yield in between.', () => {
              const zone1 = getMockZone(() => runtime.log('zone1_enter'), () => runtime.log('zone1_leave'));
              const zone2 = getMockZone(() => runtime.log('zone2_enter'), () => runtime.log('zone2_leave'));

              whenIdle().then(() => runtime.log(LogEvent.Idle));
              const task1 = scheduleCallback(priorityLevel, () => {
                runtime.log('A');
              });
              const task2 = scheduleCallback(priorityLevel, () => {
                runtime.log('B');
                runtime.advanceTime(20);
              });
              const task3 = scheduleCallback(priorityLevel, () => {
                runtime.log('C');
              });

              task1.zone = zone1;
              task2.zone = zone2;
              task3.zone = zone1;
              runtime.assertLog([schedulingMessageEvent]);
              runtime.fireMessageEvent();
              runtime.assertLog([
                LogEvent.MessageEvent,
                'zone1_enter',
                'A',
                'zone1_leave',
                'zone2_enter',
                'B',
                'zone2_leave',
                // Ran out of time. Post a continuation event.
                schedulingMessageEvent,
              ]);
              runtime.assertNoPendingMicrotask();
              runtime.fireMessageEvent();
              runtime.assertLog([LogEvent.MessageEvent, 'zone1_enter', 'C', 'zone1_leave']);
              expect(zone2.run).toHaveBeenCalledTimes(1);
              expect(zone1.run).toHaveBeenCalledTimes(2);
              runtime.assertPendingMicrotask();
              runtime.flushMicrotasks();
              runtime.assertLog([LogEvent.Idle]);
            });

          }
        });
      })
    }) // Prios Loop

    describe('Task hooks.', () => {
      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('A beforeExecute() hook function should run before task callback.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            task.beforeExecute = () => runtime.log('beforeExecute');

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'beforeExecute', 'callback']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('On executed listener should run after task callback.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            (task.onExecutedListeners ??= []).push(() => runtime.log('onExecuted1'));
            task.onExecutedListeners.push(() => runtime.log('onExecuted2'));

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'callback', 'onExecuted1', 'onExecuted2']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('Error thrown in onExecuted listener should not block other listeners and next task should run in next event.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            (task.onExecutedListeners ??= []).push(() => { runtime.log('onExecuted1'); throw new Error('Oops!')});
            task.onExecutedListeners.push(() => runtime.log('onExecuted2'));

            scheduleCallback(priorityLevel, () => runtime.log('nextTaskCallback'));

            runtime.assertLog([schedulingMessageEvent]);

            expect(() => runtime.fireMessageEvent()).toThrow('Oops!');

            runtime.assertLog([LogEvent.MessageEvent, 'callback', 'onExecuted1', 'onExecuted2', schedulingMessageEvent]);
            runtime.assertNoPendingMicrotask();
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'nextTaskCallback']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('Internal on executed listener should run after callback.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            (task.internalOnExecutedListeners ??= []).push(() => runtime.log('internalOnExecuted1'));
            task.internalOnExecutedListeners.push(() => runtime.log('internalOnExecuted2'));

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'callback', 'internalOnExecuted1', 'internalOnExecuted2']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('Error thrown in internalOnExecuted listener should not block other listeners and next task should run in next event.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            (task.internalOnExecutedListeners ??= []).push(() => { runtime.log('internalOnExecuted1'); throw new Error('Oops!') });
            task.internalOnExecutedListeners.push(() => runtime.log('internalOnExecuted2'));

            scheduleCallback(priorityLevel, () => runtime.log('nextTaskCallback'));

            runtime.assertLog([schedulingMessageEvent]);

            expect(() => runtime.fireMessageEvent()).toThrow('Oops!');
            runtime.assertLog([LogEvent.MessageEvent, 'callback', 'internalOnExecuted1', 'internalOnExecuted2', schedulingMessageEvent]);
            runtime.assertNoPendingMicrotask();
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'nextTaskCallback']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          })

          it('Internal on executed listeners should run after normal on execute listeners.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });

            (task.onExecutedListeners ??= []).push(() => runtime.log('onExecuted1'));
            task.onExecutedListeners.push(() => runtime.log('onExecuted2'));

            (task.internalOnExecutedListeners ??= []).push(() => runtime.log('internalOnExecuted1'));
            task.internalOnExecutedListeners.push(() => runtime.log('internalOnExecuted2'));

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([
              LogEvent.MessageEvent,
              'callback',
              'onExecuted1',
              'onExecuted2',
              'internalOnExecuted1',
              'internalOnExecuted2'
            ]);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('Error thrown in onExecuted listener should not block internalOnExecuted listener and next task should run in new event.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            (task.onExecutedListeners ??= []).push(() => { runtime.log('onExecuted'); throw new Error('Oops!') });
            (task.internalOnExecutedListeners ??= []).push(() => { runtime.log('internalOnExecuted'); });

            scheduleCallback(priorityLevel, () => runtime.log('nextTaskCallback'));

            runtime.assertLog([schedulingMessageEvent]);

            expect(() => runtime.fireMessageEvent()).toThrow('Oops');
            runtime.assertLog([LogEvent.MessageEvent, 'callback', 'onExecuted', 'internalOnExecuted', schedulingMessageEvent]);
            runtime.assertNoPendingMicrotask();
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'nextTaskCallback']);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          })

          it('All hooks should run in zone.', () => {
            const zone = getMockZone(() => runtime.log('zone_enter'), () => runtime.log('zone_leave'));

            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const task = scheduleCallback(priorityLevel, () => {
              runtime.log('callback');
            });
            task.zone = zone;
            task.beforeExecute = () => runtime.log('beforeExecute');

            (task.onExecutedListeners ??= []).push(() => runtime.log('onExecuted1'));
            task.onExecutedListeners.push(() => runtime.log('onExecuted2'));

            (task.internalOnExecutedListeners ??= []).push(() => runtime.log('internalOnExecuted1'));
            task.internalOnExecutedListeners.push(() => runtime.log('internalOnExecuted2'));

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([
              LogEvent.MessageEvent,
              'zone_enter',
              'beforeExecute',
              'callback',
              'onExecuted1',
              'onExecuted2',
              'internalOnExecuted1',
              'internalOnExecuted2',
              'zone_leave'
            ]);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);
          });

          it('Should run multiple tasks with hooks in different zones.', () => {
            whenIdle().then(() => runtime.log(LogEvent.Idle));
            const zone1 = getMockZone(() => runtime.log('zone1_enter'), () => runtime.log('zone1_leave'));
            const zone2 = getMockZone(() => runtime.log('zone2_enter'), () => runtime.log('zone2_leave'));

            const task1 = scheduleCallback(priorityLevel, () => runtime.log('task1_callback'));
            const task2 = scheduleCallback(priorityLevel, () => runtime.log('task2_callback'));
            const task3 = scheduleCallback(priorityLevel, () => runtime.log('task3_callback'));

            task1.zone = task3.zone = zone1;
            task2.zone = zone2;

            task1.beforeExecute = () => runtime.log('task1_beforeExecute');
            task2.beforeExecute = () => runtime.log('task2_beforeExecute');
            task3.beforeExecute = () => runtime.log('task3_beforeExecute');

            (task1.onExecutedListeners ??= []).push(() => runtime.log('task1_onExecuted'));
            (task2.onExecutedListeners ??= []).push(() => runtime.log('task2_onExecuted'));
            (task3.onExecutedListeners ??= []).push(() => runtime.log('task3_onExecuted'));

            (task1.internalOnExecutedListeners ??= []).push(() => runtime.log('task1_internalOnExecuted'));
            (task2.internalOnExecutedListeners ??= []).push(() => runtime.log('task2_internalOnExecuted'));
            (task3.internalOnExecutedListeners ??= []).push(() => runtime.log('task3_internalOnExecuted'));

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([
              LogEvent.MessageEvent,

              'zone1_enter',
              'task1_beforeExecute',
              'task1_callback',
              'task1_onExecuted',
              'task1_internalOnExecuted',
              'zone1_leave',

              'zone2_enter',
              'task2_beforeExecute',
              'task2_callback',
              'task2_onExecuted',
              'task2_internalOnExecuted',
              'zone2_leave',

              'zone1_enter',
              'task3_beforeExecute',
              'task3_callback',
              'task3_onExecuted',
              'task3_internalOnExecuted',
              'zone1_leave',
            ]);
            runtime.assertPendingMicrotask();
            runtime.flushMicrotasks();
            runtime.assertLog([LogEvent.Idle]);

          });

          if (priorityLevel === Priority.Highest) {
            it('Should run multiple task with hooks in different zones, where if deadline is reached and priority is highest, should not yield in between.', () => {
              const zone1 = getMockZone(() => runtime.log('zone1_enter'), () => runtime.log('zone1_leave'));
              const zone2 = getMockZone(() => runtime.log('zone2_enter'), () => runtime.log('zone2_leave'));

              whenIdle().then(() => runtime.log(LogEvent.Idle));
              const task1 = scheduleCallback(priorityLevel, () => runtime.log('task1_callback'));
              const task2 = scheduleCallback(priorityLevel, () => { runtime.log('task2_callback'); runtime.advanceTime(20) });
              const task3 = scheduleCallback(priorityLevel, () => runtime.log('task3_callback'));

              task1.zone = task3.zone = zone1;
              task2.zone = zone2;

              task1.beforeExecute = () => runtime.log('task1_beforeExecute');
              task2.beforeExecute = () => runtime.log('task2_beforeExecute');
              task3.beforeExecute = () => runtime.log('task3_beforeExecute');

              (task1.onExecutedListeners ??= []).push(() => runtime.log('task1_onExecuted'));
              (task2.onExecutedListeners ??= []).push(() => runtime.log('task2_onExecuted'));
              (task3.onExecutedListeners ??= []).push(() => runtime.log('task3_onExecuted'));

              (task1.internalOnExecutedListeners ??= []).push(() => runtime.log('task1_internalOnExecuted'));
              (task2.internalOnExecutedListeners ??= []).push(() => runtime.log('task2_internalOnExecuted'));
              (task3.internalOnExecutedListeners ??= []).push(() => runtime.log('task3_internalOnExecuted'));

              runtime.assertLog([schedulingMessageEvent]);
              runtime.fireMessageEvent();
              runtime.assertLog([
                LogEvent.MessageEvent,

                'zone1_enter',
                'task1_beforeExecute',
                'task1_callback',
                'task1_onExecuted',
                'task1_internalOnExecuted',
                'zone1_leave',

                'zone2_enter',
                'task2_beforeExecute',
                'task2_callback',
                'task2_onExecuted',
                'task2_internalOnExecuted',
                'zone2_leave',

                'zone1_enter',
                'task3_beforeExecute',
                'task3_callback',
                'task3_onExecuted',
                'task3_internalOnExecuted',
                'zone1_leave',
              ]);
              runtime.assertPendingMicrotask();
              runtime.flushMicrotasks();
              runtime.assertLog([LogEvent.Idle]);
            });

          } else {
            it('Should run multiple task with hooks in different zones, where if deadline is reached and priority is not highest, should yield in between.', () => {
              const zone1 = getMockZone(() => runtime.log('zone1_enter'), () => runtime.log('zone1_leave'));
              const zone2 = getMockZone(() => runtime.log('zone2_enter'), () => runtime.log('zone2_leave'));

              whenIdle().then(() => runtime.log(LogEvent.Idle));
              const task1 = scheduleCallback(priorityLevel, () => runtime.log('task1_callback'));
              const task2 = scheduleCallback(priorityLevel, () => { runtime.log('task2_callback'); runtime.advanceTime(20) });
              const task3 = scheduleCallback(priorityLevel, () => runtime.log('task3_callback'));

              task1.zone = task3.zone = zone1;
              task2.zone = zone2;

              task1.beforeExecute = () => runtime.log('task1_beforeExecute');
              task2.beforeExecute = () => runtime.log('task2_beforeExecute');
              task3.beforeExecute = () => runtime.log('task3_beforeExecute');

              (task1.onExecutedListeners ??= []).push(() => runtime.log('task1_onExecuted'));
              (task2.onExecutedListeners ??= []).push(() => runtime.log('task2_onExecuted'));
              (task3.onExecutedListeners ??= []).push(() => runtime.log('task3_onExecuted'));

              (task1.internalOnExecutedListeners ??= []).push(() => runtime.log('task1_internalOnExecuted'));
              (task2.internalOnExecutedListeners ??= []).push(() => runtime.log('task2_internalOnExecuted'));
              (task3.internalOnExecutedListeners ??= []).push(() => runtime.log('task3_internalOnExecuted'));

              runtime.assertLog([schedulingMessageEvent]);
              runtime.fireMessageEvent();
              runtime.assertLog([
                LogEvent.MessageEvent,

                'zone1_enter',
                'task1_beforeExecute',
                'task1_callback',
                'task1_onExecuted',
                'task1_internalOnExecuted',
                'zone1_leave',

                'zone2_enter',
                'task2_beforeExecute',
                'task2_callback',
                'task2_onExecuted',
                'task2_internalOnExecuted',
                'zone2_leave',

                schedulingMessageEvent
              ]);

              runtime.assertNoPendingMicrotask();
              runtime.fireMessageEvent();
              runtime.assertLog([
                LogEvent.MessageEvent,
                'zone1_enter',
                'task3_beforeExecute',
                'task3_callback',
                'task3_onExecuted',
                'task3_internalOnExecuted',
                'zone1_leave',
              ]);

              runtime.assertPendingMicrotask();
              runtime.flushMicrotasks();
              runtime.assertLog([LogEvent.Idle]);
            });
          }

        });
      });
    });

    describe('Testing assertions.', () => {

      it('Assertions should failed.', () => {
        expect(() => assertInConcurrentTaskContext()).toThrow('assertInConcurrentTaskContext(): assertion failed!');
        expect(() => assertInConcurrentCleanTaskContext()).toThrow('assertInConcurrentCleanTaskContext(): assertion failed!');
        expect(() => assertInConcurrentDirtyTaskContext()).toThrow('assertInConcurrentDirtyTaskContext(): assertion failed!');
      });

      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Asserting any task in clean and dirty task callback should succeed.', () => {
            const cleanTask = scheduleCallback(priorityLevel, () => {
              assertInConcurrentTaskContext();
              runtime.log('A');
            });
            cleanTask.isClean = true //DEFAULT

            const dirtyTask = scheduleCallback(priorityLevel, () => {
              assertInConcurrentTaskContext();
              runtime.log('B');
            });
            dirtyTask.isClean = false;

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'A', 'B']);
          });

          it('Asserting a clean task in a clean task callback should succeed.', () => {
            const cleanTask = scheduleCallback(priorityLevel, () => {
              assertInConcurrentCleanTaskContext();
              runtime.log('A');
            });
            cleanTask.isClean = true; //DEFAULT

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'A']);
          });

          it('Asserting clean task in dirty task callback should fail.', () => {
            const cleanTask = scheduleCallback(priorityLevel, () => {
              runtime.log('A');
              assertInConcurrentCleanTaskContext();
            });
            cleanTask.isClean = false;

            runtime.assertLog([schedulingMessageEvent]);
            expect(() => runtime.fireMessageEvent()).toThrow();
            runtime.assertLog([LogEvent.MessageEvent, 'A', schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent]);
          });

          it('Asserting a dirty task in a dirty task callback should succeed.', () => {
            const cleanTask = scheduleCallback(priorityLevel, () => {
              assertInConcurrentDirtyTaskContext();
              runtime.log('A');
            });
            cleanTask.isClean = false;

            runtime.assertLog([schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent, 'A']);
          });

          it('Asserting a dirty task in a clean task callback should fail.', () => {
            const cleanTask = scheduleCallback(priorityLevel, () => {
              runtime.log('A');
              assertInConcurrentDirtyTaskContext();
            });
            cleanTask.isClean = true; //DEFAULT

            runtime.assertLog([schedulingMessageEvent]);
            expect(() => runtime.fireMessageEvent()).toThrow();
            runtime.assertLog([LogEvent.MessageEvent, 'A', schedulingMessageEvent]);
            runtime.fireMessageEvent();
            runtime.assertLog([LogEvent.MessageEvent]);
          });

        });
      });


    });


    describe('Context-determining function testing', () => {

      it('Functions should return false.', () => {
        expect(isInConcurrentTaskContext()).toBe(false);
        expect(isInConcurrentCleanTaskContext()).toBe(false);
        expect(isInConcurrentDirtyTaskContext()).toBe(false);
      });

      Priorities.forEach((priorityLevel) => {

        it('Function isInConcurrentTask() should return true in clean and dirty task callback.', () => {
          const cleanTask = scheduleCallback(priorityLevel, () => {
            runtime.log('A');
            expect(isInConcurrentTaskContext()).toBe(true);
          });
          cleanTask.isClean = true //DEFAULT;

          const dirtyTask = scheduleCallback(priorityLevel, () => {
            runtime.log('B');
            expect(isInConcurrentTaskContext()).toBe(true);
          });
          dirtyTask.isClean = false;

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A', 'B']);
        });

        it('Function isInConcurrentCleanTask() should return true in clean task callback.', () => {
          const cleanTask = scheduleCallback(priorityLevel, () => {
            runtime.log('A');
            expect(isInConcurrentCleanTaskContext()).toBe(true);
          });
          cleanTask.isClean = true //DEFAULT;

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A']);
        });

        it('Function isInConcurrentCleanTask() should return false in dirty task callback.', () => {
          const cleanTask = scheduleCallback(priorityLevel, () => {
            runtime.log('A');
            expect(isInConcurrentCleanTaskContext()).toBe(false);
          });
          cleanTask.isClean = false;

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A']);
        });

        it('Function isInConcurrentDirtyTask() should return true in dirty task callback.', () => {
          const cleanTask = scheduleCallback(priorityLevel, () => {
            runtime.log('A');
            expect(isInConcurrentDirtyTaskContext()).toBe(true);
          });
          cleanTask.isClean = false;

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A']);
        });

        it('Function isInConcurrentDirtyTask() should return false in clean task callback.', () => {
          const cleanTask = scheduleCallback(priorityLevel, () => {
            runtime.log('A');
            expect(isInConcurrentDirtyTaskContext()).toBe(false);
          });
          cleanTask.isClean = true; //DEFAULT

          runtime.assertLog([schedulingMessageEvent]);
          runtime.fireMessageEvent();
          runtime.assertLog([LogEvent.MessageEvent, 'A']);
        });

      })

    });

  });
})

