import { createWatch, SIGNAL } from "@angular/core/primitives/signals";
import { sharedSignal, SharedSignalRef } from "./shared_signal";
import { signal } from "@angular/core";

interface ManualEffectRef {
  runEffect(): void;
  destroy(): void;
}

function manualEffect(effectFn: () => void): ManualEffectRef {
  const watch = createWatch(
    effectFn,
    () => {},
    false
  )

  const node =  watch[SIGNAL]

  const effectRef = {
    __node__: node,
    __watch__: watch,
    runEffect() {
      if (this.__node__.dirty) {
        this.__watch__.run();
      }
    },
    destroy(): void {
      this.__watch__.destroy();
    }
  }

  watch.notify();
  watch.run();

  return effectRef;
}

describe('Shared signal', () => {
  let log: string[];
  let signalRef: SharedSignalRef<any>;
  let effect: ManualEffectRef
  beforeEach(() => {
    log = [];
    signalRef = sharedSignal(undefined);
    effect = manualEffect(() => {
      const value = signalRef.ref();
      if (typeof value === 'undefined') { return; }
      log.push(value);
    });
  });

  afterEach(() => {
    effect.destroy();
  })

  function expectLog(arg: any[]): void {
    expect(log).toEqual(arg);
  }

  it('Should work with values correctly.', () => {
    signalRef.set('A');
    effect.runEffect();

    signalRef.set('B');
    effect.runEffect();

    signalRef.set('B');
    effect.runEffect();

    signalRef.set('C');
    effect.runEffect();

    expectLog(['A', 'B', 'C']);
  });

  it('Should work with signal correctly.', () => {
    const source = signal('A');

    signalRef.set(source)
    effect.runEffect();

    source.set('B');
    effect.runEffect();

    source.set('B');
    effect.runEffect();

    source.set('C');
    effect.runEffect();

    expectLog(['A', 'B', 'C']);
  });

  it('Switching from signal to value should turn off any effects from previous provided signal.', () => {
    const source = signal('A');

    signalRef.set(source)
    effect.runEffect();

    signalRef.set('B');
    effect.runEffect();

    source.set('C');
    effect.runEffect();
    source.set('D');
    effect.runEffect();

    signalRef.set('E');
    effect.runEffect();

    expectLog(['A', 'B', 'E']);
  });

  it('Switching form signal to signal should turn of any effects from previous provided signal.', () => {
    const source1 = signal('A');

    signalRef.set(source1);
    effect.runEffect();

    const source2 = signal('B');
    signalRef.set(source2);
    effect.runEffect();

    source1.set('C');
    effect.runEffect();
    source1.set('D');
    effect.runEffect();

    source2.set('E');
    effect.runEffect();

    expectLog(['A', 'B', 'E']);
  })
});
