import { ChangeDetectorRef } from "@angular/core";
import { detectChanges, detectChangesSync, isConcurrentTaskContext, scheduleChangeDetection, scheduleTask } from "../core";
import { Priority } from "../scheduler/scheduler_utils";
import { getCurrentTask, whenIdle } from "../scheduler/scheduler";
import { doSomethingForSomeTime, randomPrioritiesArray, randomPriority } from "../scheduler/scheduler_test_utils";

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
    if (isConcurrentTaskContext()) {
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

describe('Testing scheduleTask function.', () => {

  it('Should invoke callbacks in correct order.', async () => {
    const shuffledPriorities = shuffleArray(Priorities);
    let executedPriorities: Priority[] = [];

    for (const prio of shuffledPriorities) {
      scheduleTask(() => {
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
      scheduleTask(() => {
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
    describe(`Priority level = ${Priority[prio]}`, () => {
      it('Aborted task should not execute scheduled callbacks.', async () => {
        let executionCount = 0;
        const aborters: VoidFunction[] = [];
        for (let i = 0; i < 10; i++) {
          const abortFn = scheduleTask(() => {
            doSomethingForSomeTime();
            executionCount++;
          }, prio);
          aborters.push(abortFn);
        }

        aborters[2]();
        aborters[5]();
        aborters[8]();

        await whenIdle();

        expect(executionCount).toEqual(7);
      });
    });
  });

});

describe('Testing scheduleChangeDetection() function.', () => {

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
    describe(`Priority level = ${Priority[prio]}`, () => {
      it('Aborted task should not execute scheduled callbacks.', async () => {
        let executionCount = 0;
        const aborters: VoidFunction[] = [];
        for (let i = 0; i < 10; i++) {
          const abortFn = scheduleChangeDetection(() => {
            doSomethingForSomeTime();
            executionCount++;
          }, prio);
          aborters.push(abortFn);
        }

        aborters[2]();
        aborters[5]();
        aborters[8]();

        await whenIdle();

        expect(executionCount).toEqual(7);
      });
    });
  });

  describe('Using detectChangesSync() function in callbacks body.', () => {

    Priorities.forEach((prio) => {
      describe(`Priority level = ${prio}.`, () => {
        it('Should coalesce and trigger cdRef.detectChanges() once.', async () => {
          const viewRef = new FakeViewRef();

          scheduleChangeDetection(() => {
            detectChangesSync(viewRef);
            detectChangesSync(viewRef);//Dismissed
            detectChangesSync(viewRef);//Dismissed
            detectChangesSync(viewRef);//Dismissed
          }, prio)

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(viewRef.lastTaskPriority).toEqual(prio);
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
              detectChanges(viewRef, randomPriority()) //Will be aborted.
              sync = detectChangesSync(viewRef) //Will abort above.
              detectChanges(viewRef, randomPriority()) //Dismissed.
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
              detectChanges(viewRef, randomPriority()) //Dismissed.
              sync = detectChangesSync(viewRef) //Will abort above.
              detectChanges(viewRef, randomPriority()) //Dismissed.
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
            detectChanges(viewRef, detectChangesPriority);
            detectChanges(viewRef, detectChangesPriority);//Dismissed
            detectChanges(viewRef, detectChangesPriority);//Dismissed
          }, prio);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(viewRef.lastTaskPriority).toEqual(detectChangesPriority);
        });
      });
    });
  });

  describe('Using detectChanges() and scheduleTask() next to each other, where detectChangesSync() is used callbacks body.', () => {
    Priorities.forEach((prio) => {
      describe(`Priority level = ${prio}`, () => {
        it('Should coalesce when first scheduleTask() function was used.', async () => {
          const viewRef = new FakeViewRef();
          let sync = false;

          scheduleChangeDetection(() => {
            sync = detectChangesSync(viewRef)
          }, prio);

          detectChanges(viewRef, prio);// dismissed;

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(sync).toBeTrue()
        });

        it('Should not coalesce when scheduleTask() was used after detectChanges().', async () => {
          const viewRef = new FakeViewRef();
          let sync = false
          detectChanges(viewRef, prio);

          scheduleChangeDetection(() => {
            sync = detectChangesSync(viewRef)
          }, prio);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(2);
          expect(sync).toBeTrue();
        });

        it('Should coalesce when scheduleTask() was used after detectChanges(), if cdRef was provided as a third argument.', async () => {
          const viewRef = new FakeViewRef();
          let sync = false

          detectChanges(viewRef, prio);

          scheduleChangeDetection(() => {
            sync = detectChangesSync(viewRef)
          }, prio, viewRef);

          await whenIdle();

          expect(viewRef.detectChangesInvocationCount).toEqual(1);
          expect(sync).toBeFalse();
        });
      });
    });
  });
});

describe('Testing detectChanges() function', () => {

  Priorities.forEach((prio => {
    it('Should coalesce change detection.', async () => {
      const viewRef = new FakeViewRef();

      detectChanges(viewRef, prio); //This call should schedule cdRef.detectChanges invocation.
      detectChanges(viewRef, prio); //Dismissed
      detectChanges(viewRef, prio); //Dismissed
      detectChanges(viewRef, prio); //Dismissed
      detectChanges(viewRef, prio); //Dismissed

      expect(viewRef.detectChangesInvocationCount).toEqual(0)
      expect(viewRef.lastTaskPriority).toEqual(-1)

      await whenIdle();

      expect(viewRef.detectChangesInvocationCount).toEqual(1)
      expect(viewRef.lastTaskPriority).toEqual(prio)

    });
  }));

  Priorities.filter((prio) => prio !== Priority.Highest).forEach((prio) => {
    it('Should coalesce change detection and promote higher priority.', async () => {
      const viewRef = new FakeViewRef();

      detectChanges(viewRef, prio); //This call should schedule cdRef.detectChanges invocation, but almost immediately be aborted.
      detectChanges(viewRef, prio); //Dismissed
      detectChanges(viewRef, prio - 1); //This call should schedule cdRef.detectChanges invocation and abort first call.
      detectChanges(viewRef, prio); //Dismissed
      detectChanges(viewRef, prio); //Dismissed

      expect(viewRef.detectChangesInvocationCount).toEqual(0)
      expect(viewRef.lastTaskPriority).toEqual(-1)

      await whenIdle();

      expect(viewRef.detectChangesInvocationCount).toEqual(1)
      expect(viewRef.lastTaskPriority).toEqual(prio - 1)

    });
  });

})
