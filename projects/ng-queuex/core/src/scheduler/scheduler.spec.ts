import { fakeAsync, flush } from "@angular/core/testing";
import { onTaskExecuted, getQueueLength, isTaskQueueEmpty, scheduleCallback, setOnIdle, whenIdle } from "./scheduler";
import { Priority, SchedulerTask, TaskStatus } from "./scheduler_utils";
import { describeAsyncAwait, describeFakeAsync, describePriorityLevel, describeWithoutZone, doSomethingForSomeTime, doSomethingForTime, getRandomPositiveInteger, randomPrioritiesArray, randomPriority } from "./scheduler_test_utils";

const Priorities = [Priority.Lowest, Priority.Low, Priority.Normal, Priority.High, Priority.Highest];

function cancelTask(task: SchedulerTask) {
  task.callback = null;
  task.status = TaskStatus.Aborted;
}

/*


Scheduled callback in task context with higher priority then next pending one should be executed earlier.

Tasks in which execution will not reach the deadline will be executed synchronically right after each other.

For Tasks where first will reach deadline will not be executed synchronically.

*/

describe('Test utilities functions', () => {
  it('Should be array if priorities', () => {
    const priorities = randomPrioritiesArray();
    priorities.forEach((prio) => {
      expect(Priorities.includes(prio)).toBeTrue()
    });

    expect(priorities.length).toBeGreaterThanOrEqual(80);
  });
});

const enum ExecutionContextInfo {
  CurrentTest = "Current test context",
  ScheduledCallback = "Scheduled callback context",
  ScheduledCallback1 = "Scheduled callback 1 context",
  ScheduledCallback2 = "Scheduled callback 2 context",
  BeforeExecute = "Before execute context",
  BeforeExecuteTask1 = "Before execute for task 1 context",
  BeforeExecuteTask2 = "Before execute for task 2 context",
  OnExecuteListener1 = "OnExecute listener 1",
  OnExecuteListener2 = "OnExecute listener 2",
  OnExecuteListener1ForTask1 = "OnExecute listener 1 for task 1",
  OnExecuteListener2ForTask1 = "OnExecute listener 2 for task 1",
  OnExecuteListener1ForTask2 = "OnExecute listener 1 for task 2",
  OnExecuteListener2ForTask2 = "OnExecute listener 1 for task 1",
  InternalOnExecuteListener1 = "InternalOnExecute listener 1",
  InternalOnExecuteListener1ForTask1 = "InternalOnExecute listener 1 for task 1",
  InternalOnExecuteListener1ForTask2 = "InternalOnExecute listener 1 for task 2",
  InternalOnExecuteListener2 = "INternalOnExecute listener 1",
  InternalOnExecuteListener2ForTask1 = "INternalOnExecute listener 1 for task 1",
  InternalOnExecuteListener2ForTask2 = "INternalOnExecute listener 1 for task 2",
  Microtask = "Microtask context",
}

describe('Scheduler.', () => {

  describe('Scheduling one task.', () => {

    const expectation1 = 'Scheduled callback should be executed.';
    const expectation2 = 'Should invoke beforeExecute hook right before task callback.';
    const expectation3 = 'Should notify onExecute listeners right after task callback.';
    const expectation4 = 'Should notify internalOnExecute listeners after task callback.';
    const expectation5 = 'Should notify internalOnExecute listeners right after notifying onExecute listeners.'

    Priorities.forEach((priorityLevel) => {
      describe(`Priority level = ${Priority[priorityLevel]}`, () => {

        describeWithoutZone( () => {
          it(expectation1, (done) => {

            const doneCb = () => {
              queueMicrotask(() => {

                expect(log).toEqual([
                  ExecutionContextInfo.CurrentTest,
                  ExecutionContextInfo.ScheduledCallback
                ]);
                done();
              });
            }

            const log: string[] = [];

            scheduleCallback(priorityLevel, () => {
              doSomethingForSomeTime();
              log.push(ExecutionContextInfo.ScheduledCallback);
              doneCb();
            });

            log.push(ExecutionContextInfo.CurrentTest);
            expect(log.length).toEqual(1);

          });

          it(expectation2, (done) => {
            const info: string[] = [];

            const doneCb = () => queueMicrotask(() => {
              expect(info).toEqual([
                ExecutionContextInfo.CurrentTest,
                ExecutionContextInfo.BeforeExecute,
                ExecutionContextInfo.ScheduledCallback,
                ExecutionContextInfo.Microtask
              ]);
              done();
            });

            const task = scheduleCallback(priorityLevel, () => {
              info.push(ExecutionContextInfo.ScheduledCallback);

              doneCb()
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                info.push(ExecutionContextInfo.Microtask);
              })
              info.push(ExecutionContextInfo.BeforeExecute);
            }

            info.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

          });

          it(expectation3, (done) => {
            const log: string[] = [];
            const doneCb = () => queueMicrotask(() => {
              expect(log).toEqual([
                ExecutionContextInfo.CurrentTest,
                ExecutionContextInfo.BeforeExecute,
                ExecutionContextInfo.ScheduledCallback,
                ExecutionContextInfo.OnExecuteListener1,
                ExecutionContextInfo.OnExecuteListener2,
                ExecutionContextInfo.Microtask,
              ]);
              done();
            });

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
              doneCb();
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1));
            task.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2));

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);
          });

          it(expectation4, (done) => {
            const info: string[] = [];
            const doneCb = () => queueMicrotask(() => {
              expect(info).toEqual([
                ExecutionContextInfo.CurrentTest,
                ExecutionContextInfo.BeforeExecute,
                ExecutionContextInfo.ScheduledCallback,
                ExecutionContextInfo.InternalOnExecuteListener1,
                ExecutionContextInfo.InternalOnExecuteListener2,
                ExecutionContextInfo.Microtask,
              ]);
              done();
            });

            const task = scheduleCallback(priorityLevel, () => {
              info.push(ExecutionContextInfo.ScheduledCallback);
              doneCb();
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                info.push(ExecutionContextInfo.Microtask);
              })
              info.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.internalOnExecutedListeners ??= []).push(() => info.push(ExecutionContextInfo.InternalOnExecuteListener1));
            task.internalOnExecutedListeners.push(() => info.push(ExecutionContextInfo.InternalOnExecuteListener2));

            info.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);
          });



          it(expectation5, (done) => {
            const log: string[] = [];
            const doneCb = () => queueMicrotask(() => {
              expect(log).toEqual([
                ExecutionContextInfo.CurrentTest,
                ExecutionContextInfo.BeforeExecute,
                ExecutionContextInfo.ScheduledCallback,
                ExecutionContextInfo.OnExecuteListener1,
                ExecutionContextInfo.OnExecuteListener2,
                ExecutionContextInfo.InternalOnExecuteListener1,
                ExecutionContextInfo.InternalOnExecuteListener2,
                ExecutionContextInfo.Microtask,
              ]);
              done();
            });

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
              doneCb();
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1));
            task.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2));

            (task.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1));
            task.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2));

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);
          });

        });

        describeFakeAsync(() => {
          it(expectation1, fakeAsync(() => {

            const log: string[] = [];

            scheduleCallback(priorityLevel, () => {
              doSomethingForSomeTime();
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            log.push(ExecutionContextInfo.CurrentTest);
            expect(log.length).toEqual(1);

            flush(20)

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.ScheduledCallback
            ]);
          }));

          it(expectation2, fakeAsync(() => {
            const log: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

            flush(10);

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.Microtask
            ]);
          }));

          it(expectation3, fakeAsync(() => {

            const info: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              info.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                info.push(ExecutionContextInfo.Microtask);
              })
              info.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.onExecutedListeners ??= []).push(() => info.push(ExecutionContextInfo.OnExecuteListener1));
            task.onExecutedListeners.push(() => info.push(ExecutionContextInfo.OnExecuteListener2));

            info.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

            flush(20);

            expect(info).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.OnExecuteListener1,
              ExecutionContextInfo.OnExecuteListener2,
              ExecutionContextInfo.Microtask,
            ]);
          }));

          it(expectation4, fakeAsync(() => {
            const info: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              info.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                info.push(ExecutionContextInfo.Microtask);
              })
              info.push(ExecutionContextInfo.BeforeExecute);
            }


            (task.internalOnExecutedListeners ??= []).push(() => info.push(ExecutionContextInfo.InternalOnExecuteListener1));
            task.internalOnExecutedListeners.push(() => info.push(ExecutionContextInfo.InternalOnExecuteListener2));

            info.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);
            flush(20);

            expect(info).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.InternalOnExecuteListener1,
              ExecutionContextInfo.InternalOnExecuteListener2,
              ExecutionContextInfo.Microtask,
            ]);
          }));

          it(expectation5, fakeAsync(() => {
            const log: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1));
            task.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2));

            (task.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1));
            task.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2));

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);
            flush(20);

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.OnExecuteListener1,
              ExecutionContextInfo.OnExecuteListener2,
              ExecutionContextInfo.InternalOnExecuteListener1,
              ExecutionContextInfo.InternalOnExecuteListener2,
              ExecutionContextInfo.Microtask,
            ]);
          }));

        });

        describeAsyncAwait(() => {
          it(expectation1, async () => {

            const log: string[] = [];

            scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            log.push(ExecutionContextInfo.CurrentTest);
            expect(log.length).toEqual(1);

            await whenIdle();

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.ScheduledCallback
            ]);
          });

          it(expectation2, async () => {
            const log: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

            await whenIdle();

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.Microtask
            ]);

          });

          it(expectation3, async () => {
            const log: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1));
            task.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2));

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

            await whenIdle();

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.OnExecuteListener1,
              ExecutionContextInfo.OnExecuteListener2,
              ExecutionContextInfo.Microtask,
            ]);
          });

          it(expectation4, async () => {
            const log: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }


            (task.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1))
            task.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2))

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

            await whenIdle();

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.InternalOnExecuteListener1,
              ExecutionContextInfo.InternalOnExecuteListener2,
              ExecutionContextInfo.Microtask,
            ]);
          });

          it(expectation5, async () => {
            const log: string[] = [];

            const task = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback);
            });

            task.beforeExecute = () => {
              queueMicrotask(() => {
                log.push(ExecutionContextInfo.Microtask);
              })
              log.push(ExecutionContextInfo.BeforeExecute);
            }

            (task.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1));
            task.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2));

            (task.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1))
            task.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2))

            log.push(ExecutionContextInfo.CurrentTest);

            expect(getQueueLength()).toEqual(1);

            await whenIdle();

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecute,
              ExecutionContextInfo.ScheduledCallback,
              ExecutionContextInfo.OnExecuteListener1,
              ExecutionContextInfo.OnExecuteListener2,
              ExecutionContextInfo.InternalOnExecuteListener1,
              ExecutionContextInfo.InternalOnExecuteListener2,
              ExecutionContextInfo.Microtask,
            ]);
          });
        });
      });
    });
  });

  function checkIdOrder(tasks: SchedulerTask[]) {
    if (tasks.length <= 2) { return; }
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i - 1].id).toBeLessThan(tasks[i].id)
    }
  }

  function assertTasksOrdering(tasks: SchedulerTask[], skipCheckingPrioLevels: boolean = false) {

    if (!skipCheckingPrioLevels) {
      for (let i = 1; i < tasks.length; i++) {
        expect(tasks[i - 1].priorityLevel).toBeLessThanOrEqual(tasks[i].priorityLevel);
      }
    }

    const highestTasks = tasks.filter((task) => task.priorityLevel === Priority.Highest);
    const highTasks = tasks.filter((task) => task.priorityLevel === Priority.High);
    const normalTasks = tasks.filter((task) => task.priorityLevel === Priority.Normal);
    const lowTasks = tasks.filter((task) => task.priorityLevel === Priority.Low);
    const lowestTasks = tasks.filter((task) => task.priorityLevel === Priority.Lowest);

    checkIdOrder(highestTasks);
    checkIdOrder(highTasks);
    checkIdOrder(normalTasks);
    checkIdOrder(lowTasks);
    checkIdOrder(lowestTasks);
  }

  describe('Scheduling multiple tasks.', () => {

    const expectation1 = 'Should execute callbacks in correct order.';
    const expectation2 = 'Should execute callbacks in correct order for random created array of priorities.';
    const expectation3 = 'Tasks in which execution will not reach the deadline should be executed synchronically right after each other.';

    beforeAll(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 30_000;
    });
    afterAll(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 5_000;
    });


    describeWithoutZone(() => {
      it (expectation1, (done) => {
        const tasks: SchedulerTask[] = [];

        const doneCb = () => {
          queueMicrotask(() => {
            assertTasksOrdering(tasks);
            done();
          });
        }

        Priorities.forEach((priority) => {
          const task = scheduleCallback(priority, () => {
            tasks.push(task);
            doSomethingForSomeTime();
            if (priority === Priority.Highest) {
              doneCb()
            }
          })
        });
      });

      it(expectation2, (done) => {
        const priorities = randomPrioritiesArray();
        const tasks: SchedulerTask[] = [];

        const doneCb = () => {
          queueMicrotask(() => {
            assertTasksOrdering(tasks);
            done();
          });
        }

        priorities.forEach((prio, index) => {
          const task = scheduleCallback(prio, () => {
            tasks.push(task);
            doSomethingForSomeTime();
            if (index === priorities.length - 1) {
              doneCb();
            }
          });
        });
      });

    });

    describeFakeAsync(() => {
      it (expectation1, fakeAsync(() => {
        const tasks: SchedulerTask[] = [];

        Priorities.forEach((priority) => {
          const task = scheduleCallback(priority, () => {
            tasks.push(task);
            doSomethingForSomeTime();
          })
        });

        flush(20);

        assertTasksOrdering(tasks);
      }));

      it(expectation2, fakeAsync(() => {
        const priorities = randomPrioritiesArray();
        const tasks: SchedulerTask[] = [];

        priorities.forEach((prio) => {
          const task = scheduleCallback(prio, () => {
            doSomethingForSomeTime();
            tasks.push(task);
          });
        });

        flush(20);

        assertTasksOrdering(tasks);
      }));

    });

    describeAsyncAwait(() => {

      it(expectation1, async () => {
        const tasks: SchedulerTask[] = [];

        Priorities.forEach((priority) => {
          const task = scheduleCallback(priority, () => {
            tasks.push(task);
            doSomethingForSomeTime();
          })
        });

        await whenIdle();

        assertTasksOrdering(tasks);
      });

      it(expectation2, async () => {
        const priorities = randomPrioritiesArray();
        const tasks: SchedulerTask[] = [];

        priorities.forEach((prio) => {
          const task = scheduleCallback(prio, () => {
            doSomethingForSomeTime()
            tasks.push(task);
          });
        });

        await whenIdle();

        assertTasksOrdering(tasks);
      });
    });

    Priorities.forEach((priorityLevel) => {

      describePriorityLevel(priorityLevel, () => {

        describeWithoutZone(() => {

          it(expectation3, (done) => {
            const doneCb = () => queueMicrotask(() => {
              expect(log).toEqual([
                ExecutionContextInfo.CurrentTest,
                ExecutionContextInfo.BeforeExecuteTask1,
                ExecutionContextInfo.ScheduledCallback1,
                ExecutionContextInfo.OnExecuteListener1ForTask1,
                ExecutionContextInfo.OnExecuteListener2ForTask1,
                ExecutionContextInfo.InternalOnExecuteListener1ForTask1,
                ExecutionContextInfo.InternalOnExecuteListener2ForTask1,
                ExecutionContextInfo.BeforeExecuteTask2,
                ExecutionContextInfo.ScheduledCallback2,
                ExecutionContextInfo.OnExecuteListener1ForTask2,
                ExecutionContextInfo.OnExecuteListener2ForTask2,
                ExecutionContextInfo.InternalOnExecuteListener1ForTask2,
                ExecutionContextInfo.InternalOnExecuteListener2ForTask2,
                ExecutionContextInfo.Microtask
              ]);
              done();
            });

            const log: string[] = [];
            const task1 = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback1);
            });
            task1.beforeExecute = () => {
              queueMicrotask(() => log.push(ExecutionContextInfo.Microtask));
              log.push(ExecutionContextInfo.BeforeExecuteTask1)
            }
            (task1.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1ForTask1));
            task1.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2ForTask1));
            (task1.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1ForTask1));
            task1.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2ForTask1));

            const task2 = scheduleCallback(priorityLevel, () => {
              doneCb();
              log.push(ExecutionContextInfo.ScheduledCallback2);
            })
            task2.beforeExecute = () => {
              log.push(ExecutionContextInfo.BeforeExecuteTask2);
            }
            (task2.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1ForTask2));
            task2.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2ForTask2));
            (task2.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1ForTask2));
            task2.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2ForTask2));

            log.push(ExecutionContextInfo.CurrentTest);
          })

        });

        describeFakeAsync(() => {

          it(expectation3, fakeAsync(() => {
            const log: string[] = [];
            const task1 = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback1);
            });
            task1.beforeExecute = () => {
              queueMicrotask(() => log.push(ExecutionContextInfo.Microtask));
              log.push(ExecutionContextInfo.BeforeExecuteTask1)
            }
            (task1.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1ForTask1));
            task1.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2ForTask1));
            (task1.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1ForTask1));
            task1.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2ForTask1));

            const task2 = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback2);
            })
            task2.beforeExecute = () => {
              log.push(ExecutionContextInfo.BeforeExecuteTask2);
            }
            (task2.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1ForTask2));
            task2.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2ForTask2));
            (task2.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1ForTask2));
            task2.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2ForTask2));

            log.push(ExecutionContextInfo.CurrentTest);

            flush(20);

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecuteTask1,
              ExecutionContextInfo.ScheduledCallback1,
              ExecutionContextInfo.OnExecuteListener1ForTask1,
              ExecutionContextInfo.OnExecuteListener2ForTask1,
              ExecutionContextInfo.InternalOnExecuteListener1ForTask1,
              ExecutionContextInfo.InternalOnExecuteListener2ForTask1,
              ExecutionContextInfo.BeforeExecuteTask2,
              ExecutionContextInfo.ScheduledCallback2,
              ExecutionContextInfo.OnExecuteListener1ForTask2,
              ExecutionContextInfo.OnExecuteListener2ForTask2,
              ExecutionContextInfo.InternalOnExecuteListener1ForTask2,
              ExecutionContextInfo.InternalOnExecuteListener2ForTask2,
              ExecutionContextInfo.Microtask
            ]);
          }));

        });


        describeAsyncAwait(() => {

          it(expectation3, async () => {
            const log: string[] = [];
            const task1 = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback1);
            });
            task1.beforeExecute = () => {
              queueMicrotask(() => log.push(ExecutionContextInfo.Microtask));
              log.push(ExecutionContextInfo.BeforeExecuteTask1)
            }
            (task1.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1ForTask1));
            task1.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2ForTask1));
            (task1.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1ForTask1));
            task1.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2ForTask1));

            const task2 = scheduleCallback(priorityLevel, () => {
              log.push(ExecutionContextInfo.ScheduledCallback2);
            })
            task2.beforeExecute = () => {
              log.push(ExecutionContextInfo.BeforeExecuteTask2);
            }
            (task2.onExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.OnExecuteListener1ForTask2));
            task2.onExecutedListeners.push(() => log.push(ExecutionContextInfo.OnExecuteListener2ForTask2));
            (task2.internalOnExecutedListeners ??= []).push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener1ForTask2));
            task2.internalOnExecutedListeners.push(() => log.push(ExecutionContextInfo.InternalOnExecuteListener2ForTask2));

            log.push(ExecutionContextInfo.CurrentTest);

            await whenIdle();

            expect(log).toEqual([
              ExecutionContextInfo.CurrentTest,
              ExecutionContextInfo.BeforeExecuteTask1,
              ExecutionContextInfo.ScheduledCallback1,
              ExecutionContextInfo.OnExecuteListener1ForTask1,
              ExecutionContextInfo.OnExecuteListener2ForTask1,
              ExecutionContextInfo.InternalOnExecuteListener1ForTask1,
              ExecutionContextInfo.InternalOnExecuteListener2ForTask1,
              ExecutionContextInfo.BeforeExecuteTask2,
              ExecutionContextInfo.ScheduledCallback2,
              ExecutionContextInfo.OnExecuteListener1ForTask2,
              ExecutionContextInfo.OnExecuteListener2ForTask2,
              ExecutionContextInfo.InternalOnExecuteListener1ForTask2,
              ExecutionContextInfo.InternalOnExecuteListener2ForTask2,
              ExecutionContextInfo.Microtask
            ]);

          });

        });
      });
    });

    describe('Scheduling few tasks and canceling some of them.', () => {

      const expectation = 'Canceling task should not broke algorithm.'

      describeWithoutZone(() => {
        it(expectation, (done) => {
          let counter = 0;
          let cbInvocationCount = 0;
          const tasks: SchedulerTask[] = [];
          const doneCb = () => {
            queueMicrotask(() => {
              expect(cbInvocationCount).toEqual(7);
              expect(tasks.length).toEqual(10);
              done();
            });
          };

          while(counter++ < 10) {
            const isLast = counter === 10;
            const task = scheduleCallback(randomPriority(), () => {
              doSomethingForSomeTime();
              cbInvocationCount++
              if (isLast) { doneCb(); }
            });
            tasks.push(task);
          }
          expect(tasks.length).toEqual(10);
          expect(cbInvocationCount).toEqual(0);
          // Canceling some tasks.
          cancelTask(tasks[2]);
          cancelTask(tasks[5]);
          cancelTask(tasks[8]);
        });
      });

      describeFakeAsync(() => {
        it(expectation, fakeAsync(() => {
          let counter = 0;
          let cbInvocationCount = 0;
          const tasks: SchedulerTask[] = [];

          while(counter++ < 10) {
            const task = scheduleCallback(randomPriority(), () => {
              doSomethingForSomeTime();
              cbInvocationCount++
            });
            tasks.push(task);
          }
          expect(tasks.length).toEqual(10);
          expect(cbInvocationCount).toEqual(0);
          // Canceling some tasks.
          cancelTask(tasks[2]);
          cancelTask(tasks[5]);
          cancelTask(tasks[8]);

          flush(100);

          expect(cbInvocationCount).toEqual(7);
          expect(tasks.length).toEqual(10);

        }));
      });

      describeAsyncAwait(() => {
        it(expectation, async () => {
          let counter = 0;
          let cbInvocationCount = 0;
          const tasks: SchedulerTask[] = [];

          while(counter++ < 10) {
            const task = scheduleCallback(randomPriority(), () => {
              doSomethingForSomeTime();
              cbInvocationCount++
            });
            tasks.push(task);
          }
          expect(tasks.length).toEqual(10);
          expect(cbInvocationCount).toEqual(0);
          // Canceling some tasks.
          cancelTask(tasks[2]);
          cancelTask(tasks[5]);
          cancelTask(tasks[8]);

          await whenIdle();

          expect(cbInvocationCount).toEqual(7);
          expect(tasks.length).toEqual(10);
        });
      });

    });

    const enum TaskContext {
      Task1 = 'Task1',
      Task2 = 'Task2',
      Task3 = 'Task3'
    }

    describe('Scheduling two tasks with the same priorities, where in first callback is scheduled third task with higher priority.', () => {

      const expectation = 'Third task should run earlier then the second one.';

      Priorities.filter((priorityLevel) => priorityLevel !== Priority.Highest).forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          describeWithoutZone(() => {

            it(expectation, (done) => {
              const log: string[] = [];
              const doneCb = () => queueMicrotask(() => {
                expect(log).toEqual([
                  TaskContext.Task1,
                  TaskContext.Task3,
                  TaskContext.Task2
                ]);
                done();
              });

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel - 1, () => {
                  log.push(TaskContext.Task3);
                  doneCb();
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel, () => {
                log.push(TaskContext.Task2);
              });

            });

          });

          describeFakeAsync(() => {

            it(expectation, fakeAsync(() => {
              const log: string[] = [];

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel - 1, () => {
                  log.push(TaskContext.Task3);
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel, () => {
                log.push(TaskContext.Task2);
              });

              flush();


              expect(log).toEqual([
                TaskContext.Task1,
                TaskContext.Task3,
                TaskContext.Task2
              ]);
            }));

          });

          describeAsyncAwait(async () => {

            it(expectation, async () => {
              const log: string[] = [];

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel - 1, () => {
                  log.push(TaskContext.Task3);
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel, () => {
                log.push(TaskContext.Task2);
              });

              await whenIdle();


              expect(log).toEqual([
                TaskContext.Task1,
                TaskContext.Task3,
                TaskContext.Task2
              ]);
            });

          });

        });
      });
    });

    describe('Scheduling two tasks with decremental priorities, where in first callback is scheduled third one with same priority.', () => {

      const expectation = 'Third task should run earlier then the second one.';

      Priorities.filter((priorityLevel) => priorityLevel !== Priority.Lowest).forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          describeWithoutZone(() => {

            it(expectation, (done) => {
              const log: string[] = [];
              const doneCb = () => queueMicrotask(() => {
                expect(log).toEqual([
                  TaskContext.Task1,
                  TaskContext.Task3,
                  TaskContext.Task2
                ])
                done();
              });

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel, () => {
                  log.push(TaskContext.Task3);
                  doneCb();
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel + 1, () => {
                log.push(TaskContext.Task2);
              });

            });

          });

          describeFakeAsync(() => {

            it(expectation, fakeAsync(() => {
              const log: string[] = [];

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel, () => {
                  log.push(TaskContext.Task3);
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel + 1, () => {
                log.push(TaskContext.Task2);
              });

              flush();


              expect(log).toEqual([
                TaskContext.Task1,
                TaskContext.Task3,
                TaskContext.Task2
              ]);
            }));

          });

          describeAsyncAwait(async () => {

            it(expectation, async () => {
              const log: string[] = [];

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel, () => {
                  log.push(TaskContext.Task3);
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel + 1, () => {
                log.push(TaskContext.Task2);
              });

              await whenIdle();


              expect(log).toEqual([
                TaskContext.Task1,
                TaskContext.Task3,
                TaskContext.Task2
              ]);
            });

          });

        });
      });
    });

    describe('Scheduling two tasks with the same priorities, where in first callback is scheduled third one also with same priority.', () => {

      const expectation = 'Third task should run after second one.';

      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          describeWithoutZone(() => {

            it(expectation, (done) => {
              const log: string[] = [];
              const doneCb = () => queueMicrotask(() => {
                expect(log).toEqual([
                  TaskContext.Task1,
                  TaskContext.Task2,
                  TaskContext.Task3,
                ]);
                done();
              });

              scheduleCallback(priorityLevel, () => {

                scheduleCallback(priorityLevel, () => {
                  log.push(TaskContext.Task3);
                  doneCb();
                })

                log.push(TaskContext.Task1);
              })

              scheduleCallback(priorityLevel, () => {
                log.push(TaskContext.Task2);
              });

            });

            describeFakeAsync(() => {
              it(expectation, fakeAsync(() => {
                const log: string[] = [];
                scheduleCallback(priorityLevel, () => {

                  scheduleCallback(priorityLevel, () => {
                    log.push(TaskContext.Task3);
                  })

                  log.push(TaskContext.Task1);
                })

                scheduleCallback(priorityLevel, () => {
                  log.push(TaskContext.Task2);
                });

                flush(10);

                expect(log).toEqual([
                  TaskContext.Task1,
                  TaskContext.Task2,
                  TaskContext.Task3,
                ]);

              }));

            });
            describeAsyncAwait(() => {

              it(expectation, async () => {
                const log: string[] = [];
                scheduleCallback(priorityLevel, () => {

                  scheduleCallback(priorityLevel, () => {
                    log.push(TaskContext.Task3);
                  })

                  log.push(TaskContext.Task1);
                })

                scheduleCallback(priorityLevel, () => {
                  log.push(TaskContext.Task2);
                });

                await whenIdle();

                expect(log).toEqual([
                  TaskContext.Task1,
                  TaskContext.Task2,
                  TaskContext.Task3,
                ]);

              });

            })
          });

        });
      });

    });

  });


  describe('Nesting tasks.', () => {

    const expectation = 'Should all task being executed.'

    describeWithoutZone(() => {

      Priorities.forEach((priority) => {
        describe(`Priority level = ${Priority[priority]}.`, () => {
          it(expectation, (done) => {

            const doneCb = () => {
              queueMicrotask(() => {
                expect(isTaskQueueEmpty()).toBeTrue();
                done();
              })
            };

            for (let i = 0; i < 3; i++) {
              scheduleCallback(priority, () => {
                doSomethingForTime(getRandomPositiveInteger(5, 15));

                for (let j = 0; j < 3; j++) {
                  scheduleCallback(priority, () => {
                    doSomethingForTime(getRandomPositiveInteger(5, 15));

                    for (let k = 0; k < 3; k++) {
                      scheduleCallback(priority, () => {
                        doSomethingForTime(getRandomPositiveInteger(5, 15));

                        if (i == 2 && j == 2 && k == 2) {
                          doneCb()
                        }
                      });
                    }
                  })
                }
              })
            }
          });
        });
      });
    });

    describeFakeAsync(() => {
      Priorities.forEach((priority) => {
        describe(`Priority level = ${Priority[priority]}.`, () => {
          it(expectation, (fakeAsync(() => {
            let scheduleCount = 0 // scheduleCallback(Prio, cb) invocation count

            while (scheduleCount++ < 3) {
              scheduleCallback(priority, () => {
                doSomethingForTime(getRandomPositiveInteger(5, 15));

                let _scheduleCount = 0
                while(_scheduleCount++ < 3) {
                  scheduleCallback(priority, () => {
                    doSomethingForTime(getRandomPositiveInteger(5, 15));

                    let __scheduleCount = 0
                    while(__scheduleCount++ < 3) {
                      scheduleCallback(priority, () => {
                        doSomethingForTime(getRandomPositiveInteger(5, 15));

                      });
                    }

                  });
                }


              });
            }

            flush(100)
            expect(isTaskQueueEmpty()).toBeTrue();
          })));
        });
      });
    });

    describeAsyncAwait(() => {
      Priorities.forEach((priority) => {
        describe(`Priority level = ${Priority[priority]}.`, () => {
          it(expectation, (async () => {
            let scheduleCount = 0 // scheduleCallback(Prio, cb) invocation count

            while (scheduleCount++ < 3) {
              scheduleCallback(priority, () => {
                doSomethingForTime(getRandomPositiveInteger(5, 15));

                let _scheduleCount = 0
                while(_scheduleCount++ < 3) {
                  scheduleCallback(priority, () => {
                    doSomethingForTime(getRandomPositiveInteger(5, 15));

                    let __scheduleCount = 0
                    while(__scheduleCount++ < 3) {
                      scheduleCallback(priority, () => {
                        doSomethingForTime(getRandomPositiveInteger(5, 15));

                      });
                    }

                  });
                }


              });
            }

            await whenIdle();

            expect(isTaskQueueEmpty()).toBeTrue()
          }));
        });
      });
    });
  });

  describe('Adding extra work during task execution.', () => {

    const expectedTaskExecutedLod = [

      'First callback runs.',
      'First added work to first cb run.',
      'Second added work to first cb run.',
      'Third added work to first cb run.',
      'Fourth added work to first cb run.',

      'Second callback runs.',
      'First added work to second cb run.',
      'Second added work to second cb run.',
      'Third added work to second cb run.',
      'Fourth added work to second cb run.',

      'Third callback runs.',
      'First added work to third cb run.',
      'Second added work to third cb run.',
      'Third added work to third cb run.',
      'Fourth added work to third cb run.',

    ]

    const expectation = 'Added work should run right after executed callback.'

    Priorities.forEach((prio) => {

      describe(`Priority level = ${Priority[prio]}`, () => {

        describeWithoutZone(() => {
          it(expectation, (done) => {
            const taskExecutionLog: string[] = [];
            const doneCb = () => queueMicrotask(() => {
              expect(taskExecutionLog.length).toEqual(expectedTaskExecutedLod.length);
              for (let i = 0; i < taskExecutionLog.length; i++) {
                expect(taskExecutionLog[i]).toEqual(expectedTaskExecutedLod[i]);
              }
              done();
            });


            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to first cb run.');
                });

                taskExecutionLog.push('First added work to first cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to first cb run.');
                });

                taskExecutionLog.push('Second added work to first cb run.');
              });

              taskExecutionLog.push('First callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to second cb run.');
                });

                taskExecutionLog.push('First added work to second cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to second cb run.');
                });

                taskExecutionLog.push('Second added work to second cb run.');
              });

              taskExecutionLog.push('Second callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to third cb run.');
                });

                taskExecutionLog.push('First added work to third cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to third cb run.');
                });

                taskExecutionLog.push('Second added work to third cb run.');
              });

              taskExecutionLog.push('Third callback runs.');

              doneCb();
            });
          });
        });

        describeFakeAsync(() => {
          it(expectation, fakeAsync(() => {
            const taskExecutionLog: string[] = [];

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to first cb run.');
                });

                taskExecutionLog.push('First added work to first cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to first cb run.');
                });

                taskExecutionLog.push('Second added work to first cb run.');
              });

              taskExecutionLog.push('First callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to second cb run.');
                });

                taskExecutionLog.push('First added work to second cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to second cb run.');
                });

                taskExecutionLog.push('Second added work to second cb run.');
              });

              taskExecutionLog.push('Second callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to third cb run.');
                });

                taskExecutionLog.push('First added work to third cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to third cb run.');
                });

                taskExecutionLog.push('Second added work to third cb run.');
              });

              taskExecutionLog.push('Third callback runs.');

            });

            flush(100);

            expect(taskExecutionLog.length).toEqual(expectedTaskExecutedLod.length);
            for (let i = 0; i < taskExecutionLog.length; i++) {
              expect(taskExecutionLog[i]).toEqual(expectedTaskExecutedLod[i]);
            }
          }));
        });

        describeAsyncAwait(() => {
          it(expectation, async () => {
            const taskExecutionLog: string[] = [];

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to first cb run.');
                });

                taskExecutionLog.push('First added work to first cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to first cb run.');
                });

                taskExecutionLog.push('Second added work to first cb run.');
              });

              taskExecutionLog.push('First callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to second cb run.');
                });

                taskExecutionLog.push('First added work to second cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to second cb run.');
                });

                taskExecutionLog.push('Second added work to second cb run.');
              });

              taskExecutionLog.push('Second callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Third added work to third cb run.');
                });

                taskExecutionLog.push('First added work to third cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionLog.push('Fourth added work to third cb run.');
                });

                taskExecutionLog.push('Second added work to third cb run.');
              });

              taskExecutionLog.push('Third callback runs.');

            });

            await whenIdle();

            expect(taskExecutionLog.length).toEqual(expectedTaskExecutedLod.length);
            for (let i = 0; i < taskExecutionLog.length; i++) {
              expect(taskExecutionLog[i]).toEqual(expectedTaskExecutedLod[i]);
            }
          });
        });
      });
    });
  });

});

describe('testing whenIdle() function.', () => {

  beforeAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 27_000
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 5_000
  })

  it('Should not be any task in queue when state is idle', async () => {
      let count = 0
      while(count++ < 3) {
        const priorities1 = randomPrioritiesArray(40, 80);
        const priorities2 = randomPrioritiesArray(40, 80);
        const priorities3 = randomPrioritiesArray(40, 80);

        expect(isTaskQueueEmpty()).toBeTrue();

        for (const prio of priorities1) {
          scheduleCallback(prio, () => {
            doSomethingForTime(getRandomPositiveInteger(0, 0.3));
            for (const prio of priorities2) {
              scheduleCallback(prio, () => {
                doSomethingForTime(getRandomPositiveInteger(0, 0.3));
                for (const prio of priorities3) {
                  scheduleCallback(prio, () => {
                    doSomethingForTime(getRandomPositiveInteger(0, 0.3));
                  });
                }
              });
            }
          });
        }

        expect(isTaskQueueEmpty()).toBeFalse();
        await whenIdle();
      }

      expect(isTaskQueueEmpty()).toBeTrue();
      await whenIdle();
      expect(isTaskQueueEmpty()).toBeTrue();
  });
});

describe('Testing onIdle() callback.', () => {

  function onIdleToPromise(cb: Function): Promise<void> {
    return new Promise((resolve) => {
      setOnIdle(() => {
        cb();
        resolve();
      });
    });
  }

  afterAll(() => {
    setOnIdle(null);
  });

  it('onIdle() should be invoked after whenIdle() promise resolves.', async () => {
    let onIdleCounter = 0;

    const onIdleCb = () => onIdleCounter++;
    let onIdlePromise = onIdleToPromise(onIdleCb);

    //Fist step.
    let priorities = randomPrioritiesArray();

    for (const prio of priorities) {
      scheduleCallback(prio, () => {
        doSomethingForSomeTime();
      });
    }

    await whenIdle()
    await onIdlePromise;
    expect(onIdleCounter).toEqual(1);

    //Second step.
    priorities = randomPrioritiesArray();

    for (const prio of priorities) {
      scheduleCallback(prio, () => {
        doSomethingForSomeTime();
      });
    }

    await whenIdle()
    await onIdlePromise;
    expect(onIdleCounter).toEqual(2);

    //Third step.
    priorities = randomPrioritiesArray();

    for (const prio of priorities) {
      scheduleCallback(prio, () => {
        doSomethingForSomeTime();
      });
    }

    await whenIdle()
    await onIdlePromise;
    expect(onIdleCounter).toEqual(3);
  })
});
