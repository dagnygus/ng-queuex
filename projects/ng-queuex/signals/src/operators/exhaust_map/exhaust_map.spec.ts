import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { exhaustMap } from "./exhaust_map";
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
    expect(() => exhaustMap(() => signal(undefined))(inputSource)).toThrowError(
      'exhaustMap(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => exhaustMap(() => signal(undefined))(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => exhaustMap(() => externalSource)(inputSource));

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

    const outputSource = scope.run(() => exhaustMap(() => externalSource)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('1');
    externalSource = externalSource2;
    inputSource.set('2');
    externalSource2.set('A');
    expect(log).toEqual([]);
    externalSource1.set('B');
    expect(log).toEqual([ 'B' ]);
    inputSource.set('3');
    externalSource1.set('C');
    expect(log).toEqual([ 'B', 'A' ]);
    externalSource2.set('D');
    expect(log).toEqual([ 'B', 'A', 'D' ]);
  });

  it('Should run project function in child cleanup scope.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    scope.run(() => exhaustMap<string | undefined, undefined>((value) => {
      log.push(value);
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return signal(undefined);
    })(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic between sources.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    scope.run(() => exhaustMap<string | undefined, string>((value) => {
      CleanupScope.assertCurrent().add(() => log.push('B'));
      log.push(value);
      return signal('');
    })(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
    inputSource.set('C');
    expect(log).toEqual([ 'A', 'B' ,'C' ]);
  });

  
});
