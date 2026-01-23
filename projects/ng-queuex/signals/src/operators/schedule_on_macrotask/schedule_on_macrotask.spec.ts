import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { fakeAsync, flush, flushMicrotasks, TestBed } from "@angular/core/testing";
import { subscribe } from "../../subscribe/subscribe";
import { scheduleOnMacrotask } from "./schedule_on_macrotask";

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

describe('Testing scheduleOnMacrotask() function.', () => {

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
    expect(() => scheduleOnMacrotask()(signal(undefined))).toThrowError(
      'scheduleOnMacrotask(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    scope.run(() => expect(() => runInReactiveContext(() => scheduleOnMacrotask()(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', fakeAsync(() => {
    const log: string[] = [];
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => scheduleOnMacrotask<string | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    expect(log).toEqual([]);
    flushMicrotasks();
    expect(log).toEqual([]);
    flush();
    expect(log).toEqual([ 'A' ]);
  }));

});
