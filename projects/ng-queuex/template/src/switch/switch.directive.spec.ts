import { Attribute, Component, Directive, DoCheck, PLATFORM_ID, provideZonelessChangeDetection, signal, TemplateRef, ViewChild } from "@angular/core";
import { provideQueuexSwitchDefaultPriority, QueuexSwitch, QueuexSwitchCase, QueuexSwitchDefault } from "./switch.directive";
import { completeIntegrationForTest, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { describePriorityLevel } from "../utils/test_utils";
import { NgTemplateOutlet } from "@angular/common";


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
// const Priorities: PriorityLevel[] = [3,];

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
  onRender: ((arg: any) => void) | null = null;


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
function whenStable(): Promise<unknown> {
  return fixture.whenStable();
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
function getQueuexSwitchDirective(predicate: string): QueuexSwitch {
  return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexSwitch);
}

describe('QueuexSwitch directive.', () => {
  afterEach(() => resetTestEnvironment());

  it('Should have normal default priority.', async () => {
    const template = '<div [qxSwitch]="valueSource"></div>';
    setupTestEnvironment();
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    //@ts-expect-error
    expect(getQueuexSwitchDirective('div')._priorityRef.value).toBe(Priority.Normal);
  });

  Priorities.forEach((priorityLevel) => {
    it('Should have default priority provided by injection.', async () => {
    const template = '<div [qxSwitch]="valueSource"></div>';
    setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    //@ts-expect-error
    expect(getQueuexSwitchDirective('div')._priorityRef.value).toBe(priorityLevel);
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

      describe('Render event.', () => {
        Priorities.forEach((priorityLevel) => {

          describePriorityLevel(priorityLevel, () => {
            it('Should emit render event if qxSwitchCase template gets created or destroyed', async () => {
              const template =
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel" (render)="onRender($event)">' +
                  '<li *qxSwitchCase="\'a\'">when a;</li>' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel as any;
              getComponent().valueSource.set('a');
              const spy = jasmine.createSpy();
              getComponent().onRender = spy;

              detectChanges();
              await whenIdle();
              expectTextContent('when a;')
              expect(spy.calls.count()).toBe(1);
              expect(spy.calls.mostRecent().args[0]).toBe('a');

              getComponent().valueSource.set('b');
              await whenIdle();
              expectTextContent('');
              expect(spy.calls.count()).toBe(2);
              expect(spy.calls.mostRecent().args[0]).toBe('b');

              getComponent().valueSource.set('a');
              await whenIdle();
              expectTextContent('when a;')
              expect(spy.calls.count()).toBe(3);
              expect(spy.calls.mostRecent().args[0]).toBe('a');
            });

            it('Should emit render event if view toggles.', async () => {
              const template =
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel" (render)="onRender($event)">' +
                  '<li *qxSwitchCase="\'a\'">when a;</li>' +
                  '<li *qxSwitchCase="\'b\'">when b;</li>' +
                  '<li *qxSwitchDefault>when default;</li>' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              getComponent().valueSource.set('a');
              const spy = jasmine.createSpy();
              getComponent().onRender = spy;

              detectChanges();
              await whenIdle();
              expectTextContent('when a;')
              expect(spy.calls.count()).toBe(1);
              expect(spy.calls.mostRecent().args[0]).toBe('a');

              getComponent().valueSource.set('b');
              await whenIdle();
              expectTextContent('when b;');
              expect(spy.calls.count()).toBe(2);
              expect(spy.calls.mostRecent().args[0]).toBe('b');

              getComponent().valueSource.set('c');
              await whenIdle();
              expectTextContent('when default;');
              expect(spy.calls.count()).toBe(3);
              expect(spy.calls.mostRecent().args[0]).toBe('c');

              getComponent().valueSource.set('d');
              await whenIdle();
              expectTextContent('when default;');
              expect(spy.calls.count()).toBe(3);
              expect(spy.calls.mostRecent().args[0]).toBe('c');
            });

            it('Should not emit render event if nothing gets created', async () => {
              const template =
                '<ul [qxSwitch]="valueSource" [priority]="priorityLevel" (render)="onRender($event)">' +
                '</ul>';
              createTestComponent(template);
              getComponent().priorityLevel = priorityLevel;
              getComponent().valueSource.set('a');
              const spy = jasmine.createSpy();
              getComponent().onRender = spy;

              detectChanges();
              await whenIdle();
              expectTextContent('')
              expect(spy.calls.count()).toBe(0);
            })
          });
        });
      });
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
        expectTextContent('when 1;');

        getComponent().valueSource.set('c');
        detectChanges();
        expectTextContent('when default;')

        getComponent().when1 = 'c'
        detectChanges();
        expectTextContent('when 1;');

        getComponent().when1 = 'd';
        detectChanges();
        expectTextContent('when default;');
      });

      it('Should switch amongst signals when values.', async () => {
        resetTestEnvironment();
        setupTestEnvironment({ serverPlatform: true, zoneless: true });
        const template =
          '<ul [qxSwitch]="valueSource" [priority]="priorityLevel"> ' +
            '<li *qxSwitchCase="when1">when 1;</li>' +
            '<li *qxSwitchCase="when2">when 2;</li>' +
            '<li *qxSwitchDefault>when default;</li>' +
          '</ul>';
        createTestComponent(template);
        getComponent().when1 = signal('a');
        getComponent().when2 = signal('b');
        getComponent().valueSource.set('a');

        await whenStable()
        expectTextContent('when 1;');

        getComponent().valueSource.set('c');
        await whenStable();
        expectTextContent('when default;')

        getComponent().when1.set('c');
        await whenStable();
        expectTextContent('when 1;');

        getComponent().when1.set('d');
        await whenStable();
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
