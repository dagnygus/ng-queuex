import { assertNotInReactiveContext, computed, DestroyableInjector, DestroyRef, Injector, runInInjectionContext, signal } from "@angular/core";
import { createTestCleanupScope, TestCleanupScope } from "../cleanup_scope/cleanup_scope";
import { setPostSignalSetFn } from "@angular/core/primitives/signals";
import { subscribe } from "./subscribe";


describe('Testing subscribe() function.', () => {

  let injector: DestroyableInjector;
  let destroyRef: DestroyRef

  function runInTestCleanupScope(fn: (scope: TestCleanupScope) => void): TestCleanupScope {
    const scope = createTestCleanupScope();
    destroyRef.onDestroy(() => scope.cleanup());
    scope.run(() => fn(scope));
    return scope
  }

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef)
  });

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!
  });

  it('Should watch signal synchronously.', () => {
    const log: string[] = [];
    const source = signal('A');
    subscribe(source, (value) => log.push(value), destroyRef);
    log.push('B');
    source.set('C');
    log.push('D');
    expect(log).toEqual(['A','B','C','D']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should not emit initial undefined value', () => {
    const log: string[] = [];
    const source = signal(undefined);
    subscribe(source, () => log.push('A'), destroyRef);
    expect(log).toEqual([]);
  });

  it('Should throw error if source signal will be set to undefined.', () => {
    const log: string[] = [];
    const source = signal<any>('A');
    subscribe(source, (value) => log.push(value), destroyRef);
    expect(() => source.set(undefined)).toThrowError('subscribe(): Source signal has been set to undefined!');
    expect(log).toEqual(['A'])
  });

  it('Should run function outside reactive context.', () => {
    const log: string[] = [];
    const source = signal<any>('A');
    subscribe(source, (value) => {
      assertNotInReactiveContext(subscribe);
      log.push(value);
    }, destroyRef);
    expect(log).toEqual(['A'])
  });

  it('Should throw error if DestroyRef is not provided.', () => {
    expect(() => subscribe(signal('A'), () => {})).toThrowError();
  });

  it('Should not throw error if DestroyRef is not provided in injection context.', () => {
    expect(() => {
      runInInjectionContext(injector, () => {
        subscribe(signal('A'), () => {});
      });
    }).not.toThrowError();
  });

  it('Should not throw error if DestroyRef is not provided in cleanup scope.', () => {
    expect(() => {
      runInTestCleanupScope(() => {
        subscribe(signal('A'), () => {});
      });
    }).not.toThrowError();
  });

  it('Should not watch when subscription is canceled.', () => {
    const log: string[] = [];
    const source = signal('A');
    const unsubscribe = subscribe(source, (value) => log.push(value), destroyRef);
    unsubscribe();
    source.set('B');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
    source.set('C');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should not watch when injector is destroyed.', () => {
    const log: string[] = [];
    const source = signal('A');
    subscribe(source, (value) => log.push(value), destroyRef);
    injector.destroy();
    source.set('B');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
    source.set('C');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should not watch when injection context is destroyed.', () => {
    const log: string[] = [];
    const source = signal('A');
    runInInjectionContext(injector, () => {
      subscribe(source, (value) => log.push(value));
    });
    injector.destroy();
    source.set('B');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
    source.set('C');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });
  it('Should not watch when cleanup scope is cleaned.', () => {
    const log: string[] = [];
    const source = signal('A');
    const scope = runInTestCleanupScope(() => {
      subscribe(source, (value) => log.push(value));
    });
    scope.cleanup();
    source.set('B');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
    source.set('C');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should watch two signals separately synchronously.', () => {
    const log: string[] = [];
    const source1 = signal('A');
    const source2 = signal('B');
    subscribe(source1, (v) => log.push(v), destroyRef);
    subscribe(source2, (v) => log.push(v), destroyRef);

    log.push('C');
    source1.set('D');
    log.push('E');
    source2.set('F');
    log.push('G');
    source1.set('H');
    source2.set('I');
    log.push('J');

    expect(log).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'
    ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should watch computed signal synchronously.', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source());
    subscribe(derived, (value) => log.push(value), destroyRef);
    log.push('B');
    source.set('C');
    log.push('D');
    expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
    expect(setPostSignalSetFn(null)).toEqual(null);
  });

  it('Should watch two computed signals separately synchronously.', () => {
    const log: string[] = [];
    const source1 = signal('A');
    const source2 = signal('B');
    const derived1 = computed(() => source1());
    const derived2 = computed(() => source2());
    subscribe(derived1, (v) => log.push(v), destroyRef);
    subscribe(derived2, (v) => log.push(v), destroyRef);

    log.push('C');
    source1.set('D');
    log.push('E');
    source2.set('F');
    log.push('G');
    source1.set('H');
    source2.set('I');
    log.push('J');

    expect(log).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'
    ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should watch computed signal form two source without any problem.', () => {
    const log: string[] = [];
    const source1 = signal('A');
    const source2 = signal('A');
    const derived = computed(() => source1() + source2());
    subscribe(derived, (value) => log.push(value), destroyRef);
    expect(log).toEqual(['AA']);
    source1.set('B');
    expect(log).toEqual([ 'AA', 'BA']);
    source2.set('B');
    expect(log).toEqual([ 'AA', 'BA', 'BB']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should two subscribers observe one signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    subscribe(source, (v) => log.push(v), destroyRef);
    subscribe(source, (v) => log.push(v), destroyRef);
    expect(log).toEqual([ 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should two subscribers observe one computed signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source())
    subscribe(derived, (v) => log.push(v), destroyRef);
    subscribe(derived, (v) => log.push(v), destroyRef);
    expect(log).toEqual([ 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should three subscribers observe one signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    subscribe(source, (v) => log.push(v), destroyRef);
    subscribe(source, (v) => log.push(v), destroyRef);
    subscribe(source, (v) => log.push(v), destroyRef);
    expect(log).toEqual([ 'A', 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'A', 'B', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should three subscribers observe one computed signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source());
    subscribe(derived, (v) => log.push(v), destroyRef);
    subscribe(derived, (v) => log.push(v), destroyRef);
    subscribe(derived, (v) => log.push(v), destroyRef);
    expect(log).toEqual([ 'A', 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'A', 'B', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should two subscribers observe shared source in correct order', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source())
    subscribe(derived, (v) => log.push(v + '1'), destroyRef);
    subscribe(derived, (v) => log.push(v + '2'), destroyRef);
    expect(log).toEqual([ 'A1', 'A2' ]);
    source.set('B');
    expect(log).toEqual([ 'A1', 'A2', 'B1', 'B2' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should three subscribers observe shared source in correct order', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source())
    subscribe(derived, (v) => log.push(v + '1'), destroyRef);
    subscribe(derived, (v) => log.push(v + '2'), destroyRef);
    subscribe(derived, (v) => log.push(v + '3'), destroyRef);
    expect(log).toEqual([ 'A1', 'A2', 'A3' ]);
    source.set('B');
    expect(log).toEqual([ 'A1', 'A2', 'A3', 'B1', 'B2', 'B3' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should two signals with multiple subscribers works correctly', () => {
    const log: string[] = [];
    const source1 = signal('a');
    const source2 = signal('A');
    subscribe(source1, (v) => log.push(v + '1'), destroyRef);
    subscribe(source1, (v) => log.push(v + '2'), destroyRef);
    subscribe(source2, (v) => log.push(v + '1'), destroyRef);
    subscribe(source2, (v) => log.push(v + '2'), destroyRef);

    expect(log).toEqual([ 'a1', 'a2', 'A1', 'A2' ]);
    source1.set('b');
    source2.set('B');
    expect(log).toEqual([
      'a1', 'a2', 'A1', 'A2', 'b1', 'b2', 'B1', 'B2'
    ]);
  });

  it('Should run added teardown logic when subscription get canceled.', () => {
    const log: string[] = [];
    const unsubscribe = subscribe(signal(0), () => {}, destroyRef);
    unsubscribe.add(() => log.push('A'));
    unsubscribe.add(() => log.push('B'));
    unsubscribe.add(() => log.push('C'));
    unsubscribe();
    expect(log).toEqual(['A', 'B', 'C']);
  });

  it('Should not run removed teardown logic from subscription when get canceled.', () => {
    const log: string[] = [];
    const unsubscribe = subscribe(signal(0), () => {}, destroyRef);
    unsubscribe.add(() => log.push('A'));
    const teardown = () => { log.push('B') }
    unsubscribe.add(teardown);
    unsubscribe.add(() => log.push('C'));
    unsubscribe.remove(teardown);
    unsubscribe();
    expect(log).toEqual(['A', 'C']);
  });
});
