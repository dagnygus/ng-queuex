import { createWatch, SIGNAL } from "@angular/core/primitives/signals";
import { sharedSignal, SharedSignalRef } from "./shared_signal";
import { Component, Directive, inject, Input, OnInit, signal, TemplateRef, ViewContainerRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

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

@Directive({ selector: '[presenter]', standalone: false })
class Presenter implements OnInit {
  source = sharedSignal<any>(undefined);
  tmpRef = inject(TemplateRef);
  vcRef = inject(ViewContainerRef);

  @Input({ required: true }) set presenter(value: any) {
    this.source.set(value);
  }

  ngOnInit(): void {
    this.vcRef.createEmbeddedView(this.tmpRef, { $implicit: this.source.ref })
  }
}

@Component({
  selector: 'test-cmp',
  standalone: false,
  template: '<span *presenter="source; let v">{{v()}}</span>'
})
class TestComponent {
  source: any;
}

let fixture: ComponentFixture<TestComponent> = null!;

async function setupTestEnvironment(): Promise<void> {
  await TestBed.configureTestingModule({
    declarations: [TestComponent, Presenter]
  }).compileComponents();
  fixture = TestBed.createComponent(TestComponent);
}

function resetTestEnvironment(): void {
  TestBed.resetTestingModule();
  fixture = null!;
}

function detectChanges(): void {
  fixture.detectChanges();
}

function getComponent(): TestComponent {
  return fixture.componentInstance;
}
function expectTextContent(text: string): void {
  expect(fixture.nativeElement.textContent).toBe(text);
}

describe('Shared signals with component templates.', () => {
  beforeEach(() => setupTestEnvironment());
  afterEach(() => resetTestEnvironment());

  it('Should present content correctly.', () => {
    getComponent().source = 'A'
    detectChanges();
    expectTextContent('A');

    getComponent().source = 'B';
    detectChanges();
    expectTextContent('B');

    const source1 = signal('C')
    getComponent().source = source1;
    detectChanges();
    expectTextContent('C');

    source1.set('D');
    detectChanges();
    expectTextContent('D');

    const source2 = signal('E');
    getComponent().source = source2;
    detectChanges();
    expectTextContent('E');

    source2.set('F');
    detectChanges();
    expectTextContent('F');

    getComponent().source = 'G';
    detectChanges();
    expectTextContent('G');
  })
})
