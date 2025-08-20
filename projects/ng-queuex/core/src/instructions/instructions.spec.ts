import { ChangeDetectorRef } from "@angular/core";
import { AbortTaskFunction, detectChanges, detectChangesSync, isInConcurrentTaskContext, provideNgQueuexIntegration, scheduleChangeDetection, scheduleTask } from "../core";
import { noopFn, Priority, SchedulerTask, TaskStatus } from "../scheduler/scheduler_utils";
import { getCurrentTask, whenIdle, getTaskAt, isTaskQueueEmpty, getQueueLength } from "../scheduler/scheduler";
import { describePriorityLevel, doSomethingForSomeTime, randomPrioritiesArray, randomPriority } from "../scheduler/scheduler_test_utils";
import { TestBed } from "@angular/core/testing";
import { completeIntegrationForTest, Integrator } from "../environment/environment";

class FakeViewRef implements ChangeDetectorRef {

  public _lView = {};

  public detectChangesInvocationCount = 0
  public lastTaskPriority: Priority | -1 = -1

  markForCheck(): void {
    throw new Error('Not supported!');
  }
  detach(): void {
    throw new Error('Not supported!');
  }
  detectChanges(): void {
    this.detectChangesInvocationCount++
    if (isInConcurrentTaskContext()) {
      this.lastTaskPriority = getCurrentTask()!.priorityLevel;
    }
  }
  checkNoChanges(): void {
    throw new Error('Not supported!');
  }
  reattach(): void {
    throw new Error('Not supported!');
  }

}

//Ordered from Highest to Lowest.
const Priorities = [
  Priority.Highest,
  Priority.High,
  Priority.Normal,
  Priority.Low,
  Priority.Lowest
]

function shuffleArray<T>(array: T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function assertAbortedTask(task: SchedulerTask): void {
  expect(task.callback).toBeNull();
  expect(task.status).toBe(TaskStatus.Aborted);
}

function assertPendingTask(task: SchedulerTask): void {
  expect(task.callback !== null).toBeTrue();
  expect(task.status).toBe(TaskStatus.Pending);
}

function assertExecutingTask(task: SchedulerTask): void {
  expect(task.callback === null).toBeTrue();
  expect(task.status).toBe(TaskStatus.Executing);
}

describe('Testing scheduleTask function.', () => {

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()],
    }).runInInjectionContext(() => {
      completeIntegrationForTest();
    })
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (Integrator.instance) {
      throw new Error('Integrator not disposed!');
    }
  });

  it('Should default priority be normal.', async () => {
    let defaultPriority = -1;

    scheduleTask(() => {
      defaultPriority = getCurrentTask()!.priorityLevel;
    })

    await whenIdle();
    expect(defaultPriority).toBe(Priority.Normal);
  })

  it('Should invoke callbacks in correct order.', async () => {
    const shuffledPriorities = shuffleArray(Priorities);
    let executedPriorities: Priority[] = [];

    for (const prio of shuffledPriorities) {
      scheduleTask(() => {
        doSomethingForSomeTime();
        executedPriorities.push(getCurrentTask()!.priorityLevel);
      }, prio);
    }

    await whenIdle();
    expect(executedPriorities.length).toEqual(shuffledPriorities.length);
    for (let i = 0; i < executedPriorities.length; i++) {
      expect(executedPriorities[i]).toEqual(Priorities[i]);
    }

    const randomArrayOfPriorities = randomPrioritiesArray();
    const sortedArrayOfPriorities = randomArrayOfPriorities.slice().sort((a, b) => a - b);
    executedPriorities = [];

    for (const prio of randomArrayOfPriorities) {
      scheduleTask(() => {
        doSomethingForSomeTime();
        executedPriorities.push(getCurrentTask()!.priorityLevel);
      }, prio);
    }

    await whenIdle();

    expect(executedPriorities.length).toEqual(randomArrayOfPriorities.length);

    for (let i = 0; i < executedPriorities.length; i++) {
      expect(executedPriorities[i]).toEqual(sortedArrayOfPriorities[i]);
    }
  });

  Priorities.forEach((prio) => {
    describePriorityLevel(prio, () => {
      it('Aborted task should not execute scheduled callbacks.', async () => {
        let executionCount = 0;
        let abortCbExecutionCount = 0;
        const aborters: AbortTaskFunction[] = [];

        expect(isTaskQueueEmpty()).toBeTrue();


        for (let i = 0; i < 10; i++) {
          const abortFn = scheduleTask(() => {
            doSomethingForSomeTime();
            executionCount++;
          }, prio);
          aborters.push(abortFn);
        }

        aborters[2](() => abortCbExecutionCount++);
        aborters[5](() => abortCbExecutionCount++);
        aborters[8](() => abortCbExecutionCount++);

        expect(abortCbExecutionCount).toBe(0);

        aborters[2]();
        aborters[5]();
        aborters[8]();

        expect(abortCbExecutionCount).toBe(3);
        expect(getQueueLength()).toEqual(10);

        assertAbortedTask(getTaskAt(2));
        assertAbortedTask(getTaskAt(5));
        assertAbortedTask(getTaskAt(8));

        await whenIdle();

        expect(executionCount).toEqual(7);
      });
    });
  });

});

describe('Testing scheduleChangeDetection() function.', () => {

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()],
    }).runInInjectionContext(() => {
      completeIntegrationForTest();
    })
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (Integrator.instance) {
      throw new Error('Integrator not disposed!')
    }
  });

  it('Should default priority be normal', async () => {
    let defaultPriority = -1;
    scheduleChangeDetection(() => defaultPriority = getCurrentTask()!.priorityLevel);
    await whenIdle();
    expect(defaultPriority).toBe(Priority.Normal);
  })

  it('Should invoke callbacks in correct order.', async () => {
    const shuffledPriorities = shuffleArray(Priorities);
    let executedPriorities: Priority[] = [];

    for (const prio of shuffledPriorities) {
      scheduleChangeDetection(() => {
        doSomethingForSomeTime();
        executedPriorities.push(getCurrentTask()!.priorityLevel)
      }, prio);
    }

    await whenIdle();
    expect(executedPriorities.length).toEqual(shuffledPriorities.length)
    for (let i = 0; i < executedPriorities.length; i++) {
      expect(executedPriorities[i]).toEqual(Priorities[i])
    }

    const randomArrayOfPriorities = randomPrioritiesArray();
    const sortedArrayOfPriorities = randomArrayOfPriorities.slice().sort((a, b) => a - b);
    executedPriorities = []

    for (const prio of randomArrayOfPriorities) {
      scheduleChangeDetection(() => {
        doSomethingForSomeTime();
        executedPriorities.push(getCurrentTask()!.priorityLevel)
      }, prio);
    }

    await whenIdle();

    expect(executedPriorities.length).toEqual(randomArrayOfPriorities.length);

    for (let i = 0; i < executedPriorities.length; i++) {
      expect(executedPriorities[i]).toEqual(sortedArrayOfPriorities[i]);
    }
  });

  Priorities.forEach((prio) => {
    describePriorityLevel(prio, () => {
      it('Aborted task should not execute scheduled callbacks.', async () => {
        let executionCount = 0;
        let abortCbExecutionCount = 0;

        const aborters: AbortTaskFunction[] = [];

        expect(isTaskQueueEmpty()).toBeTrue();

        for (let i = 0; i < 10; i++) {
          const abortFn = scheduleChangeDetection(() => {
            doSomethingForSomeTime();
            executionCount++;
          }, prio);
          aborters.push(abortFn);
        }

        aborters[2](() => abortCbExecutionCount++);
        aborters[5](() => abortCbExecutionCount++);
        aborters[8](() => abortCbExecutionCount++);

        expect(abortCbExecutionCount).toBe(0);

        aborters[2]();
        aborters[5]();
        aborters[8]();

        expect(abortCbExecutionCount).toBe(3);
        expect(getQueueLength()).toEqual(10);

        assertAbortedTask(getTaskAt(2));
        assertAbortedTask(getTaskAt(5));
        assertAbortedTask(getTaskAt(8));

        await whenIdle();

        expect(executionCount).toEqual(7);
      });

      it('Should coalesce task with provided cdRef to be used.', () => {
        let executionCount = 0;
        const fakeView = new FakeViewRef();
        const aborters: (AbortTaskFunction | null)[] = [];

        expect(isTaskQueueEmpty()).toBeTrue();

        for (let i = 0; i < 10; i++) {
          const abortFn = scheduleChangeDetection(() => {
            doSomethingForSomeTime();
            executionCount++;
          }, prio, fakeView);
          aborters.push(abortFn);
        }

        expect(typeof aborters[0]).toBe('function');
        expect(aborters.slice(1)).toEqual([...Array(9)].map(() => null))

      })
    });
  });

  describe('Using detectChangesSync() function in callbacks body.', () => {

    Priorities.forEach((prio) => {
      describe(`Priority level = ${prio}.`, () => {
        it('Should coalesce and trigger cdRef.detectChanges() once.', async () => {
          const viewRef = new FakeViewRef();
          const results: boolean[] = []

          scheduleChangeDetection(() => {
            results.push(detectChangesSync(viewRef));
            results.push(detectChangesSync(viewRef));//Dismissed
            results.push(detectChangesSync(viewRef));//Dismissed
            results.push(detectChangesSync(viewRef));//Dismissed
          }, prio);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(viewRef.lastTaskPriority).toEqual(prio);
          expect(results).toEqual([true, false, false, false]);
        });
      });
    });

    describe('Combining with detectChanges() function.', () => {

      Priorities.forEach((prio) => {
        describe(`Priority level = ${prio}`,  () => {

          it('Should coalesce and trigger cdRef.detectChanges() once.', async () => {
            const viewRef = new FakeViewRef();
            let sync = false;

            scheduleChangeDetection(() => {
              let abortTask1CbInvoked = false
              const abortTask1 = detectChanges(viewRef, randomPriority()); //Will be aborted.

              expect(typeof abortTask1).toBe('function');
              abortTask1!(() => { abortTask1CbInvoked = true; });

              const currentTask = getCurrentTask();
              let nextTask: SchedulerTask;

              if (currentTask === getTaskAt(0)) {
                nextTask = getTaskAt(1);
              } else {
                nextTask = getTaskAt(0);
              }

              assertPendingTask(nextTask);
              expect(abortTask1CbInvoked).toBeFalse();

              sync = detectChangesSync(viewRef) //Will abort above.

              assertAbortedTask(nextTask);
              expect(abortTask1CbInvoked).toBeTrue();

              const currentQueueLength = getQueueLength();

              const abortTask2 = detectChanges(viewRef, randomPriority()) //Dismissed.

              expect(abortTask2).toBeNull();
              expect(getQueueLength()).toEqual(currentQueueLength);
            }, prio);

            await whenIdle();

            expect(viewRef.detectChangesInvocationCount).toEqual(1);
            expect(viewRef.lastTaskPriority).toEqual(prio);
            expect(sync).toBeTrue();
          });

          it('Should coalesce and trigger cdRef.detectChanges() once, with provided viewRef.', async () => {
            const viewRef = new FakeViewRef();
            let sync = false;

            scheduleChangeDetection(() => {
              const currentQueueLength = getQueueLength();
              const abortTask1 = detectChanges(viewRef, randomPriority()) //Dismissed.
              expect(getQueueLength()).toEqual(currentQueueLength);
              expect(abortTask1).toBeNull();

              sync = detectChangesSync(viewRef);

              const abortTask2 = detectChanges(viewRef, randomPriority()) //Dismissed.
              expect(getQueueLength()).toEqual(currentQueueLength);
              expect(abortTask2).toBeNull();
            }, prio, viewRef);

            await whenIdle();

            expect(viewRef.detectChangesInvocationCount).toEqual(1);
            expect(viewRef.lastTaskPriority).toEqual(prio);
            expect(sync).toBeTrue();
          });
        });
      });

    });
  });

  describe('Using detectChanges() function in callbacks body.', () => {
    Priorities.forEach((prio) => {
      describe(`Priority level = ${Priority[prio]}`, () => {
        it('Should coalesce and trigger cdRef.detectChanges() once.', async () => {
          const viewRef = new FakeViewRef();
          const detectChangesPriority = randomPriority();

          scheduleChangeDetection(() => {
            const lastQueueLength = getQueueLength();
            const abortTask1 = detectChanges(viewRef, detectChangesPriority);

            expect(getQueueLength()).toEqual(lastQueueLength + 1);
            expect(typeof abortTask1).toBe('function');

            const abortTask2 = detectChanges(viewRef, detectChangesPriority);//Dismissed
            const abortTask3 = detectChanges(viewRef, detectChangesPriority);//Dismissed

            expect(getQueueLength()).toEqual(lastQueueLength + 1);
            expect(abortTask2).toBeNull();
            expect(abortTask3).toBeNull();
          }, prio);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(viewRef.lastTaskPriority).toEqual(detectChangesPriority);
        });
      });
    });
  });

  describe('Using detectChanges() and scheduleChangeDetection() next to each other, where detectChangesSync() is used callbacks body.', () => {
    Priorities.forEach((prio) => {
      describe(`Priority level = ${prio}`, () => {
        it('Should coalesce when first scheduleChangeDetection() function was used.', async () => {
          const viewRef = new FakeViewRef();
          let sync = false;
          let abortCbInvoked = false;

          expect(getQueueLength()).toEqual(0);

          scheduleChangeDetection(() => {
            assertExecutingTask(getTaskAt(0));
            assertPendingTask(getTaskAt(1));
            expect(abortCbInvoked).toBeFalse();
            sync = detectChangesSync(viewRef); //Will abort below.
            expect(abortCbInvoked).toBeTrue();
            assertAbortedTask(getTaskAt(1));
          }, prio);

          const abortTask = detectChanges(viewRef, prio); //Will be aborted;

          expect(getQueueLength()).toEqual(2);
          expect(typeof abortTask).toBe('function');
          abortTask!(() => abortCbInvoked = true);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(sync).toBeTrue();
        });

        it('Should not coalesce when scheduleChangeDetection() was used after detectChanges().', async () => {
          const viewRef = new FakeViewRef();
          let sync = false
          const abortTask1 = detectChanges(viewRef, prio);

          const abortTask2 = scheduleChangeDetection(() => {
            sync = detectChangesSync(viewRef);
          }, prio);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(2);
          expect(sync).toBeTrue();
          expect(typeof abortTask1).toBe('function');
          expect(typeof abortTask2).toBe('function');
        });

        it('Should coalesce when scheduleChangeDetection() was used after detectChanges(), if cdRef was provided as a third argument.', async () => {
          const viewRef = new FakeViewRef();
          let sync = false

          const abortTask1 = detectChanges(viewRef, prio);

          const abortTask2 = scheduleChangeDetection(() => {
            sync = detectChangesSync(viewRef);
          }, prio, viewRef);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(sync).toBeFalse();
          expect(typeof abortTask1).toBe('function');
          expect(abortTask2).toBeNull();
        });
      });
    });
  });
});

describe('Testing detectChanges() function', () => {

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()],
    }).runInInjectionContext(() => {
      completeIntegrationForTest();
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (Integrator.instance) {
      throw new Error('Integrator not disposed!')
    }
  });

  it('Default priority should be normal.', async () => {
    const viewRef = new FakeViewRef();
    detectChanges(viewRef);
    await whenIdle();
    expect(viewRef.lastTaskPriority).toBe(Priority.Normal);
  })

  Priorities.forEach((prio => {
    it('Should coalesce change detection.', async () => {
      const viewRef = new FakeViewRef();
      const aborters:(AbortTaskFunction | null)[] = [];

      aborters.push(detectChanges(viewRef, prio)); //This call should schedule cdRef.detectChanges invocation.
      aborters.push(detectChanges(viewRef, prio)); //Dismissed
      aborters.push(detectChanges(viewRef, prio)); //Dismissed
      aborters.push(detectChanges(viewRef, prio)); //Dismissed
      aborters.push(detectChanges(viewRef, prio)); //Dismissed

      expect(getQueueLength()).toEqual(1);
      expect(viewRef.detectChangesInvocationCount).toEqual(0);
      expect(viewRef.lastTaskPriority).toEqual(-1);
      expect(typeof aborters[0]).toBe('function');
      expect(aborters.slice(1)).toEqual([...Array(4)].map(() => null));

      await whenIdle();

      expect(viewRef.detectChangesInvocationCount).toEqual(1);
      expect(viewRef.lastTaskPriority).toEqual(prio);

    });
  }));

  Priorities.filter((prio) => prio !== Priority.Highest).forEach((prio) => {
    it('Should coalesce change detection and promote higher priority.', async () => {
      const viewRef = new FakeViewRef();
      const aborters:(AbortTaskFunction | null)[] = [];
      let abortCbInvoked = false;

      aborters.push(detectChanges(viewRef, prio)); //This call should schedule cdRef.detectChanges invocation, but almost immediately be aborted.
      const abortFirstTask = aborters[0];
      expect(typeof abortFirstTask).toBe('function');
      abortFirstTask!(() => abortCbInvoked = true);

      expect(getQueueLength()).toEqual(1);

      aborters.push(detectChanges(viewRef, prio)); //Dismissed
      expect(abortCbInvoked).toBeFalse();
      aborters.push((detectChanges(viewRef, prio - 1  as any))); //This call should schedule cdRef.detectChanges invocation and abort first call.
      expect(abortCbInvoked).toBeTrue();
      aborters.push(detectChanges(viewRef, prio)); //Dismissed
      aborters.push(detectChanges(viewRef, prio)); //Dismissed

      expect(getQueueLength()).toEqual(2);
      assertAbortedTask(getTaskAt(1));
      aborters.forEach((abortFn, index) => {
        if (index === 0 || index === 2) {
          expect(typeof abortFn).toBe('function');
        } else {
          expect(abortFn).toBeNull();
        }
      })

      expect(viewRef.detectChangesInvocationCount).toEqual(0);
      expect(viewRef.lastTaskPriority).toEqual(-1);

      await whenIdle();

      expect(viewRef.detectChangesInvocationCount).toEqual(1);
      expect(viewRef.lastTaskPriority).toEqual(prio - 1);

    });
  });

});

describe('Testing abort callback.', () => {

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()],
    }).runInInjectionContext(() => {
      completeIntegrationForTest();
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (Integrator.instance) {
      throw new Error('Integrator not disposed!')
    }
  });

  describe('Using scheduleTask() function.', () => {

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {

        it('Abort callback should be invoked.', async () => {
          let abortCbInvoked = false;

          const abortTask = scheduleTask(() => {}, priorityLevel);
          abortTask(() => abortCbInvoked = true);

          expect(abortCbInvoked).toBeFalse();
          abortTask();
          expect(abortCbInvoked).toBeTrue();

          await whenIdle();
        });

        it('Abort callback should not be invoked.', async () => {
          let abortCbInvoked = false;

          const abortTask = scheduleTask(() => {}, priorityLevel);
          abortTask(() => abortCbInvoked = true);
          abortTask(null)

          expect(abortCbInvoked).toBeFalse();
          abortTask();
          expect(abortCbInvoked).toBeFalse();

          await whenIdle();
        });

      });
    });

  });

  describe('Using scheduleChangeDetection() function.', () => {

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {

        it('Abort callback should be invoked.', async () => {
          let abortCbInvoked = false;

          const abortTask = scheduleChangeDetection(() => {}, priorityLevel);
          abortTask(() => abortCbInvoked = true);

          expect(abortCbInvoked).toBeFalse();
          abortTask();
          expect(abortCbInvoked).toBeTrue();

          await whenIdle();
        });

        it('Abort callback should not be invoked.', async () => {
          let abortCbInvoked = false;

          const abortTask = scheduleChangeDetection(() => {}, priorityLevel);
          abortTask(() => abortCbInvoked = true);
          abortTask(null)

          expect(abortCbInvoked).toBeFalse();
          abortTask();
          expect(abortCbInvoked).toBeFalse();

          await whenIdle();
        });

      });
    });

  });

  describe('Using detectChanges() function.', () => {

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {

        it('Abort callback should be invoked.', async () => {
          let abortCbInvoked = false;
          const viewRef = new FakeViewRef();

          const abortTask = detectChanges(viewRef, priorityLevel);
          abortTask!(() => abortCbInvoked = true);

          expect(abortCbInvoked).toBeFalse();
          abortTask!();
          expect(abortCbInvoked).toBeTrue();

          await whenIdle();
        });

        it('Abort callback should not be invoked.', async () => {
          let abortCbInvoked = false;
          const viewRef = new FakeViewRef();

          const abortTask = detectChanges(viewRef, priorityLevel);
          abortTask!(() => abortCbInvoked = true);
          abortTask!(null)

          expect(abortCbInvoked).toBeFalse();
          abortTask!();
          expect(abortCbInvoked).toBeFalse();

          await whenIdle();
        });

      });
    });

  });

  describe('With internal coalescing mechanism.', () => {

    describe('Using detectChange() function.', () => {

      Priorities.filter((priorityLevel) => priorityLevel !== Priority.Highest).forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Abort callback should be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = detectChanges(viewRef, priorityLevel);

            abortTask1!(() => abortCbInvoked = true);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = detectChanges(viewRef, priorityLevel - 1  as any);

            expect(abortCbInvoked).toBeTrue();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

          it('Abort callback should not be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = detectChanges(viewRef, priorityLevel);

            abortTask1!(() => abortCbInvoked = true);
            abortTask1!(null);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = detectChanges(viewRef, priorityLevel - 1  as any);

            expect(abortCbInvoked).toBeFalse();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

        });
      });
    });

    describe('Using scheduleChangeDetection() function.', () => {

      Priorities.filter((priorityLevel) => priorityLevel !== Priority.Highest).forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Abort callback should be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = scheduleChangeDetection(() => {}, priorityLevel, viewRef);

            abortTask1!(() => abortCbInvoked = true);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = scheduleChangeDetection(() => {}, priorityLevel - 1 as any, viewRef);

            expect(abortCbInvoked).toBeTrue();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

          it('Abort callback should not be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = scheduleChangeDetection(() => {}, priorityLevel, viewRef);

            abortTask1!(() => abortCbInvoked = true);
            abortTask1!(null);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = scheduleChangeDetection(() => {}, priorityLevel - 1 as any, viewRef);

            expect(abortCbInvoked).toBeFalse();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

        });
      });
    });

    describe('Using detectChange() and scheduleChangeDetection() functions in that order.', () => {

      Priorities.filter((priorityLevel) => priorityLevel !== Priority.Highest).forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Abort callback should be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = detectChanges(viewRef, priorityLevel);

            abortTask1!(() => abortCbInvoked = true);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = detectChanges(viewRef, priorityLevel - 1  as any);

            expect(abortCbInvoked).toBeTrue();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

          it('Abort callback should not be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = detectChanges(viewRef, priorityLevel);

            abortTask1!(() => abortCbInvoked = true);
            abortTask1!(null);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = detectChanges(viewRef, priorityLevel - 1 as any);

            expect(abortCbInvoked).toBeFalse();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

        });
      });
    });

    describe('Using scheduleChangeDetection() and detectChanges() functions in that order.', () => {

      Priorities.filter((priorityLevel) => priorityLevel !== Priority.Highest).forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Abort callback should be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = scheduleChangeDetection(() => {}, priorityLevel, viewRef);

            abortTask1!(() => abortCbInvoked = true);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = scheduleChangeDetection(() => {}, priorityLevel - 1 as any, viewRef);

            expect(abortCbInvoked).toBeTrue();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

          it('Abort callback should not be invoked.', async () => {
            let abortCbInvoked = false;
            const viewRef = new FakeViewRef
            const abortTask1 = scheduleChangeDetection(() => {}, priorityLevel, viewRef);

            abortTask1!(() => abortCbInvoked = true);
            abortTask1!(null);

            expect(abortCbInvoked).toBeFalse();

            const abortTask2 = scheduleChangeDetection(() => {}, priorityLevel - 1 as any, viewRef);

            expect(abortCbInvoked).toBeFalse();
            expect(typeof abortTask2).toBe('function');

            await whenIdle();
          });

        });
      });
    });
  });
});

describe('Testing error throwing', () => {

  const INTEGRATION_NOT_PROVIDED_MESSAGE =
    '"@ng-queuex/core" integration was not provided to Angular! ' +
    'Use provideNgQueuexIntegration() function to in bootstrapApplication() function ' +
    'to add crucial environment providers for integration.';

  const SERVER_SIDE_MESSAGE = 'Scheduling concurrent tasks on server is not allowed!'

  const USAGE_EXAMPLE =
    'beforeEach(() => {\n' +
    ' TestBed.configureTestingModule({\n' +
    '   providers: [\n' +
    '     provideNgQueuexIntegration()\n' +
    '   ]\n' +
    ' }).runInInjectionContext(() => {\n' +
    '   completeIntegrationForTest();\n' +
    ' });\n'
    '});\n\n' +
    'afterEach(() => {\n' +
    ' TestBed.resetTestingModule(); //Dispose integration between test\n' +
    '});';

  const INTEGRATION_NOT_COMPLETED_MESSAGE =
    '"@ng-queuex/core" integration for tests is not competed. To make sure that integration is finalized ' +
    'use \'completeIntegrationForTest()\' function inside TestBed injection context as the example below shows:\n\n' + USAGE_EXAMPLE;

  describe('Not provided integration.', () => {

    let integrator: Integrator | null;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideNgQueuexIntegration()],
      }).runInInjectionContext(() => {
        completeIntegrationForTest();
      });

      integrator = Integrator.instance;
      Integrator.instance = null;
    });

    afterEach(() => {
      Integrator.instance = integrator;
      TestBed.resetTestingModule();
      if (Integrator.instance) {
        throw new Error('Integrator not disposed!')
      }
    });

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {

        it('scheduleTask() should throw error if integration was not provided.', () => {
          expect(() => scheduleTask(noopFn, priorityLevel)).toThrowError('scheduleTask(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        });

        it('scheduleChangeDetection() should throw error if integration was not provided.', () => {
          expect(() => scheduleChangeDetection(noopFn, priorityLevel)).toThrowError('scheduleChangeDetection(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        });

        it('detectChanges() should throw error if integration was not provided.', () => {
          const viewRef = new FakeViewRef()
          expect(() => detectChanges(viewRef, priorityLevel)).toThrowError('detectChanges(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
        });

      });
    });

    it('detectChangesSync() should throw error if integration was not provided.', () => {
        const viewRef = new FakeViewRef()
        expect(() => detectChangesSync(viewRef)).toThrowError('detectChangesSync(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
    });

  });

  describe('Running function in server environment.', () => {

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideNgQueuexIntegration()],
      }).runInInjectionContext(() => {
        completeIntegrationForTest();
      });
      Integrator.instance!.isServer = true;
    });

    afterEach(() => {
      Integrator.instance!.isServer = false;
      TestBed.resetTestingModule();
      if (Integrator.instance) {
        throw new Error('Integrator not disposed!');
      }
    });

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {

        it('scheduleTask() should throw error if it runs in server environment.', () => {
          expect(() => scheduleTask(noopFn, priorityLevel)).toThrowError('scheduleTask(): ' + SERVER_SIDE_MESSAGE);
        });

        it('scheduleChangeDetection() should throw error if it runs in server environment.', () => {
          expect(() => scheduleChangeDetection(noopFn, priorityLevel)).toThrowError('scheduleChangeDetection(): ' + SERVER_SIDE_MESSAGE);
        });

        it('detectChanges() should throw error if it runs in server environment.', () => {
          const viewRef = new FakeViewRef()
          expect(() => detectChanges(viewRef, priorityLevel)).toThrowError('detectChanges(): ' + SERVER_SIDE_MESSAGE);
        });

      });
    });

    it('detectChangesSync() should throw error if it runs in server environment.', () => {
        const viewRef = new FakeViewRef()
        expect(() => detectChangesSync(viewRef)).toThrowError('detectChangesSync(): This function usage on server is not allowed!');
    });

  });

  describe('Integration not completed for unit tests.', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideNgQueuexIntegration()],
      }).runInInjectionContext(() => {
        completeIntegrationForTest();
      });
      Integrator.instance!.uncompleted = true;
    });

    afterEach(() => {
      Integrator.instance!.uncompleted = false;
      TestBed.resetTestingModule();
      if (Integrator.instance) {
        throw new Error('Integrator not disposed!');
      }
    });

    Priorities.forEach((priorityLevel) => {
      it('scheduleTask() should throw error if integration is not completed for unit tests.', () => {
          expect(() => scheduleTask(noopFn, priorityLevel)).toThrowError('scheduleTask(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
        });

      it('scheduleChangeDetection() should throw error if integration is not completed for unit tests.', () => {
        expect(() => scheduleChangeDetection(noopFn, priorityLevel)).toThrowError('scheduleChangeDetection(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
      });

      it('detectChanges() should throw error if integration is not completed for unit tests.', () => {
        const viewRef = new FakeViewRef()
        expect(() => detectChanges(viewRef, priorityLevel)).toThrowError('detectChanges(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
      });
    });

    it('detectChangesSync() should throw error if is not completed for unit tests.', () => {
        const viewRef = new FakeViewRef()
        expect(() => detectChangesSync(viewRef)).toThrowError('detectChangesSync(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
    });
  });

});
