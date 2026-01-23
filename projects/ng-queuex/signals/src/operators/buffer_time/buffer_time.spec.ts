import { DestroyableInjector, DestroyRef, Injector, PendingTasks, Provider, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { createTestCleanupScope, TestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { bufferTime } from "./buffer_time";
import { discardPeriodicTasks, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { subscribe } from "../../subscribe/subscribe";
import { Schedulers } from "../../schedulers/schedulers";

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

const providers: Provider[] = [
  { provide: PendingTasks, useValue: { add() { return () => {} } } },
  { provide: Schedulers, useClass: Schedulers }
]

describe('Testing bufferTime() function.', () => {
  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;
  let scope: TestCleanupScope = null!;

  beforeEach(() => {
    injector = Injector.create({ providers });
    destroyRef = injector.get(DestroyRef);
    scope = createTestCleanupScope({ injector });
  });

  afterEach(() => {
    scope.cleanup();
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
    scope = null!;
  });

  it('Should throw error if it is used outside cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => bufferTime(10)(inputSource)).toThrowError(
      'bufferTime(): Current stack frame is not within cleanup scope.'
    )
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    scope.run(() => expect(() => runInReactiveContext(() => bufferTime(10)(inputSource))).toThrowError())
  });

  it('Should buffer items to array.', fakeAsync(() => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => bufferTime<string | undefined>(10)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    tick(10);
    inputSource.set('C');
    inputSource.set('D');
    inputSource.set('E');
    tick(10);
    inputSource.set('F');
    tick(10);

    expect(log).toEqual([
      [],
      [ 'A', 'B' ],
      [ 'C', 'D', 'E' ],
      [ 'F' ]
    ]);

    discardPeriodicTasks();
  }));

  it('should emit those buffers that have reached their maximum size.', fakeAsync(() => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => bufferTime<string | undefined>(10, 10, 3)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
    ]);

    inputSource.set('D');
    inputSource.set('E');

    tick(10);
    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
    ]);

    inputSource.set('F');
    inputSource.set('G');
    inputSource.set('H');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
      [ 'F', 'G', 'H' ]
    ]);

    inputSource.set('I');
    inputSource.set('J');
    inputSource.set('K');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
      [ 'F', 'G', 'H' ],
    ]);

  }))

  it('Should buffer items in to three elements array with one element overlap.', fakeAsync(() => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => bufferTime<string | undefined>(30, 20)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');tick(10);
    inputSource.set('B');tick(10);
    inputSource.set('C');tick(10);
    inputSource.set('D');tick(10);
    inputSource.set('E');tick(10);
    inputSource.set('F');tick(10);
    inputSource.set('G');tick(10);
    inputSource.set('H');tick(10);
    inputSource.set('I');tick(10);

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
      [ 'C', 'D', 'E' ],
      [ 'E', 'F', 'G' ],
      [ 'G', 'H', 'I' ],
    ])

    discardPeriodicTasks();
  }));

  it('Should buffer items in to wo elements array and skip one emission in between.', fakeAsync(() => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => bufferTime<string | undefined>(20, 30)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');tick(10);
    inputSource.set('B');tick(10);
    inputSource.set('C');tick(10);
    inputSource.set('D');tick(10);
    inputSource.set('E');tick(10);
    inputSource.set('F');tick(10);
    inputSource.set('G');tick(10);
    inputSource.set('H');tick(10);
    inputSource.set('I');tick(10);
    inputSource.set('J');tick(10);
    inputSource.set('K');tick(10);

    expect(log).toEqual([
      [],
      [ 'A', 'B' ],
      [ 'D', 'E' ],
      [ 'G', 'H' ],
      [ 'J', 'K' ],
    ]);

    discardPeriodicTasks();
  }));

  it('Buffer with same items set as previous should not be emitted', fakeAsync(() => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => bufferTime<string | undefined>(10)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    tick(10);
    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    tick(10);
    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);
  }));

});
