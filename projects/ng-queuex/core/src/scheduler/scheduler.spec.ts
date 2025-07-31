import { fakeAsync, flush } from "@angular/core/testing";
import { onTaskExecuted, getQueueCount, isTaskQueueEmpty, scheduleCallback, setOnIdle, whenIdle } from "./scheduler";
import { Priority, SchedulerTask, TaskStatus } from "./scheduler_utils";
import { describeAsyncAwait, describeFakeAsync, describeWithoutZone, doSomethingForSomeTime, doSomethingForTime, getRandomPositiveInteger, randomPrioritiesArray, randomPriority } from "./scheduler_test_utils";

const Priorities = [Priority.Lowest, Priority.Low, Priority.Normal, Priority.High, Priority.Highest];

function cancelTask(task: SchedulerTask) {
  task.callback = null;
  task.status = TaskStatus.Aborted;
}

describe('Test utilities functions', () => {
  it('Should be array if priorities', () => {
    const priorities = randomPrioritiesArray();
    priorities.forEach((prio) => {
      expect(Priorities.includes(prio)).toBeTrue()
    });

    expect(priorities.length).toBeGreaterThanOrEqual(80);
  });
});

describe('Scheduler.', () => {

  describe('Scheduling one task.', () => {
    Priorities.forEach((priorityLevel) => {

      describe(`Priority level = ${Priority[priorityLevel]}`, () => {

        describeWithoutZone( () => {
          it('Scheduled callback is executed.', (done) => {

            const doneCb = () => {
              queueMicrotask(() => {
                expect(info[0]).toEqual('Executing current context');
                expect(info[1]).toEqual('Scheduled callback executed');
                done();
              });
            }

            const info: string[] = [];

            scheduleCallback(Priority.Normal, () => {
              doSomethingForSomeTime();
              info.push('Scheduled callback executed');
              doneCb();
            });

            info.push('Executing current context');
            expect(info.length).toEqual(1);

          });
        });

        describeFakeAsync(() => {
          it('Scheduled callback is executed.', fakeAsync(() => {

            const info: string[] = [];

            scheduleCallback(Priority.Normal, () => {
              doSomethingForSomeTime();
              info.push('Scheduled callback executed');
            });

            info.push('Executing current context');
            expect(info.length).toEqual(1);

            flush(200)

            expect(info[0]).toEqual('Executing current context');
            expect(info[1]).toEqual('Scheduled callback executed');
          }));

        });
      });

      describeAsyncAwait(() => {
        it('Scheduled callback is executed.', async () => {

            const info: string[] = [];

            scheduleCallback(Priority.Normal, () => {
              info.push('Scheduled callback executed');
            });

            info.push('Executing current context');
            expect(info.length).toEqual(1);

            await whenIdle();

            expect(info[0]).toEqual('Executing current context');
            expect(info[1]).toEqual('Scheduled callback executed');
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

  function checkTasksOrdering(tasks: SchedulerTask[], skipCheckingPrioLevels: boolean = false) {

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

    const expectation = 'Should execute callbacks in correct order.'

    beforeAll(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 30_000;
    })
    afterAll(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 5_000;
    })

    describeWithoutZone(() => {
      it(expectation, (done) => {
        const priorities = randomPrioritiesArray();
        const tasks: SchedulerTask[] = [];

        const doneCb = () => {
          checkTasksOrdering(tasks);
          queueMicrotask(() => done());
        }

        priorities.forEach((prio, index) => {
          const task = scheduleCallback(prio, () => {
            tasks.push(task);
            doSomethingForSomeTime()
            if (index === priorities.length - 1) {
              doneCb()
            }
          });
        });
      });
    });

    describeFakeAsync(() => {
      it(expectation, fakeAsync(() => {
        const priorities = randomPrioritiesArray();
        const tasks: SchedulerTask[] = [];

        priorities.forEach((prio) => {
          const task = scheduleCallback(prio, () => {
            doSomethingForSomeTime()
            tasks.push(task);
          });
        });

        flush(200);

        checkTasksOrdering(tasks);
      }));
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

  describe('Nesting tasks.', () => {

    const expectation = 'Should all task being executed.'

    describeWithoutZone(() => {

      Priorities.forEach((priority) => {
        describe(`Priority level = ${Priority[priority]}.`, () => {
          it(expectation, (done) => {
            let scheduleCount = 0 // scheduleCallback(Prio, cb) invocation count

            const doneCb = () => {
              expect(getQueueCount()).toEqual(1)
              queueMicrotask(() => {
                expect(isTaskQueueEmpty()).toBeTrue;
                done();
              })
            };

            while (scheduleCount++ < 3) {
              const isLast = scheduleCount === 3
              scheduleCallback(priority, () => {
                doSomethingForTime(getRandomPositiveInteger(5, 15));

                let _scheduleCount = 0
                while(_scheduleCount++ < 3) {
                  const _isLast = _scheduleCount === 3
                  scheduleCallback(priority, () => {
                    doSomethingForTime(getRandomPositiveInteger(5, 15));

                    let __scheduleCount = 0
                    while(__scheduleCount++ < 3) {
                      const __isLast = __scheduleCount === 3
                      scheduleCallback(priority, () => {
                        doSomethingForTime(getRandomPositiveInteger(5, 15));
                        if (__isLast && _isLast && isLast) {
                          doneCb()
                        }
                      });
                    }

                  });
                }


              });
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
            expect(getQueueCount()).toEqual(0);
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

    const expectedTaskExecutionInfo = [

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
            const taskExecutionInfo: string[] = [];
            const doneCb = () => queueMicrotask(() => {
              expect(taskExecutionInfo.length).toEqual(expectedTaskExecutionInfo.length);
              for (let i = 0; i < taskExecutionInfo.length; i++) {
                expect(taskExecutionInfo[i]).toEqual(expectedTaskExecutionInfo[i]);
              }
              done();
            });


            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to first cb run.');
                });

                taskExecutionInfo.push('First added work to first cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to first cb run.');
                });

                taskExecutionInfo.push('Second added work to first cb run.');
              });

              taskExecutionInfo.push('First callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to second cb run.');
                });

                taskExecutionInfo.push('First added work to second cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to second cb run.');
                });

                taskExecutionInfo.push('Second added work to second cb run.');
              });

              taskExecutionInfo.push('Second callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to third cb run.');
                });

                taskExecutionInfo.push('First added work to third cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to third cb run.');
                });

                taskExecutionInfo.push('Second added work to third cb run.');
              });

              taskExecutionInfo.push('Third callback runs.');

              doneCb();
            });
          });
        });

        describeFakeAsync(() => {
          it(expectation, fakeAsync(() => {
            const taskExecutionInfo: string[] = [];

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to first cb run.');
                });

                taskExecutionInfo.push('First added work to first cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to first cb run.');
                });

                taskExecutionInfo.push('Second added work to first cb run.');
              });

              taskExecutionInfo.push('First callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to second cb run.');
                });

                taskExecutionInfo.push('First added work to second cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to second cb run.');
                });

                taskExecutionInfo.push('Second added work to second cb run.');
              });

              taskExecutionInfo.push('Second callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to third cb run.');
                });

                taskExecutionInfo.push('First added work to third cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to third cb run.');
                });

                taskExecutionInfo.push('Second added work to third cb run.');
              });

              taskExecutionInfo.push('Third callback runs.');

            });

            flush(100);

            expect(taskExecutionInfo.length).toEqual(expectedTaskExecutionInfo.length);
            for (let i = 0; i < taskExecutionInfo.length; i++) {
              expect(taskExecutionInfo[i]).toEqual(expectedTaskExecutionInfo[i]);
            }
          }));
        });

        describeAsyncAwait(() => {
          it(expectation, async () => {
            const taskExecutionInfo: string[] = [];

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to first cb run.');
                });

                taskExecutionInfo.push('First added work to first cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to first cb run.');
                });

                taskExecutionInfo.push('Second added work to first cb run.');
              });

              taskExecutionInfo.push('First callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to second cb run.');
                });

                taskExecutionInfo.push('First added work to second cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to second cb run.');
                });

                taskExecutionInfo.push('Second added work to second cb run.');
              });

              taskExecutionInfo.push('Second callback runs.');
            });

            scheduleCallback(prio, () => {

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Third added work to third cb run.');
                });

                taskExecutionInfo.push('First added work to third cb run.');
              });

              onTaskExecuted(() => {
                onTaskExecuted(() => {
                  taskExecutionInfo.push('Fourth added work to third cb run.');
                });

                taskExecutionInfo.push('Second added work to third cb run.');
              });

              taskExecutionInfo.push('Third callback runs.');

            });

            await whenIdle();

            expect(taskExecutionInfo.length).toEqual(expectedTaskExecutionInfo.length);
            for (let i = 0; i < taskExecutionInfo.length; i++) {
              expect(taskExecutionInfo[i]).toEqual(expectedTaskExecutionInfo[i]);
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
