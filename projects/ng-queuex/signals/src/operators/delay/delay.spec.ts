import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { delay } from "./delay";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";
import { discardPeriodicTasks, fakeAsync, TestBed, tick } from "@angular/core/testing";

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

describe('Testing delay() function.', () => {

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
    expect(() => delay(100)(signal(undefined))).toThrowError(
      'delay(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => delay(100)(signal(undefined))).toThrowError());
  });

  it('Should project output signal correctly.', fakeAsync(() => {
    const log: string[] = [];
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => delay<string | undefined>(100)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    tick(20);
    expect(log).toEqual([]);
    inputSource.set('B');
    tick(20);
    expect(log).toEqual([]);
    inputSource.set('C');
    tick(20);
    expect(log).toEqual([]);
    inputSource.set('D');
    tick(20);
    expect(log).toEqual([]);
    inputSource.set('E');
    tick(20);
    expect(log).toEqual([ 'A' ]);
    tick(20);
    expect(log).toEqual([ 'A', 'B' ]);
    tick(20);
    expect(log).toEqual([ 'A', 'B', 'C' ]);
    tick(20);
    expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
    tick(20);
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E' ]);
  }));
});
