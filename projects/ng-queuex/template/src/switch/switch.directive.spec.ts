import { Attribute, Component, computed, Directive, DoCheck, OnChanges, PLATFORM_ID, provideZonelessChangeDetection, signal, TemplateRef, ViewChild } from "@angular/core";
import { provideQueuexSwitchDefaultPriority, QueuexSwitch, QueuexSwitchCase, QueuexSwitchDefault, syncWatch } from "./switch.directive";
import { setPostSignalSetFn } from "@angular/core/primitives/signals";
import { completeIntegrationForTest, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { defineGlobalFlag, describePriorityLevel } from "../utils/test_utils";
import { NgTemplateOutlet } from "@angular/common";

describe('Testing syncWatch() function.', () => {
  it('Should watch signal synchronously.', () => {
    const log: string[] = [];
    const source = signal('A');
    const watch = syncWatch(source, (value) => log.push(value));
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
    const watch = syncWatch(source, (value) => log.push(value));
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
    const watch1 = syncWatch(source1, (v) => log.push(v));
    const watch2 = syncWatch(source2, (v) => log.push(v));

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
    const watcher = syncWatch(derived, (value) => log.push(value));
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
    const watch1 = syncWatch(derived1, (v) => log.push(v));
    const watch2 = syncWatch(derived2, (v) => log.push(v));

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
    const watcher = syncWatch(derived, (value) => log.push(value));
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
    const watcher1 = syncWatch(source, (v) => log.push(v));
    const watcher2 = syncWatch(source, (v) => log.push(v));
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
    const watcher1 = syncWatch(derived, (v) => log.push(v));
    const watcher2 = syncWatch(derived, (v) => log.push(v));
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
    const watcher1 = syncWatch(source, (v) => log.push(v));
    const watcher2 = syncWatch(source, (v) => log.push(v));
    const watcher3 = syncWatch(source, (v) => log.push(v));
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
    const watcher1 = syncWatch(derived, (v) => log.push(v));
    const watcher2 = syncWatch(derived, (v) => log.push(v));
    const watcher3 = syncWatch(derived, (v) => log.push(v));
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
    const watcher1 = syncWatch(derived, (v) => log.push(v + '1'));
    const watcher2 = syncWatch(derived, (v) => log.push(v + '2'));
    expect(log).toEqual([ 'A1', 'A2' ]);
    source.set('B');
    expect(log).toEqual([ 'A1', 'A2', 'B1', 'B2' ]);
    expect(setPostSignalSetFn(null)).toBeNull();
    watcher1.destroy();
    watcher2.destroy();
  });
});

interface TestEnvironmentOptions {
  defaultPriority?: PriorityName | 'undefined',
  serverPlatform?: boolean,
  zoneless?: boolean,
}

const defaultTestEnvConfig: Required<TestEnvironmentOptions> = {
  defaultPriority: 'undefined',
  serverPlatform: false,
  zoneless: false,
}

const Priorities: PriorityLevel[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'text-cmp',
  standalone: false,
  template: ''
})
class TestComponent {
  valueSource = signal<any>(undefined);
  priorityLevel: PriorityLevel = 3;
  when1: any;
  when2: any;
  counter = signal(0)
  trueSource = signal(true);
  falseSource = signal(false);
  renderCb1: ((arg: any) => void) | null = null;
  renderCb2: ((arg: any) => void) | null = null;

  @ViewChild('foo', { static: true }) foo: TemplateRef<any> | null = null!
  @ViewChild('foo', { static: true }) bar: TemplateRef<any> | null = null!
}

@Directive({ selector: '[test-directive]', standalone: false })
class TestDirective implements DoCheck {
  checkCount = -1

  ngDoCheck(): void {
    this.checkCount++;
  }
}


let fixture: ComponentFixture<TestComponent> = null!;

function setupTestEnvironment(config?: TestEnvironmentOptions, extraDeclarations?: any[]): void {
  const { defaultPriority, serverPlatform, zoneless } = config ? {...defaultTestEnvConfig, ...config } : defaultTestEnvConfig;
  const providers: any[] = [provideNgQueuexIntegration()];
  if (defaultPriority !== 'undefined') {
    providers.push(provideQueuexSwitchDefaultPriority(defaultPriority));
  }
  if (zoneless) {
    providers.push(provideZonelessChangeDetection());
  }
  if (serverPlatform) {
    providers.push({ provide: PLATFORM_ID, useValue: 'server' });
  }

  let declarations: any[] = [TestComponent, TestDirective];
  if (extraDeclarations) {
    declarations = [...declarations, ...extraDeclarations];
  }

  TestBed.configureTestingModule({
    imports: [QueuexSwitch, QueuexSwitchCase, QueuexSwitchDefault, NgTemplateOutlet],
    declarations: declarations,
    providers: providers
  })
}

function resetTestEnvironment(): void {
  TestBed.resetTestingModule();
  fixture = null!;
}

function createTestComponent(template: string): void {
  TestBed
    .overrideComponent(TestComponent, { set: { template } })
    .runInInjectionContext(() => completeIntegrationForTest());

  fixture = TestBed.createComponent(TestComponent);
}

function getComponent(): TestComponent {
  return fixture.componentInstance;
}
function detectChanges(): void {
  fixture.detectChanges();
}

function getTextContent(): string {
  return fixture.nativeElement.textContent;
}
function expectTextContent(text: string): void {
  expect(getTextContent()).toBe(text);
}

function query(predicate: string): HTMLElement {
  return fixture.debugElement.query(By.css(predicate)).nativeElement;
}
function queryAll(predicate: string): HTMLElement[] {
  return fixture.debugElement.query(By.css(predicate)).nativeElement;
}
function getTestDirective(predicate: string): TestDirective {
  return fixture.debugElement.query(By.css(predicate)).injector.get(TestDirective)
}
function getAllTestDirectives(predicate: string): TestDirective[] {
  return fixture.debugElement.queryAll(By.css(predicate)).map((el) => el.injector.get(TestDirective));
}
function getQueuexSwitchDirective(predicate: string): QueuexSwitch<any> {
  return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexSwitch);
}

describe('QueuexSwitch directive.', () => {
  afterEach(() => resetTestEnvironment())

  it('Should have normal default priority.', async () => {
    const template = '<div [qxSwitch]="valueSource"></div>';
    setupTestEnvironment();
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    expect(getQueuexSwitchDirective('div').priority).toBe(Priority.Normal);
  });

  Priorities.forEach((priorityLevel) => {
    it('Should have default priority provided by injection.', async () => {
    const template = '<div [qxSwitch]="valueSource"></div>';
    setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    expect(getQueuexSwitchDirective('div').priority).toBe(priorityLevel);
    });
  });

  describe('Browser environment.', () => {
    beforeEach(() => setupTestEnvironment());

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {

        it('Should switch amongst when values.', async () => {
          const template =
            '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
              '<li *qxSwitchCase="\'a\'">when a</li>' +
              '<li *qxSwitchCase="\'b\'">when b</li>' +
            '</ul>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().valueSource.set('');
          detectChanges();
          expectTextContent('');

          await whenIdle();
          expectTextContent('');

          getComponent().valueSource.set('a');
          await whenIdle();
          expectTextContent('when a');

          getComponent().valueSource.set('b');
          await whenIdle();
          expectTextContent('when b');
        });

        it('Should switch amongst when values with fallback to default.', async () => {
          const template =
            '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
              '<li *qxSwitchCase="\'a\'">when a</li>' +
              '<li *qxSwitchDefault>when default</li>' +
            '</ul>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          detectChanges();
          expectTextContent('');

          await whenIdle();
          expectTextContent('when default');

          getComponent().valueSource.set('a');
          await whenIdle();
          expectTextContent('when a');

          getComponent().valueSource.set('b');
          await whenIdle();
          expectTextContent('when default');

          getComponent().valueSource.set('b');
          await whenIdle();
          expectTextContent('when default');
        });

        it('Should support multiple views whens with the same value.', async () => {
          const template =
            '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
              '<li *qxSwitchDefault>when default1;</li>' +
              '<li *qxSwitchCase="\'a\'">when a1;</li>' +
              '<li *qxSwitchCase="\'b\'">when b1;</li>' +
              '<li *qxSwitchCase="\'a\'">when a2;</li>' +
              '<li *qxSwitchCase="\'b\'">when b2;</li>' +
              '<li *qxSwitchDefault>when default2;</li>' +
            '</ul>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          detectChanges();
          expectTextContent('')

          await whenIdle();
          expectTextContent('when default1;when default2;');

          getComponent().valueSource.set('a');
          expectTextContent('when default1;when default2;');
          await whenIdle();
          expectTextContent('when a1;when a2;');

          getComponent().valueSource.set('b');
          expectTextContent('when a1;when a2;');
          await whenIdle();
          expectTextContent('when b1;when b2;');
        });

        it('Should use === to match cases', async () => {
          const template =
            '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
              '<li *qxSwitchCase="1">when one</li>' +
              '<li *qxSwitchDefault>when default</li>' +
            '</ul>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().valueSource.set(1);
          detectChanges();
          expectTextContent('');

          await whenIdle();
          expectTextContent('when one');

          getComponent().valueSource.set('1');
          expectTextContent('when one');
          await whenIdle();
          expectTextContent('when default');
        });
      });
    });

    describe('When values changes', () => {
      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {
          it('Should switch amongst when values.', async () => {
            const template =
              '<ul [qxSwitch]="valueSource" [priority]="priorityLevel"> ' +
                '<li *qxSwitchCase="when1">when 1;</li>' +
                '<li *qxSwitchCase="when2">when 2;</li>' +
                '<li *qxSwitchDefault>when default;</li>' +
              '</ul>';
            createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;
            getComponent().when1 = 'a';
            getComponent().when2 = 'b';
            getComponent().valueSource.set('a')
            detectChanges();

            await whenIdle();
            expectTextContent('when 1;');

            getComponent().valueSource.set('c');
            await whenIdle();
            expectTextContent('when default;')

            getComponent().when1 = 'c'
            detectChanges();
            await whenIdle();
            expectTextContent('when 1;');

            getComponent().when1 = 'd';
            detectChanges();
            await whenIdle();
            expectTextContent('when default;');
          });
        });
      });

      describe('Corner cases.', () => {
        Priorities.forEach((priorityLevel) => {
          describePriorityLevel(priorityLevel, () => {
            it('Should not crate default case if another case matches.', async () => {
              const log: string[] = [];

              @Directive({ selector: '[test]',  standalone: false})
              class TestDirective2 {
                constructor(@Attribute('test') test: string) {
                  log.push((test));
                }
              }

              resetTestEnvironment();
              setupTestEnvironment(defaultTestEnvConfig, [TestDirective2]);
              const template =
                '<div [qxSwitch]="valueSource" [priority]="priorityLevel">' +
                  '<div *qxSwitchCase="\'a\'" test="aCase"></div>' +
                  '<div *qxSwitchDefault test="defaultCase"></div>' +
                '</div>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              getComponent().valueSource.set('a');

              detectChanges();
              await whenIdle();

              expect(log).toEqual(['aCase'])
            });

            it('Should create default cases if there is no other cases.', async () => {
              const template =
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
                  '<li *qxSwitchDefault>when default1;</li>' +
                  '<li *qxSwitchDefault>when default2;</li>' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              getComponent().valueSource.set('a');

              detectChanges();
              await whenIdle();
              expectTextContent('when default1;when default2;');
            });

            it('Should allow defaults before cases', async () => {
              const template =
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
                '<li *qxSwitchDefault>when default1;</li>' +
                '<li *qxSwitchDefault>when default2;</li>' +
                '<li *qxSwitchCase="\'a\'">when a1;</li>' +
                '<li *qxSwitchCase="\'b\'">when b1;</li>' +
                '<li *qxSwitchCase="\'a\'">when a2;</li>' +
                '<li *qxSwitchCase="\'b\'">when b2;</li>' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              detectChanges();

              await whenIdle();
              expectTextContent('when default1;when default2;');

              getComponent().valueSource.set('a');
              await whenIdle();
              expectTextContent('when a1;when a2;');

              getComponent().valueSource.set('b');
              await whenIdle();
              expectTextContent('when b1;when b2;');
            });

            it('Should throw error when qxSwitchCase is used outside of qxSwitch.', async () => {
              const template =
                '<div [qxSwitch]="valueSource" [priority]="priorityLevel"></div>' +
                '<div *qxSwitchCase="\'a\'"></div>';
              expect(() => createTestComponent(template)).toThrowError(
                `An element with the "qxSwitchCase" attribute ` +
                `(matching the "QueuexSwitchCase" directive) must be located inside an element with the "qxSwitch" attribute ` +
                `(matching "QueuexSwitch" directive)`
              );
              await whenIdle();
            });

            it('Should throw error when qxSwitchDefault is used outside of qxSwitch.', async () => {
              const template =
                '<div [qxSwitch]="valueSource" [priority]="priorityLevel"></div>' +
                '<div *qxSwitchDefault></div>';
              expect(() => createTestComponent(template)).toThrowError(
                `An element with the "qxSwitchDefault" attribute ` +
                `(matching the "QueuexSwitchDefault" directive) must be located inside an element with the "qxSwitch" attribute ` +
                `(matching "QueuexSwitch" directive)`
              );
              await whenIdle();
            });

            it('Should support nested qxSwitch on ng-container with ngTemplateOutlet.', async () => {
              const template =
                '<div [qxSwitch]="valueSource" [priority]="priorityLevel">' +
                  '<ng-container *qxSwitchCase="\'case1\'" [qxSwitch]="trueSource" [priority]="priorityLevel"> ' +
                    '<ng-container *qxSwitchCase="true" [ngTemplateOutlet]="foo!"></ng-container>' +
                    '<span *qxSwitchDefault>Should never render</span>' +
                  '</ng-container>' +
                  '<ng-container *qxSwitchCase="\'case2\'" [qxSwitch]="trueSource" [priority]="priorityLevel">' +
                    '<ng-container *qxSwitchCase="true" [ngTemplateOutlet]="bar!"></ng-container>' +
                    '<span *qxSwitchDefault>Should never render</span>' +
                  '</ng-container>' +
                  '<ng-container *qxSwitchDefault [qxSwitch]="falseSource" [priority]="priorityLevel">' +
                    '<ng-container *qxSwitchCase="true" [ngTemplateOutlet]="foo!"></ng-container>' +
                    '<span *qxSwitchDefault>Default</span>' +
                  '</ng-container>' +
                '</div>' +
                '<ng-template #foo><span>Foo</span></ng-template>' +
                '<ng-template #bar><span>Bar</span></ng-template>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              getComponent().valueSource.set('case1');

              detectChanges();
              await whenIdle();
              expectTextContent('Foo');

              getComponent().valueSource.set('case2');
              await whenIdle();
              expectTextContent('Bar');

              getComponent().valueSource.set('notCase');
              await whenIdle();
              expectTextContent('Default');

              getComponent().valueSource.set('case1');
              await whenIdle();
              expectTextContent('Foo');
            });

          });
        });
      });
      ////////

      describe('Local change detection', () => {
        Priorities.forEach((priorityLevel) => {
          describePriorityLevel(priorityLevel, () => {
            it('Should trigger local change detection on ngSwitchCase embedded view if consumed signal will changed.', async () => {
              const template =
                '<span test-directive class="outer-test-dir"></span>' +
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
                  '<li *qxSwitchCase="\'a\'"><span test-directive class="inner-test-dir">{{counter()}}</span></li>' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              getComponent().valueSource.set('a');

              detectChanges();
              await whenIdle();
              expectTextContent('0');
              expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
              expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

              getComponent().counter.update((value) => ++value);
              await whenIdle();;
              expectTextContent('1');
              expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
              expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

              getComponent().counter.update((value) => ++value);
              await whenIdle();;
              expectTextContent('2');
              expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
              expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
            });

            it('Should trigger local change detection on ngSwitchDefault embedded view if consumed signal will changed.', async () => {
              const template =
                '<span test-directive class="outer-test-dir"></span>' +
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
                  '<li *qxSwitchDefault><span test-directive class="inner-test-dir">{{counter()}}</span></li>' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;

              detectChanges();
              await whenIdle();
              expectTextContent('0');
              expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
              expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

              getComponent().counter.update((value) => ++value);
              await whenIdle();;
              expectTextContent('1');
              expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
              expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

              getComponent().counter.update((value) => ++value);
              await whenIdle();;
              expectTextContent('2');
              expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
              expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
            });
          });
        });
      });

      // describe('Render event.', () => {
      //   [3].forEach((priorityLevel) => {

      //     describePriorityLevel(priorityLevel, () => {
      //       it('Should run render callback if qxSwitchCase template gets created or destroyed', async () => {
      //         const endDef = defineGlobalFlag('dag');
      //         const template =
      //           '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
      //             '<li *qxSwitchCase="\'a\'; renderCallback: renderCb1">when a;</li>' +
      //           '</ul>';
      //         createTestComponent(template);
      //         endDef();
      //         getComponent().priorityLevel = priorityLevel as any;
      //         getComponent().valueSource.set('a');
      //         const spy = jasmine.createSpy();
      //         getComponent().renderCb1 = spy;

      //         detectChanges();
      //         await whenIdle();
      //         expectTextContent('when a;')
      //         expect(spy.calls.count()).toBe(1);
      //         expect(spy.calls.mostRecent().args[0]).toBe('a');

      //       })
      //     })
      //   });
      // });
    });
  });

  describe('Server environment', () => {
    beforeEach(() => setupTestEnvironment({ serverPlatform: true }))

    it('Should switch amongst when values.', async () => {
      const template =
        '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
          '<li *qxSwitchCase="\'a\'">when a</li>' +
          '<li *qxSwitchCase="\'b\'">when b</li>' +
        '</ul>';
      createTestComponent(template);
      getComponent().valueSource.set('');
      detectChanges();
      expectTextContent('');

      detectChanges();
      expectTextContent('');

      getComponent().valueSource.set('a');
      detectChanges();
      expectTextContent('when a');

      getComponent().valueSource.set('b');
      detectChanges();
      expectTextContent('when b');
    });

    it('Should switch amongst when values with fallback to default.', async () => {
      const template =
        '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
          '<li *qxSwitchCase="\'a\'">when a</li>' +
          '<li *qxSwitchDefault>when default</li>' +
        '</ul>';
      createTestComponent(template);
      detectChanges();
      expectTextContent('when default');

      getComponent().valueSource.set('a');
      detectChanges();
      expectTextContent('when a');

      getComponent().valueSource.set('b');
      detectChanges();
      expectTextContent('when default');

      getComponent().valueSource.set('b');
      detectChanges();
      expectTextContent('when default');
    });

    it('Should support multiple views whens with the same value.', async () => {
      const template =
        '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
          '<li *qxSwitchDefault>when default1;</li>' +
          '<li *qxSwitchCase="\'a\'">when a1;</li>' +
          '<li *qxSwitchCase="\'b\'">when b1;</li>' +
          '<li *qxSwitchCase="\'a\'">when a2;</li>' +
          '<li *qxSwitchCase="\'b\'">when b2;</li>' +
          '<li *qxSwitchDefault>when default2;</li>' +
        '</ul>';
      createTestComponent(template);
      detectChanges();
      expectTextContent('when default1;when default2;');

      getComponent().valueSource.set('a');
      detectChanges();
      expectTextContent('when a1;when a2;');

      getComponent().valueSource.set('b');
      detectChanges();
      expectTextContent('when b1;when b2;');
    });

    it('Should use === to match cases', async () => {
      const template =
        '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
          '<li *qxSwitchCase="1">when one</li>' +
          '<li *qxSwitchDefault>when default</li>' +
        '</ul>';
      createTestComponent(template);
      getComponent().valueSource.set(1);
      detectChanges();
      expectTextContent('when one');

      getComponent().valueSource.set('1');
      detectChanges();
      expectTextContent('when default');
    });

    describe('When value changes', () => {
      it('Should switch amongst when values.', async () => {
        const template =
          '<ul [qxSwitch]="valueSource" [priority]="priorityLevel"> ' +
            '<li *qxSwitchCase="when1">when 1;</li>' +
            '<li *qxSwitchCase="when2">when 2;</li>' +
            '<li *qxSwitchDefault>when default;</li>' +
          '</ul>';
        createTestComponent(template);
        getComponent().when1 = 'a';
        getComponent().when2 = 'b';
        getComponent().valueSource.set('a')
        detectChanges();

        detectChanges();
        expectTextContent('when 1;');

        getComponent().valueSource.set('c');
        detectChanges();
        expectTextContent('when default;')

        getComponent().when1 = 'c'
        detectChanges();
        detectChanges();
        expectTextContent('when 1;');

        getComponent().when1 = 'd';
        detectChanges();
        detectChanges();
        expectTextContent('when default;');
      });
    });

    describe('Corner cases', () => {
      it('Should not crate default case if another case matches.', async () => {
        const log: string[] = [];

        @Directive({ selector: '[test]',  standalone: false})
        class TestDirective2 {
          constructor(@Attribute('test') test: string) {
            log.push((test));
          }
        }

        resetTestEnvironment();
        setupTestEnvironment({ serverPlatform: true }, [TestDirective2]);
        const template =
          '<div [qxSwitch]="valueSource" [priority]="priorityLevel">' +
            '<div *qxSwitchCase="\'a\'" test="aCase"></div>' +
            '<div *qxSwitchDefault test="defaultCase"></div>' +
          '</div>';
        createTestComponent(template);
        getComponent().valueSource.set('a');

        detectChanges();

        expect(log).toEqual(['aCase'])
      });

      it('Should create default cases if there is no other cases.', async () => {
        const template =
          '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
            '<li *qxSwitchDefault>when default1;</li>' +
            '<li *qxSwitchDefault>when default2;</li>' +
          '</ul>';
        createTestComponent(template);
        getComponent().valueSource.set('a');

        detectChanges();
        expectTextContent('when default1;when default2;');
      });

      it('Should allow defaults before cases', async () => {
        const template =
          '<ul [qxSwitch]="valueSource" [priority]="priorityLevel">' +
          '<li *qxSwitchDefault>when default1;</li>' +
          '<li *qxSwitchDefault>when default2;</li>' +
          '<li *qxSwitchCase="\'a\'">when a1;</li>' +
          '<li *qxSwitchCase="\'b\'">when b1;</li>' +
          '<li *qxSwitchCase="\'a\'">when a2;</li>' +
          '<li *qxSwitchCase="\'b\'">when b2;</li>' +
          '</ul>';
        createTestComponent(template);
        detectChanges();

        expectTextContent('when default1;when default2;');

        getComponent().valueSource.set('a');
        detectChanges();
        expectTextContent('when a1;when a2;');

        getComponent().valueSource.set('b');
        detectChanges();
        expectTextContent('when b1;when b2;');
      });

      it('Should throw error when qxSwitchCase is used outside of qxSwitch.', async () => {
        const template =
          '<div [qxSwitch]="valueSource" [priority]="priorityLevel"></div>' +
          '<div *qxSwitchCase="\'a\'"></div>';
        expect(() => createTestComponent(template)).toThrowError(
          `An element with the "qxSwitchCase" attribute ` +
          `(matching the "QueuexSwitchCase" directive) must be located inside an element with the "qxSwitch" attribute ` +
          `(matching "QueuexSwitch" directive)`
        );
      });

      it('Should throw error when qxSwitchDefault is used outside of qxSwitch.', async () => {
        const template =
          '<div [qxSwitch]="valueSource" [priority]="priorityLevel"></div>' +
          '<div *qxSwitchDefault></div>';
        expect(() => createTestComponent(template)).toThrowError(
          `An element with the "qxSwitchDefault" attribute ` +
          `(matching the "QueuexSwitchDefault" directive) must be located inside an element with the "qxSwitch" attribute ` +
          `(matching "QueuexSwitch" directive)`
        );
      });

      it('Should support nested qxSwitch on ng-container with ngTemplateOutlet.', async () => {
        const template =
          '<div [qxSwitch]="valueSource" [priority]="priorityLevel">' +
            '<ng-container *qxSwitchCase="\'case1\'" [qxSwitch]="trueSource" [priority]="priorityLevel"> ' +
              '<ng-container *qxSwitchCase="true" [ngTemplateOutlet]="foo!"></ng-container>' +
              '<span *qxSwitchDefault>Should never render</span>' +
            '</ng-container>' +
            '<ng-container *qxSwitchCase="\'case2\'" [qxSwitch]="trueSource" [priority]="priorityLevel">' +
              '<ng-container *qxSwitchCase="true" [ngTemplateOutlet]="bar!"></ng-container>' +
              '<span *qxSwitchDefault>Should never render</span>' +
            '</ng-container>' +
            '<ng-container *qxSwitchDefault [qxSwitch]="falseSource" [priority]="priorityLevel">' +
              '<ng-container *qxSwitchCase="true" [ngTemplateOutlet]="foo!"></ng-container>' +
              '<span *qxSwitchDefault>Default</span>' +
            '</ng-container>' +
          '</div>' +
          '<ng-template #foo><span>Foo</span></ng-template>' +
          '<ng-template #bar><span>Bar</span></ng-template>';
        createTestComponent(template);
        getComponent().valueSource.set('case1');

        detectChanges();
        expectTextContent('Foo');

        getComponent().valueSource.set('case2');
        detectChanges();
        expectTextContent('Bar');

        getComponent().valueSource.set('notCase');
        detectChanges();
        expectTextContent('Default');

        getComponent().valueSource.set('case1');
        detectChanges();
        expectTextContent('Foo');
      });
    })
  });
});
