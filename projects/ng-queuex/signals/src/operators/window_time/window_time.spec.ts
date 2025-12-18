import { Injector, DestroyRef, DestroyableInjector, signal, Signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { CleanupScope, createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { discardPeriodicTasks, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { windowTime } from "./window_time";
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

describe('Testing windowTime() function', () => {
  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;
  let scope: CleanupScope = null!;

  beforeEach(() => {
    scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });

  afterEach(() => {
    scope.cleanup();
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
    scope = null!
  });

  it('Should throw error if it is used outside cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => windowTime(30)(inputSource)).toThrowError(
      'windowTime(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside cleanup scope.', () => {
    const inputSource = signal(undefined);
    scope.run(() => expect(() => runInReactiveContext(() => windowTime(30)(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', fakeAsync(() => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => windowTime<string | undefined>(30)(inputSource));

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    inputSource.set('A');
    tick(10);
    inputSource.set('B');
    tick(10);
    inputSource.set('C');
    expect(log).toEqual([
      [ 'A', 'B', 'C']
    ]);
    tick(10);
    expect(log).toEqual([
      [ 'A', 'B', 'C'],
      []
    ]);
    inputSource.set('D');
    tick(10);
    inputSource.set('E');
    tick(10);
    inputSource.set('F');
    expect(log).toEqual([
      [ 'A', 'B', 'C'],
      [ 'D', 'E', 'F'],
    ]);
    tick(10);
    expect(log).toEqual([
      [ 'A', 'B', 'C'],
      [ 'D', 'E', 'F'],
      []
    ]);
    discardPeriodicTasks();
  }));

  it('Should widows have shared element', fakeAsync(() => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => windowTime<string | undefined>(30, 20)(inputSource));

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    inputSource.set('A');
    tick(10);
    inputSource.set('B');
    tick(10);
    expect(log).toEqual([
      [ 'A', 'B' ],
      []
    ]);
    inputSource.set('C');
    tick(10);
    inputSource.set('D');
    tick(10)
    expect(log).toEqual([
      [ 'A', 'B', 'C' ],
      [ 'C', 'D' ],
      []
    ]);
    inputSource.set('E');
    expect(log).toEqual([
      [ 'A', 'B', 'C' ],
      [ 'C', 'D', 'E'],
      [ 'E' ]
    ]);
    discardPeriodicTasks()
  }));

});
