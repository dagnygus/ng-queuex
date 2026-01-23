import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { tap } from "./tap";
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

describe('Testing tap() function.', () => {

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

  it('Should throw error if it used outside cleanup scope.', () => {
    expect(() => tap(() => {})(signal(undefined))).toThrowError(
      'tap(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => tap(() => {})(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => tap<string | undefined>((value) => log.push(value.toLowerCase()))(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([ 'a', 'A', 'b', 'B', 'c', 'C' ]);
  })
});
