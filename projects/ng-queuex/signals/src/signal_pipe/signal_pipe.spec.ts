import { assertNotInReactiveContext, computed, DestroyableInjector, DestroyRef, Injector, isSignal, runInInjectionContext, Signal, signal } from '@angular/core';
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation, consumerDestroy } from '@angular/core/primitives/signals';
import { signalPipe } from './signal_pipe';
import { CleanupScope, createTestCleanupScope } from '../cleanup_scope/cleanup_scope';
import { subscribe } from '../subscribe/subscribe'

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

describe('Testing signalPipe() function', () => {
  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  })

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
  })

  function runInTestInjectionContext(fn: VoidFunction): void {
    runInInjectionContext(injector, fn);
  }

  it('isSignal() should return true', () => {
    runInTestInjectionContext(() => {
      const source = signalPipe(signal('A'), []);
      expect(isSignal(source)).toBeTrue();
    });
  });

  it('Should throw error when signal is created outside injection context', () => {
    expect(() => signalPipe(signal('A'), [])).toThrowError();
  });

  it('Should not throw error if injector is provided to options.', () => {
    expect(() => signalPipe(signal('A'), [], { injector })).not.toThrowError();
  });

  it('Should not throw error when signal is created in cleanup scope.', () => {
    const scope = createTestCleanupScope({ injector });
    scope.run(() => {
      expect(() => signalPipe(signal('A'), [])).not.toThrowError();
    });
  });

  it('Should throw error when signal is read outside reactive context (or cleanup scope)', () => {
    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(signal('A'), []);
    });

    expect(() => source()).toThrowError(
      'Signal created by signalPipe() can not read outside required context. It ' +
      'This signal can only be used appropriately in a reactive context like effect() or ' +
      'component template. It can be also used in cleanup scope provided by signalPipe().'
    );
  });

  it('Should not throw error when is read inside reactive context', () => {
    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(signal('A'), []);
    });
    const consumer = runInReactiveContext(() => {
      expect(() => source()).not.toThrowError();
    });
    consumerDestroy(consumer);
  });

  it('Should not throw error when is read inside cleanup scope', () => {
    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(signal('A'), []);
    });
    const scope = createTestCleanupScope({ injector });
    scope.run(() => {
      expect(() => source()).not.toThrowError();
    });

    scope.cleanup();
  });

  it('Should run operator functions when it is read in first reactive context', () => {
    const log: string[] = [];

    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal('A'),
        [
          (s: Signal<string>) => {
            log.push(s())
            return signal('B');
          },
          (s: Signal<string>) => {
            log.push(s());
            return s;
          }
        ]
      );
    });

    expect(log).toEqual([]);
    subscribe(source, () => {}, destroyRef);
    expect(log).toEqual([ 'A', 'B' ]);
    subscribe(source, () => {}, destroyRef);
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should run operator functions when its read in first cleanup scope', () => {
    const log: string[] = [];

    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal('A'),
        [
          (s: Signal<string>) => {
            log.push(s())
            return signal('B');
          },
          (s: Signal<string>) => {
            log.push(s());
            return s;
          }
        ]
      );
    });

    const scope1 = createTestCleanupScope({ injector });
    const scope2 = createTestCleanupScope({ injector });

    expect(log).toEqual([]);
    scope1.run(() => source());
    expect(log).toEqual([ 'A', 'B' ]);
    scope2.run(() => source());
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should not run operator functions when its read in first cleanup scope fallowing a reactive context read.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal('A'),
        [
          (s: Signal<string>) => {
            log.push(s())
            return signal('B');
          },
          (s: Signal<string>) => {
            log.push(s());
            return s;
          }
        ]
      );
    });

    const scope = createTestCleanupScope({ injector });

    expect(log).toEqual([]);
    scope.run(() => source());
    expect(log).toEqual([ 'A', 'B' ]);
    subscribe(source, () => {}, destroyRef);
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should not run operator functions when its read in first reactive context fallowing a cleanup scope context read.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal('A'),
        [
          (s: Signal<string>) => {
            log.push(s())
            return signal('B');
          },
          (s: Signal<string>) => {
            log.push(s());
            return s;
          }
        ]
      );
    });

    const scope = createTestCleanupScope({ injector });

    expect(log).toEqual([]);
    subscribe(source, () => {}, destroyRef);
    expect(log).toEqual([ 'A', 'B' ]);
    scope.run(() => source());
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Operator function should run outside reactive context', () => {
    const log: string[] = [];

    let source: Signal<string> = null!
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal('A'),
        [
          (s: Signal<string>) => {
            assertNotInReactiveContext(signalPipe)
            log.push(s())
            return signal('B');
          },
        ]
      );
    });


    subscribe(source, () => {}, destroyRef);
    expect(log).toEqual([ 'A' ]);
  });

  it('Operator function should run inside cleanup scope.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal('A'),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent();
            log.push(s())
            return signal('B');
          },
        ]
      );
    });


    subscribe(source, () => {}, destroyRef);
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic when last reactive consumer gets destroyed!', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal(''),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent().add(() => log.push('A'))
            return s;
          }
        ]
      );
    });

    const unsubscribe1 = subscribe(source, () => {}, destroyRef);
    const unsubscribe2 = subscribe(source, () => {}, destroyRef);

    expect(log).toEqual([]);
    unsubscribe1();
    expect(log).toEqual([]);
    unsubscribe2();
    expect(log).toEqual(['A'])
  });

  it('Should run cleanup logic when last cleanup scope gets clean.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal(''),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent().add(() => log.push('A'));
            return s;
          }
        ]
      );
    });

    const scope1 = createTestCleanupScope({ injector });
    const scope2 = createTestCleanupScope({ injector });

    scope1.run(() => source());
    scope2.run(() => source());

    expect(log).toEqual([]);
    scope1.cleanup();
    expect(log).toEqual([]);
    scope2.cleanup();
    expect(log).toEqual(['A']);
  });

  it('Should run cleanup logic when reactive consumer gets destroyed fallowed by cleanup scope cleanup.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal(''),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent().add(() => log.push('A'));
            return s;
          }
        ]
      );
    });

    const scope = createTestCleanupScope({ injector });

    scope.run(() => source());
    const unsubscribe = subscribe(source, () => {}, destroyRef);

    expect(log).toEqual([]);
    scope.cleanup();
    expect(log).toEqual([]);
    unsubscribe();
    expect(log).toEqual(['A']);
  });

  it('Should run cleanup logic when cleanup scope gets cleaned fallowed by reactive consumer destruction.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal(''),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent().add(() => log.push('A'));
            return s;
          }
        ]
      );
    });

    const scope = createTestCleanupScope({ injector });

    scope.run(() => source());
    const unsubscribe = subscribe(source, () => {}, destroyRef);

    expect(log).toEqual([]);
    unsubscribe();
    expect(log).toEqual([]);
    scope.cleanup();
    expect(log).toEqual(['A']);
  });

  it('Should run cleanup logic when the signal is destroyed by the injection context that created it.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        signal(''),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent().add(() => log.push('A'));
            return s;
          }
        ]
      );
    });

    const consumer =  runInReactiveContext(() => source());

    expect(log).toEqual([]);
    injector.destroy();
    expect(log).toEqual(['A']);
    consumerDestroy(consumer);
  });

  it('Should run cleanup logic when the signal is destroyed by the cleanup scope that created it.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope({ injector });
    let source: Signal<string> = null!;
    scope.run(() => {
      source = signalPipe(
        signal(''),
        [
          (s: Signal<string>) => {
            CleanupScope.assertCurrent().add(() => log.push('A'));
            return s;
          }
        ]
      );
    });

    const consumer =  runInReactiveContext(() => source());
    expect(log).toEqual([]);
    scope.cleanup();
    expect(log).toEqual(['A']);
    consumerDestroy(consumer);
  });

  it('Should throw an error when the signal is read for the first time after it has been destroyed.', () => {
    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(signal('A'), []);
    });
    injector.destroy();

    expect(() => runInReactiveContext(() => source())).toThrowError('Signal pipe was destroyed before the first read! Computation is impossible.');
  });

  it('Should not throw an error when the signal is read after it has been destroyed, as long as it had already been read before.', () => {
    const log: string[] = [];

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(signal('A'), []);
    });

    const consumer = runInReactiveContext(() => log.push(source()));
    expect(log).toEqual(['A'])
    injector.destroy();
    consumerDestroy(consumer);

    expect(() => {
      const consumer = runInReactiveContext(() => log.push(source()));
      consumerDestroy(consumer);
    }).not.toThrowError();

    expect(log).toEqual(['A', 'A']);
  });

  it('Should work correctly with single operator.', () => {
    const log: number[] = [];
    const innerSource = signal(0);

    let source: Signal<number> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        innerSource,
        [
          (s: Signal<number>) => {
            return computed(() => 2 * s());
          }
        ]
      );
    });

    subscribe(source, (value) => log.push(value), destroyRef);
    innerSource.set(1);
    innerSource.set(2);
    innerSource.set(3);

    expect(log).toEqual([ 0, 2, 4, 6 ]);
  });

  it('Should work correctly with multiple operators', () => {
    const log: string[] = [];
    const innerSource = signal(0);

    let source: Signal<string> = null!;
    runInTestInjectionContext(() => {
      source = signalPipe(
        innerSource,
        [
          (s: Signal<number>) => {
            return computed(() => 2 * s());
          },
          (s: Signal<number>) => {
            return computed(() => String(s()));
          }
        ]
      );
    });

    subscribe(source, (value) => log.push(value), destroyRef);
    innerSource.set(1);
    innerSource.set(2);
    innerSource.set(3);

    expect(log).toEqual([ '0', '2', '4', '6' ]);
  });
});
