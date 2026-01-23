import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { throttleTime } from "./throttle_time";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { discardPeriodicTasks, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { subscribe } from "../../subscribe/subscribe";

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

describe('Testing throttleTime() function.', () => {

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
    expect(() => throttleTime(100)(signal(undefined))).toThrowError(
      'auditTime(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => throttleTime(100)(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', fakeAsync(() => {
    const log: string[] = [];
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    const inputSource = signal('A');
    const outputSource = scope.run(() => throttleTime<string>(100)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    expect(log).toEqual(['A']);
    tick(100);
    inputSource.set('B');
    inputSource.set('C');
    expect(log).toEqual([ 'A', 'B' ]);
    tick(100);
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    expect(log).toEqual([ 'A', 'B', 'D' ]);
    discardPeriodicTasks();
  }));
});
