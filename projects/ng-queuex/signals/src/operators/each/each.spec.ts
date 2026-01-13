import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { each } from "./each";
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

class Collection<T> implements Iterable<T> {

  private readonly _arr: T[]

  public constructor(...args: T[]) {
    this._arr = args;
  }

  [Symbol.iterator](): Iterator<T, any, any> {
    function* generator(arr: T[]) {
      for (let i = 0; i < arr.length; i++) {
        yield arr[i];
      }
    }

    return generator(this._arr);
  }

}

describe('Testing each() function.', () => {

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
    expect(() => each()(signal([]))).toThrowError(
      'each(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => each()(signal([])))).toThrowError());
  });

  it('Should project output signals correctly for arrays correctly.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string[] | undefined>(undefined);
    const outputSource = scope.run(() => each<string, string[] | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set([ 'A' ]);
    expect(log).toEqual([ 'A' ]);
    inputSource.set([ 'B', 'C' ]);
    expect(log).toEqual([ 'A', 'B', 'C' ]);
    inputSource.set([ 'D', 'E', 'F' ]);
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F' ]);
    inputSource.set([ 'G', 'H', 'I', 'J' ]);
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J' ]);
  });

  it('Should project output signal correctly for custom iterables.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<Iterable<string> | undefined>(undefined);
    const outputSource = scope.run(() => each<string, Iterable<string> | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(new Collection('A'));
    expect(log).toEqual([ 'A' ]);
    inputSource.set(new Collection('B', 'C'));
    expect(log).toEqual([ 'A', 'B', 'C' ]);
    inputSource.set(new Collection('D', 'E', 'F'));
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F' ]);
    inputSource.set(new Collection('G', 'H', 'I', 'J'));
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J' ]);
  });

  it('Should project output signal correctly for arrays and custom iterables', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<Iterable<string> | undefined>(undefined);
    const outputSource = scope.run(() => each<string, Iterable<string> | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set([ 'A' ]);
    expect(log).toEqual([ 'A' ]);
    inputSource.set(new Collection('B', 'C'));
    expect(log).toEqual([ 'A', 'B', 'C' ]);
    inputSource.set([ 'D', 'E', 'F' ]);
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F' ]);
    inputSource.set(new Collection('G', 'H', 'I', 'J'));
    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J' ]);
  });

  it('Should throw error if emitted source array contains undefined value.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<(string | undefined)[] | undefined>(undefined);
    const outputSource = scope.run(() => each<string | undefined, (string | undefined)[] | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    expect(() => inputSource.set(['A', 'B', undefined, 'C'])).toThrowError('each() operator: Source collection contains undefined value.');
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should throw error if emitted source custom iterable contains undefined value.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<Collection<string | undefined> | undefined>(undefined);
    const outputSource = scope.run(() => each<string | undefined, Collection<string | undefined> | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    expect(() => inputSource.set(new Collection('A', 'B', undefined, 'C'))).toThrowError('each() operator: Source collection contains undefined value.');
    expect(log).toEqual([ 'A', 'B' ]);
  });

});
