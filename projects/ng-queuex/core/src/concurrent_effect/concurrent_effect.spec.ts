import { SIGNAL, Watch } from "@angular/core/primitives/signals";
import { noopFn, PriorityLevel } from "../scheduler/scheduler_utils";
import { concurrentEffect } from "./concurrent_effect";
import { DestroyRef, EffectRef, Injector, PLATFORM_ID, runInInjectionContext, signal } from "@angular/core";
import { fakeAsync, flush, TestBed } from "@angular/core/testing";
import { completeIntegrationForTest, INTEGRATION_NOT_COMPLETED_MESSAGE, INTEGRATION_NOT_PROVIDED_MESSAGE, provideNgQueuexIntegration, SERVER_SIDE_MESSAGE } from "../environment/environment";
import { whenIdle } from "../core";

function expectWatcherDestroyed(effectRef: any) {
  expect(effectRef._watcher[SIGNAL].fn == null).toBeTrue();
}

const Priorities: PriorityLevel[] = [1, 2, 3, 4, 5];

class TestDestroyRef implements DestroyRef {

  private _destroyed = false;
  private _listeners: (() => void)[] = [];

  destroy(): void {
    this._destroyed = true;
    while(this._listeners.length) {
      this._listeners.shift()!();
    }
  }

  onDestroy(callback: () => void): () => void {
    if (this._destroyed) { return noopFn; }
    this._listeners.push(callback);
    return () => {
      const index = this._listeners.indexOf(callback);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    }
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

}

describe('Testing concurrentEffect() function.', () => {

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()]
    }).runInInjectionContext(() => {
      completeIntegrationForTest();
    })
  })

  it('Should throw error if when is not in injection context and no options are provided', () => {
    expect(() => {
      let watcher: EffectRef | undefined;
      try {
        watcher = concurrentEffect(() => {})
      } finally {
        if (watcher) {
          watcher.destroy();
        }
      }
    }).toThrowError(
      'NG0203: concurrentEffect() can only be used within an injection context such as a constructor, a factory function, a field initializer, or a ' +
      'function used with `runInInjectionContext`. Find more at https://v20.angular.dev/errors/NG0203'
    );
  });

  it('Should not to throw error if manual cleanup is true', () => {
    expect(() => {
      let watcher: EffectRef | undefined;
      try {
        watcher = concurrentEffect(() => {}, { manualCleanup: true })
      } finally {
        if (watcher) {
          watcher.destroy();
          expectWatcherDestroyed(watcher);
        }
      }
    }).not.toThrowError();
  });

  it('Should not throw error if destroyRef is provided.', () => {
    expect(() => {
      const destroyRef = new TestDestroyRef();
      let watcher: EffectRef | undefined
      try {
        watcher = concurrentEffect(() => {}, { destroyRef })
      } finally {
        destroyRef.destroy();
        expectWatcherDestroyed(watcher);
      }
    }).not.toThrowError();
  });

  it('Should not throw error if is in injection context.', () => {
    const injector = Injector.create({ providers: [] });
    expect(() => {
      let watcher: EffectRef | undefined
      try {
        runInInjectionContext(injector, () => {
          watcher =  concurrentEffect(() => {}, { destroyRef: injector.get(DestroyRef) })
        })
      } finally {
        injector.destroy();
        expectWatcherDestroyed(watcher);
      }
    }).not.toThrowError();
  });

  it('Should throw error if signal is written in effect callback and allowSignalWrites is not set to true.', fakeAsync(() => {
    const someSignal = signal('A');
    const watcher = concurrentEffect(() => {
      someSignal.set('B');
    }, { manualCleanup: true });

    expect(() => flush()).toThrowError('NG0600: Writing to signals is not allowed in a `computed`');

    watcher.destroy();
  }));

  it('Should not throw error if signal is written in effect callback and allowSignalWrites is not set true.', fakeAsync(() => {
    const someSignal = signal('A');
    const watcher = concurrentEffect(() => {
      someSignal.set('B');
    }, { manualCleanup: true, allowSignalWrites: true });

    expect(() => flush()).not.toThrowError();

    watcher.destroy();
  }));

  it('Should throw error if ng-queuex integration is not provided', () => {
    TestBed.resetTestingModule();
    expect(() => concurrentEffect(() => {}, { manualCleanup: true }))
      .toThrowError('concurrentEffect(): ' + INTEGRATION_NOT_PROVIDED_MESSAGE);
  });

  it('Should throw error if is used on server', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration(), { provide: PLATFORM_ID, useValue: 'server' }]
    }).runInInjectionContext(() => completeIntegrationForTest());
    expect(() => concurrentEffect(() => {}, { manualCleanup: true }))
      .toThrowError('concurrentEffect(): ' + SERVER_SIDE_MESSAGE);
  });

  it('Should throw error if integration is not completed.', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()]
    }).runInInjectionContext(() => {});
    expect(() => concurrentEffect(() => {}, { manualCleanup: true }))
      .toThrowError('concurrentEffect(): ' + INTEGRATION_NOT_COMPLETED_MESSAGE);
  })

  it('Should schedule and run effect if signal changed.', async () => {
    const log: string[] = [];
    const someSignal = signal('A');
    const watcher = concurrentEffect(() => {
      log.push(someSignal());
    }, { manualCleanup: true });

    await whenIdle();
    someSignal.set('B');
    await whenIdle();
    someSignal.set('C');
    await whenIdle();
    expect(log).toEqual(['A', 'B', 'C']);
    watcher.destroy();
  });

});
