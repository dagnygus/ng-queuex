import { computed, signal } from '@angular/core';
import { CleanupScope, createTestCleanupScope } from '../../cleanup_scope/cleanup_scope';
import { map } from './map';
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from '@angular/core/primitives/signals';

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

describe('Testing map() function', () => {

  it('Should throw an error if it is used outside of a cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => map<undefined, undefined>(() => undefined)(inputSource)).toThrowError(
      'map(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used in reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => {
      map(() => undefined)(inputSource);
    })).toThrowError())
  });

  it('Should project output signal correctly', () => {
    const log: string[] = []
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    const outputSource = scope.run(() => map<number, string>((value) => String(2 * value))(inputSource));

    log.push(outputSource());
    inputSource.set(1);
    log.push(outputSource());
    inputSource.set(2);
    log.push(outputSource());
    inputSource.set(3);
    log.push(outputSource());

    expect(log).toEqual([ '0', '2', '4', '6' ]);
  });

  it('Should run project() function in child cleanup scope.', () => {
    const log: string[] = []
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    const outputSource = scope.run(() => map<number, number>((value) => {
      expect(scope.children().length).toBe(1)
      expect(CleanupScope.current()).toBe(scope.children()[0] as any)
      log.push('A')
      return value
    })(inputSource));

    outputSource();
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic on every new project function call.', () => {
    const log: string[] = []
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    const outputSource = scope.run(() => map<number, number>((value) => {
      CleanupScope.assertCurrent().add(() => log.push('A'))
      return value
    })(inputSource));

    outputSource();
    expect(log).toEqual([]);

    inputSource.set(1);
    outputSource();
    expect(log).toEqual([ 'A' ]);

    inputSource.set(2);
    outputSource();
    expect(log).toEqual([ 'A', 'A' ]);
  });

  it('Should run cleanup logic after user immediate cleanup call.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    });
    const outputSource = scope.run(() => map<number, number>((value) => value)(inputSource));
    outputSource();

    expect(log).toEqual([ 'A' ]);
  });
});
