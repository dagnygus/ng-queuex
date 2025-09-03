import { ChangeDetectionStrategy, Component, Directive, DoCheck, PLATFORM_ID, provideZonelessChangeDetection, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Priority, PriorityLevel, completeIntegrationForTest, isTaskQueueEmpty, provideNgQueuexIntegration, scheduleTask, whenIdle } from "@ng-queuex/core";
import { QueuexWatch } from "./watch.directive";
import { By } from "@angular/platform-browser";

interface TestEnvironmentOptions {
  zoneless?: boolean;
  serverPlatform?: boolean
}

const defaultTestEnvConfig: Required<TestEnvironmentOptions> = {
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
  counter = signal(0);
  message = signal('HELLO');
  priorityLevel: PriorityLevel = Priority.Normal;

  increment(): void {
    this.counter.update((val) => ++val);
  }

  decrement(): void {
    this.counter.update((val) => --val);
  }
}


@Directive({ selector: '[test-directive]', standalone: false })
class TestDirective implements DoCheck {
  checkCount = -1;

  constructor() {}

  ngDoCheck(): void {
    this.checkCount++;
  }
}

function createTestComponent(template: string): ComponentFixture<TestComponent> {
  TestBed
    .overrideComponent(TestComponent, { set: { template } })
    .runInInjectionContext(() => completeIntegrationForTest());
  return TestBed.createComponent(TestComponent);
}


describe('QueuexWatch directive', () => {

  let fixture!: ComponentFixture<TestComponent>

  function getComponent(): TestComponent {
    return fixture.componentInstance
  }
  function query(predicate: string): HTMLElement {
    return fixture.debugElement.query(By.css(predicate)).nativeElement;
  }
  function queryAll(predicate: string): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css(predicate)).map((debugEl) => debugEl.nativeElement);
  }
  function getQxWatchDirective(predicate: string): QueuexWatch {
    return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexWatch)
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

    if (localConfig.zoneless) {
      providers.push(provideZonelessChangeDetection());
    }

    if (localConfig.serverPlatform) {
      providers.push({ provide: PLATFORM_ID, useValue: 'server' });
    }

    TestBed.configureTestingModule({
      imports: [QueuexWatch],
      declarations: [TestComponent, TestDirective],
      providers,
    });
  }

  function resetTestEnvironment(): void {
    TestBed.resetTestingModule();
  }

  afterEach(() => {
    fixture = null!;
    resetTestEnvironment();
  });




  describe('Browser.' , () => {

    beforeEach(() => setupTestEnvironment());

    it('Should create embedded view immediately and not pollute concurrent task queue.', () => {
      const template = '<span *watch>{{message()}}</span>'
      fixture = createTestComponent(template);
      fixture.detectChanges();
      expect(getTextContent()).toBe('HELLO');
      expect(isTaskQueueEmpty()).toBeTrue();
    });

    it('Should update embedded view locally if consumed signal will change.', async () => {
      const template =
        '<span test-directive class="outer-test-dir"></span>' +
        '<div *watch>' +
          '<span test-directive class="inner-test-dir"></span>' +
          '<span>{{counter()}}</span>' +
        '</div>';
      fixture = createTestComponent(template);

      fixture.detectChanges();
      expect(getTextContent()).toBe('0');
      expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
      expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

      getComponent().increment();
      await whenIdle();
      expect(getTextContent()).toBe('1');
      expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
      expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

      getComponent().increment();
      await whenIdle();
      expect(getTextContent()).toBe('2');
      expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
      expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
    });

    it('Should update embedded view in onTaskExecuted() callback if current stack frame is in concurrent task context.',async () => {
      const template = '<span *watch>{{counter()}}</span>'
      fixture = createTestComponent(template);

      fixture.detectChanges();
      expect(getTextContent()).toBe('0');

      scheduleTask(() => {
        scheduleTask(() => {
          expect(getTextContent()).toBe('1');
        }, Priority.Highest);

        getComponent().increment();
      }, Priority.Normal)

      await whenIdle();
    });

  })

  describe('Server', () => {
    beforeEach(() => setupTestEnvironment({ serverPlatform: true }))

    it('Should be transparent for change detection cycles', () => {
      const template =
        '<span test-directive class="outer-test-dir"></span>' +
        '<div *watch>' +
          '<span test-directive class="inner-test-dir"></span>' +
          '<span>{{counter()}}</span>' +
        '</div>';
      fixture = createTestComponent(template);

      fixture.detectChanges();
      expect(getTextContent()).toBe('0');
      expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
      expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

      getComponent().increment();
      fixture.detectChanges();
      expect(getTextContent()).toBe('1');
      expect(getTestDirective('span.outer-test-dir').checkCount).toBe(1);
      expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

      getComponent().increment();
      fixture.detectChanges();
      expect(getTextContent()).toBe('2');
      expect(getTestDirective('span.outer-test-dir').checkCount).toBe(2);
      expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
    });
  })
})

