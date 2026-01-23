import { DestroyableInjector, DestroyRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from '@angular/core/primitives/signals';
import { combineLatest } from './combine_latest';
import { subscribe } from '../subscribe/subscribe';
import { JoinSignalCreationOptions } from '../common';

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

describe('Testing combineLatest() function.', () => {
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
  });

  function runInTestInjectionContext(fn: VoidFunction): void {
    runInInjectionContext(injector, fn);
  }

  describe('Reactive cleanup strategy.', () => {
    const options: JoinSignalCreationOptions = { cleanupStrategy: 'reactive' };

    it('Should work with tuples without any problems.', () => {
      let value: any;

      const source1 = signal('A');
      const source2 = signal(0);
      const source3 = signal(false);

      const composedSource = combineLatest([source1, source2, source3], options);
      subscribe(composedSource, (v) => value = v, destroyRef);
      expect(value).toEqual(['A', 0, false]);
      source1.set('B');
      expect(value).toEqual(['B', 0, false]);
      source2.set(1);
      expect(value).toEqual(['B', 1, false]);
      source3.set(true);
      expect(value).toEqual(['B', 1, true]);
      source2.set(2);
      expect(value).toEqual(['B', 2, true]);
      source1.set('C');
      expect(value).toEqual(['C', 2, true]);
    });

    it('Should work with objects without any problems.', () => {
      let value: any;

      const source1 = signal('A');
      const source2 = signal(0);
      const source3 = signal(false);

      const composedSource = combineLatest({ source1, source2, source3 }, options);
      subscribe(composedSource, (v) => value = v, destroyRef);
      expect(value).toEqual({ source1: 'A', source2: 0, source3: false });
      source1.set('B');
      expect(value).toEqual({ source1: 'B', source2: 0, source3: false });
      source2.set(1);
      expect(value).toEqual({ source1: 'B', source2: 1, source3: false });
      source3.set(true);
      expect(value).toEqual({ source1: 'B', source2: 1, source3: true });
      source2.set(2);
      expect(value).toEqual({ source1: 'B', source2: 2, source3: true });
      source1.set('C');
      expect(value).toEqual({ source1: 'C', source2: 2, source3: true });
    });
  });

  describe('Injection cleanup strategy.', () => {
    const options: JoinSignalCreationOptions = { cleanupStrategy: 'injection' };

    it('Should throw error if signal is created outside injection context', () => {
      expect(() => combineLatest([], options)).toThrowError();
    })

    it('Should run gracefully in reactive context.', () => {
      runInTestInjectionContext(() => {
        const source = signal('A');
        const composedSource = combineLatest([source], options);
        runInReactiveContext(() => {
          expect(composedSource()).toEqual(['A']);
        });
      });
    });

    it('Should work with tuples without any problems.', () => {
      runInTestInjectionContext(() => {
        const source1 = signal('A');
        const source2 = signal(0);
        const source3 = signal(false);

        const composedSource = combineLatest([source1, source2, source3], options);

        expect(composedSource()).toEqual(['A', 0, false]);
        source1.set('B');
        expect(composedSource()).toEqual(['B', 0, false]);
        source2.set(1);
        expect(composedSource()).toEqual(['B', 1, false]);
        source3.set(true);
        expect(composedSource()).toEqual(['B', 1, true]);
        source2.set(2);
        expect(composedSource()).toEqual(['B', 2, true]);
        source1.set('C');
        expect(composedSource()).toEqual(['C', 2, true]);
      });
    });

    it('Should work with objects without any problems.', () => {
      runInTestInjectionContext(() => {

        const source1 = signal('A');
        const source2 = signal(0);
        const source3 = signal(false);

        const composedSource = combineLatest({ source1, source2, source3 }, options);
        expect(composedSource()).toEqual({ source1: 'A', source2: 0, source3: false });
        source1.set('B');
        expect(composedSource()).toEqual({ source1: 'B', source2: 0, source3: false });
        source2.set(1);
        expect(composedSource()).toEqual({ source1: 'B', source2: 1, source3: false });
        source3.set(true);
        expect(composedSource()).toEqual({ source1: 'B', source2: 1, source3: true });
        source2.set(2);
        expect(composedSource()).toEqual({ source1: 'B', source2: 2, source3: true });
        source1.set('C');
        expect(composedSource()).toEqual({ source1: 'C', source2: 2, source3: true });
      })
    });
  });

});
