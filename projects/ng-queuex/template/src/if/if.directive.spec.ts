import { ChangeDetectionStrategy, Component, Directive, DoCheck, PLATFORM_ID, provideZonelessChangeDetection, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideQxIfDefaultPriority, QueuexIf } from "./if.directive";
import { By } from "@angular/platform-browser";
import { completeIntegrationForTest, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { defineGlobalFlag, describePriorityLevel } from "../utils/test_utils";

interface TestEnvironmentOptions {
  defaultPriority?: PriorityName | 'undefined';
  zoneless?: boolean;
  serverPlatform?: boolean
}

const defaultTestEnvConfig: Required<TestEnvironmentOptions> = {
  defaultPriority: 'undefined',
  zoneless: false,
  serverPlatform: false
}

@Component({
  selector: 'test-cmp',
  template: '',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {

  conditionSource: WritableSignal<any> = signal(true);
  nestedConditionSource: WritableSignal<any> = signal(true);
  priorityLevel: PriorityLevel = 3;
  valueSource1: WritableSignal<any> = signal('foo');
  valueSource2: WritableSignal<any> = signal('foo');
  renderCallback: (() => void) | null = null;
}

@Directive({ selector: '[test-directive]', standalone: false })
class TestDirective implements DoCheck {
  checkCount = -1;

  constructor() {}

  ngDoCheck(): void {
    this.checkCount++;
  }
}

const Priorities: PriorityLevel[] = [1, 2, 3, 4, 5];

function createTestComponent(template: string, changeDetection: ChangeDetectionStrategy = ChangeDetectionStrategy.OnPush): ComponentFixture<TestComponent> {
  TestBed
    .overrideComponent(TestComponent, { set: { template, changeDetection } })
    .runInInjectionContext(() => completeIntegrationForTest());
  return TestBed.createComponent(TestComponent);
}


describe('QueuexIf directive.', () => {

  let fixture: ComponentFixture<TestComponent>

  function getComponent(): TestComponent {
    return fixture.componentInstance
  }
  function query(predicate: string): HTMLElement {
    return fixture.debugElement.query(By.css(predicate)).nativeElement;
  }
  function queryAll(predicate: string): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css(predicate)).map((debugEl) => debugEl.nativeElement);
  }
  function getQxIfDirective(predicate: string): QueuexIf {
    return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexIf)
  }
  function getTestDirective(predicate: string): TestDirective {
    return fixture.debugElement.query(By.css(predicate)).injector.get(TestDirective)
  }
  function getTextContent(): string {
    return fixture.nativeElement.textContent;
  }

  function setupTestEnvironment(config?: TestEnvironmentOptions) {
    const localConfig = config ? { ...defaultTestEnvConfig, ...config } : defaultTestEnvConfig;
    const providers: any[] = [provideNgQueuexIntegration()];

    if (localConfig.defaultPriority !== 'undefined') {
      providers.push(provideQxIfDefaultPriority(localConfig.defaultPriority));
    }

    if (localConfig.zoneless) {
      providers.push(provideZonelessChangeDetection());
    }

    if (localConfig.serverPlatform) {
      providers.push({ provide: PLATFORM_ID, useValue: 'server' });
    }

    TestBed.configureTestingModule({
      imports: [QueuexIf],
      declarations: [TestComponent, TestDirective],
      providers,
    });
  }

  function resetTestEnvironment(): void {
    TestBed.resetTestingModule();
  }

  afterEach(() => {
    fixture = null!;
    resetTestEnvironment()
  });

  describe('Browser environment.', () => {

    beforeEach(() => {
      setupTestEnvironment()
    });


    it('Default priority should be normal.', async () => {
      const template = '<span *qxIf="conditionSource"></span>';
      fixture = createTestComponent(template);
      fixture.detectChanges();
      await whenIdle();
      const directive = getQxIfDirective('span');
      expect(directive.qxIfPriority).toBe(Priority.Normal);
    });

    it('Should throw error if qxIf input is not signal', async () => {
      const template = '<span *qxIf="conditionSource()"></span>';
      fixture = createTestComponent(template);
      expect(() => fixture.detectChanges()).toThrowError(
        '\'qxIf\' must be a signal, but received \'boolean\''
      );
      await whenIdle();
    });

    Priorities.forEach((priorityLevel) => {

      describePriorityLevel(priorityLevel, () => {
        it('Should have the default priority set by injection.', async () => {
          setupTestEnvironment();
          setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as PriorityName });
          const template = '<span *qxIf="conditionSource"></span>';
          fixture = createTestComponent(template);
          fixture.detectChanges();
          await whenIdle();
          const directive = getQxIfDirective('span');
          expect(directive.qxIfPriority).toBe(priorityLevel);
        });

        it('Should work in a template attribute.', async () => {
          const template = '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>'
          fixture = createTestComponent(template);

          getComponent().priorityLevel = priorityLevel;
          fixture.detectChanges();
          expect(getTextContent()).toBe('');

          await whenIdle();
          expect(queryAll('span').length).toBe(1);
          expect(query('span').textContent).toBe('HELLO');
          expect(getTextContent()).toBe('HELLO');
        });

        it('Should work on a template element.', async () => {
          const template = '<ng-template [qxIf]="conditionSource" [qxIfPriority]="priorityLevel"><span class="greeter">HELLO</span></ng-template>';
          fixture = createTestComponent(template);

          getComponent().priorityLevel = priorityLevel;
          fixture.detectChanges();
          expect(getTextContent()).toBe('');

          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(query('span').textContent).toBe('HELLO');
          expect(getTextContent()).toBe('HELLO');
        });

        it('Should toggle node when condition changes.', async () => {
          const template = '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>';
          fixture = createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;

          getComponent().conditionSource.set(false);
          fixture.detectChanges();
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');

          getComponent().conditionSource.set(true);
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');

          getComponent().conditionSource.set('');
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');

          getComponent().conditionSource.set('A');
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');

          getComponent().conditionSource.set(0);
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');

          getComponent().conditionSource.set(1);
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');

          getComponent().conditionSource.set(null);
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');

          getComponent().conditionSource.set({});
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');

          getComponent().conditionSource.set(undefined);
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(0);
          expect(getTextContent()).toBe('');
        });

        it('Should handle nested if correctly', async () => {
          const template =
          '<div *qxIf="conditionSource; priority: priorityLevel">' +
            '<span *qxIf="nestedConditionSource; priority: priorityLevel">HELLO</span>' +
          '</div>'
          fixture = createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;

          getComponent().conditionSource.set(false);
          fixture.detectChanges();
          await whenIdle();
          expect(queryAll('div').length).toBe(0);
          expect(queryAll('span').length).toBe(0);
          expect(getTextContent()).toBe('');

          getComponent().conditionSource.set(true);
          await whenIdle();
          expect(queryAll('div').length).toBe(1);
          expect(queryAll('span').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');

          getComponent().nestedConditionSource.set(false)
          await whenIdle()
          expect(queryAll('div').length).toBe(1);
          expect(queryAll('span').length).toBe(0);
          expect(getTextContent()).toBe('');

          getComponent().nestedConditionSource.set(true)
          await whenIdle();
          expect(queryAll('div').length).toBe(1);
          expect(queryAll('span').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');

          getComponent().conditionSource.set(false);
          await whenIdle();
          expect(queryAll('div').length).toBe(0);
          expect(queryAll('span').length).toBe(0);
          expect(getTextContent()).toBe('');

        });

        it('Should not add element twice if condition goes from truthy to truthy', async () => {
          const template = '<span *qxIf="conditionSource; priority: priorityLevel">HELLO</span>';
          fixture = createTestComponent(template);
          getComponent().priorityLevel = priorityLevel

          getComponent().conditionSource.set(1);
          fixture.detectChanges();
          await whenIdle();

          let els = queryAll('span');
          expect(els.length).toBe(1);
          els[0].classList.add('marker');

          getComponent().conditionSource.set(2);
          await whenIdle();
          els = queryAll('span');
          expect(els.length).toBe(1);
          expect(els[0].classList.contains('marker')).toBeTrue();
        });

        it('Should not trigger change detection toggle node.', async () => {
          const template =
            '<div>' +
              '<span test-directive></span>' +
              '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>' +
            '</div>';

            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle();
            expect(queryAll('span.greeter').length).toBe(1);
            expect(getTextContent()).toBe('HELLO');
            expect(getTestDirective('span[test-directive]').checkCount).toBe(0);

            getComponent().conditionSource.set(false);
            await whenIdle();
            expect(queryAll('span.greeter').length).toBe(0);
            expect(getTextContent()).toBe('');
            expect(getTestDirective('span[test-directive]').checkCount).toBe(0);

            getComponent().conditionSource.set(true);
            await whenIdle()
            expect(queryAll('span.greeter').length).toBe(1);
            expect(getTextContent()).toBe('HELLO');
            expect(getTestDirective('span[test-directive]').checkCount).toBe(0);

            await fixture.whenStable();
            expect(getTestDirective('span[test-directive]').checkCount).toBe(0);
        });

        it('Should not trigger local change detection when condition goes from truthy to truthy.', async () => {
          const template =
            '<div *qxIf="conditionSource">' +
              '<span test-directive></span>' +
              '<span class="greeter">HELLO</span>' +
            '</div>'

          fixture = createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().conditionSource.set('A');

          fixture.detectChanges();
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          expect(getTestDirective('span[test-directive]').checkCount).toBe(0);

          getComponent().conditionSource.set('B');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          expect(getTestDirective('span[test-directive]').checkCount).toBe(0);

          getComponent().conditionSource.set('C');
          await whenIdle();
          expect(queryAll('span.greeter').length).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          expect(getTestDirective('span[test-directive]').checkCount).toBe(0);

          await fixture.whenStable();
          expect(getTestDirective('span[test-directive]').checkCount).toBe(0);
        });

        it('Change detection cycle should not enter to embedded view.', async () => {
          const template =
            '<span test-directive class="outer-test-dir"></span>' +
            '<div *qxIf="conditionSource; priority: priorityLevel">' +
              '<span test-directive class="inner-test-dir"></span>' +
            '</div>'
          fixture = createTestComponent(template, ChangeDetectionStrategy.Default);
          getComponent().priorityLevel = priorityLevel;

          fixture.detectChanges();
          await whenIdle();
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

          fixture.detectChanges();
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(1);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

          fixture.detectChanges();
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(2);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);
        })

        it('Should trigger local change detection if consumed signal in template has change.', async () => {
          const template =
            '<div>' +
              '<span test-directive class="outer-test-dir"></span> ' +
              '<div *qxIf="conditionSource; priority: priorityLevel">' +
                '<span test-directive class="inner-test-dir"></span>' +
                '<span class="slot1">{{valueSource1()}}</span>' +
                '<span class="slot2">{{valueSource2()}}</span>' +
              '</div>' +
            '</div>';

          fixture = createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;

          fixture.detectChanges();
          await whenIdle();

          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);
          expect(query('span.slot1').textContent).toBe('foo');
          expect(query('span.slot2').textContent).toBe('foo');

          getComponent().valueSource1.set('bar')
          await whenIdle();
          await fixture.whenStable()
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);
          expect(query('span.slot1').textContent).toBe('bar');
          expect(query('span.slot2').textContent).toBe('foo');

          getComponent().valueSource1.set('fizz')
          await whenIdle();
          await fixture.whenStable()
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
          expect(query('span.slot1').textContent).toBe('fizz');
          expect(query('span.slot2').textContent).toBe('foo');

          getComponent().valueSource2.set('bar')
          await whenIdle();
          await fixture.whenStable()
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(3);
          expect(query('span.slot1').textContent).toBe('fizz');
          expect(query('span.slot2').textContent).toBe('bar');

          getComponent().valueSource2.set('fizz')
          await whenIdle();
          await fixture.whenStable()
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(4);
          expect(query('span.slot1').textContent).toBe('fizz');
          expect(query('span.slot2').textContent).toBe('fizz');

          await fixture.whenStable();
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(4);
        });

        it('Should call render callback if embedded view gets created.', async () => {
          const template = '<span *qxIf="conditionSource; renderCallback: renderCallback">HELLO</span>';
          fixture = createTestComponent(template);
          getComponent().conditionSource.set(false);
          const spy = jasmine.createSpy();
          getComponent().renderCallback = spy;

          fixture.detectChanges();
          expect(getTextContent()).toBe('');
          expect(spy.calls.count()).toBe(0);

          await whenIdle();
          expect(getTextContent()).toBe('');
          expect(spy.calls.count()).toBe(0);

          getComponent().conditionSource.set(true);
          await whenIdle();
          expect(getTextContent()).toBe('HELLO');
          expect(spy.calls.count()).toBe(1);
        });

        it('Should call render callback when embedded view gets destroyed.', async () => {
          const template = '<span *qxIf="conditionSource; renderCallback: renderCallback">HELLO</span>';
          fixture = createTestComponent(template);
          const spy = jasmine.createSpy();
          getComponent().renderCallback = spy;

          fixture.detectChanges();
          await whenIdle();
          spy.calls.reset();
          expect(getTextContent()).toBe('HELLO');

          getComponent().conditionSource.set(false);
          await whenIdle();
          expect(getTextContent()).toBe('')
          expect(spy.calls.count()).toBe(1);
        });

        it('Should argument passed to render callback be equal qxIf input', async () => {
          const template = '<span *qxIf="conditionSource; renderCallback: renderCallback">HELLO</span>';
          fixture = createTestComponent(template);
          getComponent().conditionSource.set(true);
          const spy = jasmine.createSpy();
          getComponent().renderCallback = spy;

          fixture.detectChanges();
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe(true);

          getComponent().conditionSource.set(false);
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBeFalse();

          getComponent().conditionSource.set('A');
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe('A');

          getComponent().conditionSource.set(undefined);
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe(undefined);

          getComponent().conditionSource.set(1);
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe(1);

          getComponent().conditionSource.set(0);
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe(0);

          const obj = {}
          getComponent().conditionSource.set(obj);
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe(obj);

          getComponent().conditionSource.set(null);
          await whenIdle();
          expect(spy.calls.mostRecent().args[0]).toBe(null);
        })
      });

    });

    describe('Then/else templates.', () => {
      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Should support else.', async () => {
            const template =
              '<span *qxIf="conditionSource; priority: priorityLevel; else elseBlock">TRUE</span>' +
              '<ng-template #elseBlock>FALSE</ng-template>';
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('TRUE');

            getComponent().conditionSource.set(false);
            await whenIdle();
            expect(getTextContent()).toBe('FALSE');
          });

          it('Should support then and else.', async () => {
            const template =
              '<span *qxIf="conditionSource then thenBlock else elseBlock; priority: priorityLevel">IGNORE</span>' +
              '<ng-template #thenBlock>TRUE</ng-template>' +
              '<ng-template #elseBlock>FALSE</ng-template>';
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('TRUE')

            getComponent().conditionSource.set(false);
            await whenIdle();
            expect(getTextContent()).toBe('FALSE');
          });

          it('Should remove then/else template.', async () => {
            const template =
              '<span ' +
                '*qxIf="conditionSource;' +
                'then nestedConditionSource() ? tmpRef : null;' +
                'else nestedConditionSource() ? tmpRef : null;' +
                'priority: priorityLevel"></span>' +
              '<ng-template #tmpRef>TEMPLATE</ng-template>';
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle()
            expect(getTextContent()).toBe('TEMPLATE');

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            expect(getTextContent()).toBe('TEMPLATE');
            await whenIdle();
            expect(getTextContent()).toBe('');

            getComponent().conditionSource.set(false);
            getComponent().nestedConditionSource.set(true);
            fixture.detectChanges();
            expect(getTextContent()).toBe('');
            await whenIdle();
            expect(getTextContent()).toBe('TEMPLATE');

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            expect(getTextContent()).toBe('TEMPLATE');
            await whenIdle();
            expect(getTextContent()).toBe('');
          });

          it('Should support dynamic else.', async () => {
            const template =
              '<span ' +
                '*qxIf="conditionSource;' +
                'else nestedConditionSource() ? elseBlock1 : elseBlock2;' +
                'priority: priorityLevel">TRUE</span>' +
              '<ng-template #elseBlock1>FALSE1</ng-template>' +
              '<ng-template #elseBlock2>FALSE2</ng-template>';
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('TRUE');

            getComponent().conditionSource.set(false);
            await whenIdle();
            expect(getTextContent()).toBe('FALSE1');

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            expect(getTextContent()).toBe('FALSE1');
            await whenIdle();
            expect(getTextContent()).toBe('FALSE2');
          });

          it('Should support binding to variable using let.', async () => {
            const template =
              '<span *qxIf="conditionSource; else elseBlock; priority: priorityLevel; let v;">{{v()}}</span>' +
              '<ng-template #elseBlock let-v>{{v()}}</ng-template>'
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('true');

            getComponent().conditionSource.set(false);
            expect(getTextContent()).toBe('true');
            await whenIdle();
            expect(getTextContent()).toBe('false');
          });

          it('Should support binding to variable using as.', async () => {
            const template =
              '<span *qxIf="conditionSource as v; else elseBlock; priority: priorityLevel">{{v()}}</span>' +
              '<ng-template #elseBlock let-v>{{v()}}</ng-template>'
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;

            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('true');

            getComponent().conditionSource.set(false);
            expect(getTextContent()).toBe('true');
            await whenIdle();
            expect(getTextContent()).toBe('false');
          });

          it('Should not add element twice if condition goes from falsy to false.', async () => {
            const template =
              '<span *qxIf="conditionSource else elseBlock; priority: priorityLevel"></span>' +
              '<ng-template #elseBlock>' +
                '<span class="false"></span>' +
              '</ng-template>';
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;
            getComponent().conditionSource.set(false);

            fixture.detectChanges();
            await whenIdle();
            let els = queryAll('span.false');
            expect(els.length).toBe(1);
            els[0].classList.add('marker');

            getComponent().conditionSource.set(null);
            await whenIdle();
            els = queryAll('span.false');
            expect(els.length).toBe(1);
            els[0].classList.add('marker');
          });

          it('Should not trigger local change detection if conditions goes form falsy to falsy.', async () => {
            const template =
              '<div *qxIf="conditionSource else elseBlock; priority: priorityLevel"></div>' +
              '<ng-template #elseBlock>' +
                '<div>' +
                  '<span class="test-dir" test-directive></span>' +
                  '<span class="greeter">HELLO</span>' +
                '</div>' +
              '</ng-template>'
            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;
            getComponent().conditionSource.set(false);

            fixture.detectChanges();
            await whenIdle();
            expect(query('span.greeter').textContent).toBe('HELLO');
            expect(getTestDirective('span.test-dir').checkCount).toBe(0);

            getComponent().conditionSource.set(null);
            await whenIdle();
            expect(query('span.greeter').textContent).toBe('HELLO');
            expect(getTestDirective('span.test-dir').checkCount).toBe(0);

            getComponent().conditionSource.set('');
            await whenIdle();
            expect(query('span.greeter').textContent).toBe('HELLO');
            expect(getTestDirective('span.test-dir').checkCount).toBe(0);
          });

          it('Should trigger local change detection in else template if consumed signal has change', async () => {
            const template =
              '<div *qxIf="conditionSource else elseBlock; priority: priorityLevel"></div>' +
              '<span test-directive class="outer-test-dir"></span> ' +
              '<ng-template #elseBlock>' +
                '<div>FURRY' +
                  '<div>' +
                    '<span test-directive class="inner-test-dir"></span>' +
                    '<span class="slot1">{{valueSource1()}}</span>' +
                    '<span class="slot2">{{valueSource2()}}</span>' +
                  '</div>' +
                '</div>' +
              '</ng-template>';

            fixture = createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;
            getComponent().conditionSource.set(false);

            fixture.detectChanges();
            await whenIdle();

            expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
            expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);
            expect(query('span.slot1').textContent).toBe('foo');
            expect(query('span.slot2').textContent).toBe('foo');

            getComponent().valueSource1.set('bar')
            await whenIdle();
            await fixture.whenStable()
            expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
            expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);
            expect(query('span.slot1').textContent).toBe('bar');
            expect(query('span.slot2').textContent).toBe('foo');

            getComponent().valueSource1.set('fizz')
            await whenIdle();
            await fixture.whenStable()
            expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
            expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
            expect(query('span.slot1').textContent).toBe('fizz');
            expect(query('span.slot2').textContent).toBe('foo');

            getComponent().valueSource2.set('bar')
            await whenIdle();
            await fixture.whenStable()
            expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
            expect(getTestDirective('span.inner-test-dir').checkCount).toBe(3);
            expect(query('span.slot1').textContent).toBe('fizz');
            expect(query('span.slot2').textContent).toBe('bar');

            getComponent().valueSource2.set('fizz')
            await whenIdle();
            await fixture.whenStable()
            expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
            expect(getTestDirective('span.inner-test-dir').checkCount).toBe(4);
            expect(query('span.slot1').textContent).toBe('fizz');
            expect(query('span.slot2').textContent).toBe('fizz');

            await fixture.whenStable();
            expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
            expect(getTestDirective('span.inner-test-dir').checkCount).toBe(4);
          });

          it('Should call render callback if thenTemplate will change and condition is truthy.', async () => {
            const template =
              '<span *qxIf="conditionSource then nestedConditionSource() ? thenBlock1 : thenBlock2; renderCallback: renderCallback"></span>' +
              '<ng-template #thenBlock1><span>THEN1</span></ng-template>' +
              '<ng-template #thenBlock2><span>THEN2</span></ng-template>';
            fixture = createTestComponent(template);
            const spy = jasmine.createSpy();
            getComponent().renderCallback = spy;
            fixture.detectChanges()
            await whenIdle();
            expect(getTextContent()).toBe('THEN1');
            spy.calls.reset();

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            expect(spy.calls.count()).toBe(0);
            await whenIdle();
            expect(getTextContent()).toBe('THEN2');
            expect(spy.calls.count()).toBe(1);
          });

          it('Should not call render callback if thenTemplate will change and condition is falsy.', async () => {
            const template =
              '<span *qxIf="conditionSource then nestedConditionSource() ? thenBlock1 : thenBlock2; renderCallback: renderCallback"></span>' +
              '<ng-template #thenBlock1><span>THEN1</span></ng-template>' +
              '<ng-template #thenBlock2><span>THEN2</span></ng-template>';
            fixture = createTestComponent(template);
            const spy = jasmine.createSpy();
            getComponent().renderCallback = spy;
            getComponent().conditionSource.set(false);
            fixture.detectChanges()
            await whenIdle();
            expect(getTextContent()).toBe('');
            spy.calls.reset();

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            expect(spy.calls.count()).toBe(0);
            await whenIdle();
            expect(getTextContent()).toBe('');
            expect(spy.calls.count()).toBe(0);
          });

          it('Should run render callback if elseTemplate will change and condition is falsy', async () => {
            const template =
              '<span *qxIf="conditionSource else nestedConditionSource() ? elseBlock1 : elseBlock2; renderCallback: renderCallback"></span>' +
              '<ng-template #elseBlock1><span>ELSE1</span></ng-template>' +
              '<ng-template #elseBlock2><span>ELSE2</span></ng-template>';
            fixture = createTestComponent(template);
            const spy = jasmine.createSpy();
            getComponent().renderCallback = spy;
            getComponent().conditionSource.set(false);
            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('ELSE1');
            spy.calls.reset();

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('ELSE2');
            expect(spy.calls.count()).toBe(1);
          });

          it('Should not run render callback if elseTemplate will change and condition is truthy', async () => {
            const template =
              '<span *qxIf="conditionSource else nestedConditionSource() ? elseBlock1 : elseBlock2; renderCallback: renderCallback"></span>' +
              '<ng-template #elseBlock1><span>ELSE1</span></ng-template>' +
              '<ng-template #elseBlock2><span>ELSE2</span></ng-template>';
            fixture = createTestComponent(template);
            const spy = jasmine.createSpy();
            getComponent().renderCallback = spy;
            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('');
            spy.calls.reset();

            getComponent().nestedConditionSource.set(false);
            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('');
            expect(spy.calls.count()).toBe(0);
          });

          it('Should run render callback if view toggled.', async () => {
            const template =
              '<span *qxIf="conditionSource else elseBlock; renderCallback: renderCallback">THEN</span>' +
              '<ng-template #elseBlock><span>ELSE</span></ng-template>';
            fixture = createTestComponent(template);
            const spy = jasmine.createSpy();
            getComponent().renderCallback = spy;
            fixture.detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('THEN');
            spy.calls.reset();

            getComponent().conditionSource.set(false);
            await whenIdle();
            expect(getTextContent()).toBe('ELSE');
            expect(spy.calls.count()).toBe(1);

            getComponent().conditionSource.set(true);
            await whenIdle();
            expect(getTextContent()).toBe('THEN');
            expect(spy.calls.count()).toBe(2);
          });

        });
      });
    });
  });

  describe('Server environment with zone change detection.', () => {
    beforeEach(() => {
      setupTestEnvironment({ serverPlatform: true })
    });

    it('Should work in a template attribute.', () => {
      const template = '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>'
      fixture = createTestComponent(template);
      fixture.detectChanges();
      expect(queryAll('span').length).toBe(1);
      expect(query('span').textContent).toBe('HELLO');
      expect(getTextContent()).toBe('HELLO');
    });

    it('Should work on a template element.', () => {
      const template = '<ng-template [qxIf]="conditionSource" [qxIfPriority]="priorityLevel"><span class="greeter">HELLO</span></ng-template>';
      fixture = createTestComponent(template);

      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(query('span').textContent).toBe('HELLO');
      expect(getTextContent()).toBe('HELLO');
    });

    it('Should toggle node when condition changes.', () => {
      const template = '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>';
      fixture = createTestComponent(template);

      getComponent().conditionSource.set(false);
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set(true);
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set('');
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set('A');
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(0);
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set(1);
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(null);
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set({});
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(undefined);
      fixture.detectChanges();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');
    });

    it('Should handle nested if correctly', () => {
      const template =
      '<div *qxIf="conditionSource; priority: priorityLevel">' +
        '<span *qxIf="nestedConditionSource; priority: priorityLevel">HELLO</span>' +
      '</div>'
      fixture = createTestComponent(template);

      getComponent().conditionSource.set(false);
      fixture.detectChanges();
      expect(queryAll('div').length).toBe(0);
      expect(queryAll('span').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set(true);
      fixture.detectChanges();
      expect(queryAll('div').length).toBe(1);
      expect(queryAll('span').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().nestedConditionSource.set(false)
      fixture.detectChanges();
      expect(queryAll('div').length).toBe(1);
      expect(queryAll('span').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().nestedConditionSource.set(true)
      fixture.detectChanges();
      expect(queryAll('div').length).toBe(1);
      expect(queryAll('span').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(false);
      fixture.detectChanges();
      expect(queryAll('div').length).toBe(0);
      expect(queryAll('span').length).toBe(0);
      expect(getTextContent()).toBe('');

    });

    it('Should not add element twice if condition goes from truthy to truthy', () => {
      const template = '<span *qxIf="conditionSource; priority: priorityLevel">HELLO</span>';
      fixture = createTestComponent(template);

      getComponent().conditionSource.set(1);
      fixture.detectChanges();

      let els = queryAll('span');
      expect(els.length).toBe(1);
      els[0].classList.add('marker');

      getComponent().conditionSource.set(2);
      fixture.detectChanges();
      els = queryAll('span');
      expect(els.length).toBe(1);
      expect(els[0].classList.contains('marker')).toBeTrue();
    });


    describe('Then/else templates.', () => {

      it('Should support else.', () => {
        const template =
          '<span *qxIf="conditionSource; priority: priorityLevel; else elseBlock">TRUE</span>' +
          '<ng-template #elseBlock>FALSE</ng-template>';
        fixture = createTestComponent(template);

        fixture.detectChanges();
        expect(getTextContent()).toBe('TRUE');

        getComponent().conditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('FALSE');
      });

      it('Should support then and else.', () => {
        const template =
          '<span *qxIf="conditionSource then thenBlock else elseBlock; priority: priorityLevel">IGNORE</span>' +
          '<ng-template #thenBlock>TRUE</ng-template>' +
          '<ng-template #elseBlock>FALSE</ng-template>';
        fixture = createTestComponent(template);

        fixture.detectChanges();
        expect(getTextContent()).toBe('TRUE')

        getComponent().conditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('FALSE');
      });

      it('Should remove then/else template.', () => {
        const template =
          '<span ' +
            '*qxIf="conditionSource;' +
            'then nestedConditionSource() ? tmpRef : null;' +
            'else nestedConditionSource() ? tmpRef : null;' +
            'priority: priorityLevel"></span>' +
          '<ng-template #tmpRef>TEMPLATE</ng-template>';
        fixture = createTestComponent(template);

        fixture.detectChanges();
        expect(getTextContent()).toBe('TEMPLATE');

        getComponent().nestedConditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('');

        getComponent().conditionSource.set(false);
        getComponent().nestedConditionSource.set(true);
        fixture.detectChanges();
        expect(getTextContent()).toBe('TEMPLATE');

        getComponent().nestedConditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('');
      });

      it('Should support dynamic else.', () => {
        const template =
          '<span ' +
            '*qxIf="conditionSource;' +
            'else nestedConditionSource() ? elseBlock1 : elseBlock2;' +
            'priority: priorityLevel">TRUE</span>' +
          '<ng-template #elseBlock1>FALSE1</ng-template>' +
          '<ng-template #elseBlock2>FALSE2</ng-template>';
        fixture = createTestComponent(template);

        fixture.detectChanges();
        expect(getTextContent()).toBe('TRUE');

        getComponent().conditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('FALSE1');

        getComponent().nestedConditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('FALSE2');
      });

      it('Should support binding to variable using let.', () => {
        const template =
          '<span *qxIf="conditionSource; else elseBlock; priority: priorityLevel; let v;">{{v()}}</span>' +
          '<ng-template #elseBlock let-v>{{v()}}</ng-template>'
        fixture = createTestComponent(template);

        fixture.detectChanges();
        expect(getTextContent()).toBe('true');

        getComponent().conditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('false');
      });

      it('SHould support binding to variable using as.', () => {
        const template =
          '<span *qxIf="conditionSource as v; else elseBlock; priority: priorityLevel">{{v()}}</span>' +
          '<ng-template #elseBlock let-v>{{v()}}</ng-template>'
        fixture = createTestComponent(template);

        fixture.detectChanges();
        expect(getTextContent()).toBe('true');

        getComponent().conditionSource.set(false);
        fixture.detectChanges();
        expect(getTextContent()).toBe('false');
      });

      it('Should not add element twice if condition goes from falsy to false.', () => {
        const template =
          '<span *qxIf="conditionSource else elseBlock; priority: priorityLevel"></span>' +
          '<ng-template #elseBlock>' +
            '<span class="false"></span>' +
          '</ng-template>';
        fixture = createTestComponent(template);
        getComponent().conditionSource.set(false);

        fixture.detectChanges();
        let els = queryAll('span.false');
        expect(els.length).toBe(1);
        els[0].classList.add('marker');

        getComponent().conditionSource.set(null);
        fixture.detectChanges();
        els = queryAll('span.false');
        expect(els.length).toBe(1);
        els[0].classList.add('marker');
      });

    });
  });

    describe('Server environment with zoneless change detection.', () => {
    beforeEach(() => {
      setupTestEnvironment({ serverPlatform: true, zoneless: true });
    });

    async function whenStable(): Promise<void> {
      if (!fixture.isStable()) {
        await fixture.whenStable()
      }
    }

    it('Should work in a template attribute.', async () => {
      const template = '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>'
      fixture = createTestComponent(template);
      await whenStable();
      expect(queryAll('span').length).toBe(1);
      expect(query('span').textContent).toBe('HELLO');
      expect(getTextContent()).toBe('HELLO');
    });

    it('Should work on a template element.', async () => {
      const template = '<ng-template [qxIf]="conditionSource" [qxIfPriority]="priorityLevel"><span class="greeter">HELLO</span></ng-template>';
      fixture = createTestComponent(template);

      await whenStable();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(query('span').textContent).toBe('HELLO');
      expect(getTextContent()).toBe('HELLO');
    });

    it('Should toggle node when condition changes.', async () => {
      const template = '<span class="greeter" *qxIf="conditionSource; priority: priorityLevel">HELLO</span>';
      fixture = createTestComponent(template);

      getComponent().conditionSource.set(false);
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set(true);
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set('');
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set('A');
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(0);
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set(1);
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(null);
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set({});
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(undefined);
      await whenStable();
      expect(queryAll('span.greeter').length).toBe(0);
      expect(getTextContent()).toBe('');
    });

    it('Should handle nested if correctly', async () => {
      const template =
      '<div *qxIf="conditionSource; priority: priorityLevel">' +
        '<span *qxIf="nestedConditionSource; priority: priorityLevel">HELLO</span>' +
      '</div>'
      fixture = createTestComponent(template);

      getComponent().conditionSource.set(false);
      await whenStable();
      expect(queryAll('div').length).toBe(0);
      expect(queryAll('span').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().conditionSource.set(true);
      await whenStable();
      expect(queryAll('div').length).toBe(1);
      expect(queryAll('span').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().nestedConditionSource.set(false)
      await whenStable();
      expect(queryAll('div').length).toBe(1);
      expect(queryAll('span').length).toBe(0);
      expect(getTextContent()).toBe('');

      getComponent().nestedConditionSource.set(true)
      await whenStable();
      expect(queryAll('div').length).toBe(1);
      expect(queryAll('span').length).toBe(1);
      expect(getTextContent()).toBe('HELLO');

      getComponent().conditionSource.set(false);
      await whenStable();
      expect(queryAll('div').length).toBe(0);
      expect(queryAll('span').length).toBe(0);
      expect(getTextContent()).toBe('');

    });

    it('Should not add element twice if condition goes from truthy to truthy', async () => {
      const template = '<span *qxIf="conditionSource; priority: priorityLevel">HELLO</span>';
      fixture = createTestComponent(template);

      getComponent().conditionSource.set(1);
      await whenStable();

      let els = queryAll('span');
      expect(els.length).toBe(1);
      els[0].classList.add('marker');

      getComponent().conditionSource.set(2);
      await whenStable();
      els = queryAll('span');
      expect(els.length).toBe(1);
      expect(els[0].classList.contains('marker')).toBeTrue();
    });

    describe('Then/else templates.', () => {

      it('Should support else.', async () => {
        const template =
          '<span *qxIf="conditionSource; priority: priorityLevel; else elseBlock">TRUE</span>' +
          '<ng-template #elseBlock>FALSE</ng-template>';
        fixture = createTestComponent(template);

        await whenStable();
        expect(getTextContent()).toBe('TRUE');

        getComponent().conditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('FALSE');
      });

      it('Should support then and else.', async () => {
        const template =
          '<span *qxIf="conditionSource then thenBlock else elseBlock; priority: priorityLevel">IGNORE</span>' +
          '<ng-template #thenBlock>TRUE</ng-template>' +
          '<ng-template #elseBlock>FALSE</ng-template>';
        fixture = createTestComponent(template);

        await whenStable();
        expect(getTextContent()).toBe('TRUE')

        getComponent().conditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('FALSE');
      });

      it('Should remove then/else template.', async () => {
        const template =
          '<span ' +
            '*qxIf="conditionSource;' +
            'then nestedConditionSource() ? tmpRef : null;' +
            'else nestedConditionSource() ? tmpRef : null;' +
            'priority: priorityLevel"></span>' +
          '<ng-template #tmpRef>TEMPLATE</ng-template>';
        fixture = createTestComponent(template);

        await whenStable();
        expect(getTextContent()).toBe('TEMPLATE');

        getComponent().nestedConditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('');

        getComponent().conditionSource.set(false);
        getComponent().nestedConditionSource.set(true);
        await whenStable();
        expect(getTextContent()).toBe('TEMPLATE');

        getComponent().nestedConditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('');
      });

      it('Should support dynamic else.', async () => {
        const template =
          '<span ' +
            '*qxIf="conditionSource;' +
            'else nestedConditionSource() ? elseBlock1 : elseBlock2;' +
            'priority: priorityLevel">TRUE</span>' +
          '<ng-template #elseBlock1>FALSE1</ng-template>' +
          '<ng-template #elseBlock2>FALSE2</ng-template>';
        fixture = createTestComponent(template);

        await whenStable();
        expect(getTextContent()).toBe('TRUE');

        getComponent().conditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('FALSE1');

        getComponent().nestedConditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('FALSE2');
      });

      it('Should support binding to variable using let.', async () => {
        const template =
          '<span *qxIf="conditionSource; else elseBlock; priority: priorityLevel; let v;">{{v()}}</span>' +
          '<ng-template #elseBlock let-v>{{v()}}</ng-template>'
        fixture = createTestComponent(template);

        await whenStable();
        expect(getTextContent()).toBe('true');

        getComponent().conditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('false');
      });

      it('SHould support binding to variable using as.', async () => {
        const template =
          '<span *qxIf="conditionSource as v; else elseBlock; priority: priorityLevel">{{v()}}</span>' +
          '<ng-template #elseBlock let-v>{{v()}}</ng-template>'
        fixture = createTestComponent(template);

        await whenStable();
        expect(getTextContent()).toBe('true');

        getComponent().conditionSource.set(false);
        await whenStable();
        expect(getTextContent()).toBe('false');
      });

      it('Should not add element twice if condition goes from falsy to false.', async () => {
        const template =
          '<span *qxIf="conditionSource else elseBlock; priority: priorityLevel"></span>' +
          '<ng-template #elseBlock>' +
            '<span class="false"></span>' +
          '</ng-template>';
        fixture = createTestComponent(template);
        getComponent().conditionSource.set(false);

        await whenStable();
        let els = queryAll('span.false');
        expect(els.length).toBe(1);
        els[0].classList.add('marker');

        getComponent().conditionSource.set(null);
        await whenStable();
        els = queryAll('span.false');
        expect(els.length).toBe(1);
        els[0].classList.add('marker');
      });
    });
  });
});
