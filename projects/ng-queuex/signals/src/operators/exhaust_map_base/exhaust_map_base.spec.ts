import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { exhaustMapBase } from "./exhaust_map_base";
import { CleanupScope, createTestCleanupScope, subscribe } from "../../signals";

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

function dumiFn() {

}

describe('Testing exhaustMap() function.', () => {

  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;

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

  it('Should throw error if it is used outside cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => exhaustMapBase(() => signal(undefined), dumiFn)(inputSource)).toThrowError(
      'dumiFn(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => exhaustMapBase(() => signal(undefined), dumiFn)(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => exhaustMapBase(() => externalSource, dumiFn)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    expect(log).toEqual([]);
    inputSource.set('A');
    expect(log).toEqual([]);
    externalSource.set('B');
    expect(log).toEqual([ 'B' ]);
  });

  it('Should switch between sources only when current subscribed source is resolved (was set to defined value).', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    let externalSource = externalSource1;

    const outputSource = scope.run(() => exhaustMapBase(() => externalSource, dumiFn)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('1');
    externalSource = externalSource2;
    inputSource.set('2');
    externalSource2.set('B');
    expect(log).toEqual([]);
    externalSource1.set('A');
    expect(log).toEqual([ 'A' ]);
    inputSource.set('3');
    externalSource1.set('D');
    expect(log).toEqual([ 'A', 'B' ]);
    externalSource2.set('C');
    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should run project function in child cleanup scope.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    scope.run(() => exhaustMapBase<string | undefined, undefined>((value) => {
      log.push(value);
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return signal(undefined);
    }, dumiFn)(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic between sources.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    scope.run(() => exhaustMapBase<string | undefined, string>((value) => {
      CleanupScope.assertCurrent().add(() => log.push('B'));
      log.push(value);
      return signal('');
    }, dumiFn)(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
    inputSource.set('C');
    expect(log).toEqual([ 'A', 'B' ,'C' ]);
  });

  it('Should not connect to signal if cleanup scope gets immediate cleaned.', () => {
    const log: string[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => exhaustMapBase<number | undefined, string | undefined>(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('C'));
      return externalSource;
    }, dumiFn)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set(0);
    externalSource.set('A');
    externalSource.set('B');
    expect(log).toEqual([ 'C' ]);
  });

  it('Should always update output source even if child cleanup scope gets cleaned in project() function body.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number>(0);
    const externalSource1 = signal('A');
    const externalSource2 = signal('B');

    let externalSource = externalSource1;
    const outputSource = scope.run(() => exhaustMapBase<number, string>(() => {
      CleanupScope.assertCurrent().cleanup();
      return externalSource;
    }, dumiFn)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    externalSource = externalSource2;
    inputSource.set(1);
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should run cleanup logic after user cleanup during signal read.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number>(0);
    const externalSource = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    });

    scope.run(() => exhaustMapBase(() => externalSource, dumiFn)(inputSource));
    expect(log).toEqual([ 'A' ]);
  });

  it('Output value should not be undefined if cleanup scope gest cleaned in project() function and external source has defined value and where input source has defined value.', () => {
    const inputSource = signal(0);
    const externalSource = signal('ABC');
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => exhaustMapBase(() => {
      CleanupScope.assertCurrent().cleanup();
      return externalSource;
    }, dumiFn)(inputSource));

    expect(outputSource()).toEqual(externalSource());
  });

  it('Output value should not be changed form defined value to undefined even if cleanup scope gets cleaned in project() function and external undefined.', () => {
    const inputSource = signal(0);
    const externalSource1 = signal('ABC');
    const externalSource2 = signal(undefined);
    const scope = createTestCleanupScope();

    let externalSource: Signal<any> = externalSource1
    const outputSource = scope.run(() => exhaustMapBase(() => {
      CleanupScope.assertCurrent().cleanup();
      return externalSource;
    }, dumiFn)(inputSource));
    externalSource = externalSource2;
    inputSource.set(1);
    expect(outputSource()).toBe(externalSource1());
  });
});
