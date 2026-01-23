import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { sample } from "./sample";
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

describe('Testing sample() function.', () => {
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
    expect(() => sample(signal(undefined))(signal(undefined))).toThrowError(
      'sample(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => sample(signal(undefined))(signal(undefined)))).toThrowError());
  });

  it('Should emit the most recent value.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const notifier = signal(0);
    const outputSource = scope.run(() => sample<string | undefined>(notifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    notifier.update((v) => ++v);
    inputSource.set('B');
    inputSource.set('C');
    notifier.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    notifier.update((v) => ++v);

    expect(log).toEqual([ 'A', 'C', 'F' ]);
  });

  it('Should not emit latest value more then one time.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const notifier = signal(0);
    const outputSource = scope.run(() => sample<string | undefined>(notifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    notifier.update((v) => ++v);
    notifier.update((v) => ++v);

    expect(log).toEqual([ 'A' ]);
  });
});
