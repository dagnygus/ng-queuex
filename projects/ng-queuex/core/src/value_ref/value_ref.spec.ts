import { computed, DestroyRef, Injector, runInInjectionContext, signal } from "@angular/core";
import { setPostSignalSetFn } from "@angular/core/primitives/signals";
import { value, watchSignal } from './value_ref'

describe('Testing watchSignal() function.', () => {
  it('Should watch signal synchronously.', () => {
    const log: string[] = [];
    const source = signal('A');
    const watch = watchSignal(source, (value) => log.push(value));
    log.push('B');
    source.set('C');
    log.push('D');
    expect(log).toEqual(['A','B','C','D']);
    expect(setPostSignalSetFn(null)).toBeNull();
    watch.destroy();
  });

  it('Should not watch when is destroyed.', () => {
    const log: string[] = [];
    const source = signal('A');
    const watch = watchSignal(source, (value) => log.push(value));
    watch.destroy();
    source.set('B');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
    source.set('C');
    expect(log).toEqual(['A']);
    expect(setPostSignalSetFn(null)).toBeNull();
  });

  it('Should watch two signals separately synchronously.', () => {
    const log: string[] = [];
    const source1 = signal('A');
    const source2 = signal('B');
    const watch1 = watchSignal(source1, (v) => log.push(v));
    const watch2 = watchSignal(source2, (v) => log.push(v));

    log.push('C');
    source1.set('D');
    log.push('E');
    source2.set('F');
    log.push('G');
    source1.set('H');
    source2.set('I');
    log.push('J');

    expect(log).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'
    ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watch1.destroy();
    watch2.destroy();
  });

  it('Should watch computed signal synchronously.', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source());
    const watcher = watchSignal(derived, (value) => log.push(value));
    log.push('B');
    source.set('C');
    log.push('D');
    expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
    expect(setPostSignalSetFn(null)).toEqual(null);
    watcher.destroy();
  });

  it('Should watch two computed signals separately synchronously.', () => {
    const log: string[] = [];
    const source1 = signal('A');
    const source2 = signal('B');
    const derived1 = computed(() => source1());
    const derived2 = computed(() => source2());
    const watch1 = watchSignal(derived1, (v) => log.push(v));
    const watch2 = watchSignal(derived2, (v) => log.push(v));

    log.push('C');
    source1.set('D');
    log.push('E');
    source2.set('F');
    log.push('G');
    source1.set('H');
    source2.set('I');
    log.push('J');

    expect(log).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'
    ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watch1.destroy();
    watch2.destroy();
  });

  it('Should watch computed signal form two source without any problem.', () => {
    const log: string[] = [];
    const source1 = signal('A');
    const source2 = signal('A');
    const derived = computed(() => source1() + source2());
    const watcher = watchSignal(derived, (value) => log.push(value));
    expect(log).toEqual(['AA']);
    source1.set('B');
    expect(log).toEqual([ 'AA', 'BA']);
    source2.set('B');
    expect(log).toEqual([ 'AA', 'BA', 'BB']);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher.destroy();
  });

  it('Should two watchers observe one signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    const watcher1 = watchSignal(source, (v) => log.push(v));
    const watcher2 = watchSignal(source, (v) => log.push(v));
    expect(log).toEqual([ 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
  });

  it('Should two watchers observe one computed signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source())
    const watcher1 = watchSignal(derived, (v) => log.push(v));
    const watcher2 = watchSignal(derived, (v) => log.push(v));
    expect(log).toEqual([ 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
  });

  it('Should three watchers observe one signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    const watcher1 = watchSignal(source, (v) => log.push(v));
    const watcher2 = watchSignal(source, (v) => log.push(v));
    const watcher3 = watchSignal(source, (v) => log.push(v));
    expect(log).toEqual([ 'A', 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'A', 'B', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
    watcher3.destroy();
  });

  it('Should three watchers observe one computed signal without any problem.', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source());
    const watcher1 = watchSignal(derived, (v) => log.push(v));
    const watcher2 = watchSignal(derived, (v) => log.push(v));
    const watcher3 = watchSignal(derived, (v) => log.push(v));
    expect(log).toEqual([ 'A', 'A', 'A' ]);
    source.set('B');
    expect(log).toEqual([ 'A', 'A', 'A', 'B', 'B', 'B' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
    watcher3.destroy();
  });

  it('Should two watchers observe shared source in correct order', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source())
    const watcher1 = watchSignal(derived, (v) => log.push(v + '1'));
    const watcher2 = watchSignal(derived, (v) => log.push(v + '2'));
    expect(log).toEqual([ 'A1', 'A2' ]);
    source.set('B');
    expect(log).toEqual([ 'A1', 'A2', 'B1', 'B2' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
  });

  it('Should three watchers observe shared source in correct order', () => {
    const log: string[] = [];
    const source = signal('A');
    const derived = computed(() => source())
    const watcher1 = watchSignal(derived, (v) => log.push(v + '1'));
    const watcher2 = watchSignal(derived, (v) => log.push(v + '2'));
    const watcher3 = watchSignal(derived, (v) => log.push(v + '3'));
    expect(log).toEqual([ 'A1', 'A2', 'A3' ]);
    source.set('B');
    expect(log).toEqual([ 'A1', 'A2', 'A3', 'B1', 'B2', 'B3' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
    watcher3.destroy();
  });

  it('Should two signals with multiple watchers works correctly', () => {
    const log: string[] = [];
    const source1 = signal('a');
    const source2 = signal('A');
    const watcher11 = watchSignal(source1, (v) => log.push(v + '1'));
    const watcher12 = watchSignal(source1, (v) => log.push(v + '2'));
    const watcher21 = watchSignal(source2, (v) => log.push(v + '1'));
    const watcher22 = watchSignal(source2, (v) => log.push(v + '2'));

    expect(log).toEqual([ 'a1', 'a2', 'A1', 'A2' ]);
    source1.set('b');
    source2.set('B');
    expect(log).toEqual([
      'a1', 'a2', 'A1', 'A2', 'b1', 'b2', 'B1', 'B2'
    ]);
    watcher11.destroy();
    watcher12.destroy();
    watcher21.destroy();
    watcher22.destroy();
  })
});

class FakeDestroyRef implements DestroyRef {
  private _destroyed = false;
  private _listeners: (() => void)[] = []

  public destroy() {
    while(this._listeners.length) {
      this._listeners.shift()!();
    }
    this._destroyed = true;
  }

  onDestroy(callback: () => void): () => void {
    if (this._destroyed) {
      return () => {};
    }
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

describe('Testing value() function', () => {

  let destroyRef: FakeDestroyRef;
  let injector: Injector;

  beforeEach(() => {
    destroyRef = new FakeDestroyRef;
    injector = Injector.create({ providers: [{ provide: DestroyRef, useValue: destroyRef }] })
  });
  afterEach(() => destroyRef.destroy());

  it('Should throw error when is called outside injection context and DestroyRef is not provided', () => {
    expect(() => value('a')).toThrowError(
      'NG0203: value() can only be used within an injection context such as a constructor, a factory function, ' +
      'a field initializer, or a function used with `runInInjectionContext`. ' +
      'Find more at https://v20.angular.dev/errors/NG0203'
    )
  });

  it('Should not throw an error when is \'DestroyRef\' is provided', () => {
    expect(() => value('a', destroyRef)).not.toThrowError();
  });

  it('Should not throw error when is called in injection context', () => {
    const injector = Injector.create({ providers: [{ provide: DestroyRef, useClass: FakeDestroyRef }] });
    runInInjectionContext(injector, () => {
      expect(() => value('a', destroyRef)).not.toThrowError();
    })
  });

  it('Should work with values correctly.', () => {
    runInInjectionContext(injector, () => {
      const valueRef = value('A')
      expect(valueRef.value).toBe('A');
      valueRef.set('B');
      expect(valueRef.value).toBe('B');
      valueRef.set('C');
      expect(valueRef.value).toBe('C');
    });
  });

  it('Should work with signal correctly.', () => {
    runInInjectionContext(injector, () => {
      const source = signal('A');
      const valueRef = value(source);
      expect(valueRef.value).toBe('A');
      source.set('B');
      expect(valueRef.value).toBe('B');
      source.set('C');
      expect(valueRef.value).toBe('C');
    });
  });

  it('Should switch from value to signal without any problem.', () => {
    runInInjectionContext(injector, () => {
      const valueRef = value('A');
      expect(valueRef.value).toBe('A');
      const source = signal('B');
      valueRef.set(source);
      expect(valueRef.value).toBe('B');
      source.set('C');
      expect(valueRef.value).toBe('C');
      source.set('D');
      expect(valueRef.value).toBe('D');
    });
  });

  it('Switching from signal to value should turned off any effects form previous provided signal.', () => {
    runInInjectionContext(injector, () => {
      const source = signal('A');
      const valueRef = value(source);
      expect(valueRef.value).toBe('A');
      source.set('B');
      expect(valueRef.value).toBe('B');
      valueRef.set('C');
      expect(valueRef.value).toBe('C');
      source.set('D');
      expect(valueRef.value).toBe('C');
      source.set('E');
      expect(valueRef.value).toBe('C');
    });
  });

  it('Switching from signal to signal should turned off any effects form previous provided signal.', () => {
     runInInjectionContext(injector, () => {
      const source1 = signal('A');
      const valueRef = value(source1);
      expect(valueRef.value).toBe('A');
      source1.set('B');
      expect(valueRef.value).toBe('B');
      const source2 = signal('C')
      valueRef.set(source2);
      expect(valueRef.value).toBe('C');
      source1.set('D');
      expect(valueRef.value).toBe('C');
      source1.set('E');
      expect(valueRef.value).toBe('C');
      source2.set('F');
      expect(valueRef.value).toBe('F');
    });
  })
});
