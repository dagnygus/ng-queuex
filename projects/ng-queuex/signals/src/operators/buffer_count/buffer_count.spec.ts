import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { bufferCount } from "./buffer_count";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
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

describe('Testing bufferCount() function', () => {
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
    const inputSource = signal(0);
    expect(() => bufferCount(5)(inputSource)).toThrowError(
      'bufferCount(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => bufferCount(5)(inputSource))).toThrowError());
  });

  it('Should buffer values to one element array where first array is empty.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(1)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);

    expect(log).toEqual([
      [],
      [ 0 ],
      [ 1 ],
      [ 2 ],
      [ 3 ],
      [ 4 ],
      [ 5 ],
    ])

  });

  it('Should buffer values to two element array where first array is empty.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(2)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);
    inputSource.set(8);
    inputSource.set(9);

    expect(log).toEqual([
      [],
      [ 0, 1 ],
      [ 2, 3 ],
      [ 4, 5 ],
      [ 6, 7 ],
      [ 8, 9 ],
    ]);
  });

  it('Should buffer values to three element array where first array is empty.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(3)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);
    inputSource.set(8);
    inputSource.set(9);
    inputSource.set(10);
    inputSource.set(11);
    inputSource.set(12);
    inputSource.set(13);
    inputSource.set(14);

    expect(log).toEqual([
      [],
      [ 0, 1, 2 ],
      [ 3, 4, 5 ],
      [ 6, 7, 8 ],
      [ 9, 10, 11 ],
      [ 12, 13, 14 ],
    ]);
  });

  it('Should buffer values to one element array where first array is empty, for specified buffer les then one.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(0.1)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);

    expect(log).toEqual([
      [],
      [ 0 ],
      [ 1 ],
      [ 2 ],
      [ 3 ],
      [ 4 ],
      [ 5 ],
    ])

  });


  it('Should buffer values to one element array where first array is empty for specified buffer bigger then one and less then 2.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(1.99999)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);

    expect(log).toEqual([
      [],
      [ 0 ],
      [ 1 ],
      [ 2 ],
      [ 3 ],
      [ 4 ],
      [ 5 ],
    ])

  });

  it('Should buffer values to two element array where first array is empty for specified buffer bigger then 2 less then 3.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(2.99999)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);
    inputSource.set(8);
    inputSource.set(9);

    expect(log).toEqual([
      [],
      [ 0, 1 ],
      [ 2, 3 ],
      [ 4, 5 ],
      [ 6, 7 ],
      [ 8, 9 ],
    ]);
  });

  it('Should buffer values to three element array where first array is empty for specified buffer bigger then 3 less then 4.', () => {
    const log: any[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(3.99999)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);
    inputSource.set(8);
    inputSource.set(9);
    inputSource.set(10);
    inputSource.set(11);
    inputSource.set(12);
    inputSource.set(13);
    inputSource.set(14);

    expect(log).toEqual([
      [],
      [ 0, 1, 2 ],
      [ 3, 4, 5 ],
      [ 6, 7, 8 ],
      [ 9, 10, 11 ],
      [ 12, 13, 14 ],
    ]);
  });

  it('Should starts next buffer after every second element of current three element buffer.', () => {
    const log: any[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(3, 2)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    inputSource.set('G');
    inputSource.set('H');
    inputSource.set('I');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
      [ 'C', 'D', 'E' ],
      [ 'E', 'F', 'G' ],
      [ 'G', 'H', 'I' ]
    ])
  });

  it('Should starts next buffer after every second element of current four element buffer.', () => {
    const log: any[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(4, 2)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    inputSource.set('G');
    inputSource.set('H');
    inputSource.set('I');
    inputSource.set('K');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C', 'D' ],
      [ 'C', 'D', 'E', 'F' ],
      [ 'E', 'F', 'G', 'H' ],
      [ 'G', 'H', 'I', 'K' ]
    ])
  });

  it('Should buffer values to two elements array and skips one emission in between.', () => {
    const log: any[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(2, 3)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    inputSource.set('G');
    inputSource.set('H');
    inputSource.set('I');
    inputSource.set('J');
    inputSource.set('K');

    expect(log).toEqual([
      [],
      [ 'A', 'B' ],
      [ 'D', 'E' ],
      [ 'G', 'H' ],
      [ 'J', 'K' ]
    ])
  });

  it('Buffer with same items set as previous should not be emitted.', () => {
    const log: any[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferCount(3)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);
  });

});
