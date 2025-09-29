import { DestroyableInjector, DestroyRef, Injector, runInInjectionContext, signal } from "@angular/core";
import { subscribe } from "../subscribe/subscribe";
import { merge } from "./merge";
import { JoinSignalCreationOptions } from "../shared";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation, consumerDestroy } from "@angular/core/primitives/signals";

function runInReactiveContext(fn: VoidFunction): ReactiveNode {
  const consumer = Object.create(REACTIVE_NODE) as ReactiveNode;
  consumer.dirty = true;
  (consumer as any).consumerIsAlwaysLive = true;
  const prevConsumer = consumerBeforeComputation(consumer);
  try {
    fn();
  } finally {
    consumerAfterComputation(consumer, prevConsumer);
  }
  return consumer;
}

describe('Testing merge function.', () => {

  let injector: DestroyableInjector;
  let destroyRef: DestroyRef

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
  })

  function runInTestInjectionContext(fn: VoidFunction): void {
    runInInjectionContext(injector, fn);
  }

  describe('Reactive cleanup strategy.', () => {

    const options: JoinSignalCreationOptions = { cleanupStrategy: 'reactive' };

    it('Should gracefully be read in reactive context', () => {
      const log: any[] = [];
      const source1 = signal(1);
      const source2 = signal('A');
      const source3 = signal(false);

      const composedSource = merge([source1, source2, source3], options);

      const consumer = runInReactiveContext(() => {
        log.push(composedSource());
      });
      expect(log).toEqual([false]);
      consumerDestroy(consumer);
    });

    it('Should emit initial not undefined value.', () => {
      const log: string[] = [];

      const source1 = signal(undefined);
      const source2 = signal('A');
      const source3 = signal(undefined);

      const composedSource = merge([source1, source2, source3], options);

      subscribe(composedSource, (value) => log.push(value), destroyRef);

      expect(log).toEqual(['A']);
    });

    it('Should handle inner sources changes without any problem.', () => {
      const log: string[] = [];

      const source1 = signal<string>(undefined!);
      const source2 = signal<string>(undefined!);
      const source3 = signal('A');

      const composedSource = merge([source1, source2, source3], options);

      subscribe(composedSource, (value) => log.push(value), destroyRef);

      source1.set('B');
      source2.set('C');
      source3.set('D');
      source2.set('E');
      source1.set('F');

      expect(log).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

  });

  describe('Injection cleanup strategy.', () => {

    const options: JoinSignalCreationOptions = { cleanupStrategy: 'injection' };

    it('Should throw error if is created outside injection context', () => {
      expect(() => (merge([], options))).toThrowError();
    });

    it('Should gracefully be readable in reactive context', () => {
      runInTestInjectionContext(() => {
        const log: any[] = [];
        const source1 = signal(1);
        const source2 = signal('A');
        const source3 = signal(false);

        const composedSource = merge([source1, source2, source3], options);

        const consumer = runInReactiveContext(() => {
          log.push(composedSource());
        });
        expect(log).toEqual([false]);
        consumerDestroy(consumer);
      });
    });

    it('Should emit initial not undefined value.', () => {
      runInTestInjectionContext(() => {
        const source1 = signal(undefined);
        const source2 = signal('A');
        const source3 = signal(undefined);

        const composedSource = merge([source1, source2, source3], options);
        expect(composedSource()).toBe('A');
      });
    });

    it('Should handle inner sources changes without any problem.', () => {
      runInTestInjectionContext(() => {
        const log: string[] = [];

        const source1 = signal<string>(undefined!);
        const source2 = signal<string>(undefined!);
        const source3 = signal('A');

        const composedSource = merge([source1, source2, source3], options);

        subscribe(composedSource, (value) => log.push(value), destroyRef);

        source1.set('B');
        source2.set('C');
        source3.set('D');
        source2.set('E');
        source1.set('F');

        expect(log).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
      });
    })

  });

});
