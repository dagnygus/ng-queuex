import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { createTestCleanupScope, TestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { sampleTime } from "./sample_time";
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

describe('Testing sampleTime() function.', () => {
  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;
  let scope: TestCleanupScope = null!;

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
    scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
  });

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
    scope = null!;
  });

  it('Should throw error if it is used outside cleanup scope', () => {
    expect(() => sampleTime(100)(signal(undefined))).toThrowError(
      'sampleTime(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    scope.run(() => expect(() => runInReactiveContext(() => sampleTime(100)(signal(undefined)))).toThrowError());
  });

  it('Should emit most recent value.', fakeAsync(() => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => sampleTime<string | undefined>(120)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    expect(log).toEqual([]);
    tick(120);
    expect(log).toEqual([ 'A' ]);
    inputSource.set('B');
    tick(60);
    inputSource.set('C');
    tick(60);
    expect(log).toEqual([ 'A', 'C' ]);
    inputSource.set('D');
    tick(40);
    inputSource.set('E');
    tick(40);
    inputSource.set('F');
    tick(40);
    expect(log).toEqual([ 'A', 'C', 'F' ]);
  }));

  it('Should not emit latest value more then once.', fakeAsync(() => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => sampleTime<string | undefined>(120)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    tick(120);
    tick(120);
    expect(log).toEqual([ 'A' ]);
  }));
});
