import { Component, Directive, DoCheck, PLATFORM_ID, provideZonelessChangeDetection, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { completeIntegrationForTest, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { provideQueuexLazyViewDefaultPriority, QueuexLazyView } from "./lazy_view";
import { By } from "@angular/platform-browser";
import { describePriorityLevel } from "../utils/test_utils";

interface TestEnvironmentOptions {
  zoneless?: boolean;
  serverPlatform?: boolean
  defaultPriority?: PriorityName | 'undefined'
}

const defaultTestEnvConfig: Required<TestEnvironmentOptions> = {
  zoneless: false,
  serverPlatform: false,
  defaultPriority: 'undefined'
}

const Priorities: PriorityLevel[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'test-cmp',
  template: '',
  standalone: false,
})
class TestComponent {
  message = signal('HELLO');
  priorityLevel: PriorityLevel = 3
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

describe('QueuexLazyView directive', () => {
  let fixture: ComponentFixture<TestComponent> = null!;

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

  function whenStable(): Promise<any> {
    return fixture.whenStable();
  }

  function getTextContent(): string {
    return fixture.nativeElement.textContent
  }

  function query(predicate: string): HTMLElement {
    return fixture.debugElement.query(By.css(predicate)).nativeElement;
  }

  function queryAll(predicate: string): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css(predicate)).map((debugEl) => debugEl.nativeElement);
  }
  function getTestDirective(predicate: string): TestDirective {
    return fixture.debugElement.query(By.css(predicate)).injector.get(TestDirective);
  }
  function getLazyViewDirective(predicate: string): QueuexLazyView {
    return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexLazyView);
  }

  function setupTestEnvironment(config?: TestEnvironmentOptions): void {
    const localConfig = config ? { ...defaultTestEnvConfig, ...config } : defaultTestEnvConfig

    const providers: any[] = [provideNgQueuexIntegration()]

    if (localConfig.defaultPriority !== 'undefined') {
      providers.push(provideQueuexLazyViewDefaultPriority(localConfig.defaultPriority));
    }

    if (localConfig.zoneless) {
      providers.push(provideZonelessChangeDetection());
    }

    if (localConfig.serverPlatform) {
      providers.push({ provide: PLATFORM_ID, useValue: 'server' });
    }

    TestBed.configureTestingModule({
      providers: providers,
      imports: [QueuexLazyView],
      declarations: [TestComponent, TestDirective]
    });
  }

  function resetTestEnvironment(): void {
    TestBed.resetTestingModule();
    fixture = null!
  }

  afterEach(() => {
    resetTestEnvironment();
  });

  it('Default priority should be normal.', async () => {
    setupTestEnvironment();
    const template = '<span *lazyView></span>'
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    expect(getLazyViewDirective('span').priority).toBe(Priority.Normal);
  });

  Priorities.forEach((priorityLevel) => {
    describePriorityLevel(priorityLevel, () => {
      it('Should have default priority provided by injection.', async () => {
        setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
        const template = '<span *lazyView></span>'
        createTestComponent(template);
        detectChanges();
        await whenIdle();
        expect(getLazyViewDirective('span').priority).toBe(priorityLevel);
      });
    });
  });

  describe('Browser environment', () => {
    beforeEach(() => setupTestEnvironment({ zoneless: true }));

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {
        it('Should create embedded view lazily and mark that view for refresh.', async () => {
          const template =
            '<span test-directive class="outer-test-dir"></span>' +
            '<div *lazyView="priorityLevel; renderCallback: renderCallback">' +
              '<span test-directive class="inner-test-dir"></span>' +
              '<span>{{message()}}</span>' +
            '</div>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          const spy = jasmine.createSpy();
          getComponent().renderCallback = spy;


          detectChanges();
          expect(spy.calls.count()).toBe(0);
          expect(getTextContent()).toBe('');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          await whenIdle();
          await whenStable();

          expect(spy.calls.count()).toBe(1);
          expect(getTextContent()).toBe('HELLO');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

          getComponent().message.set('WORD');
          await whenStable();
          expect(spy.calls.count()).toBe(1);
          expect(getTextContent()).toBe('WORD');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(1);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);
        });
      });
    });
  });

  describe('Server environment.', () => {
    beforeEach(() => setupTestEnvironment({ serverPlatform: true }));
    it('Should create embedded view immediately and be transparent.', () => {
      const template =
          '<span test-directive class="outer-test-dir"></span>' +
          '<div *lazyView="\'normal\'; renderCallback: renderCallback">' +
            '<span test-directive class="inner-test-dir"></span>' +
            '<span>{{message()}}</span>' +
          '</div>';
        createTestComponent(template);


        detectChanges();
        expect(getTextContent()).toBe('HELLO');
        expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
        expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

        getComponent().message.set('WORD');
        detectChanges();
        expect(getTextContent()).toBe('WORD');
        expect(getTestDirective('span.outer-test-dir').checkCount).toBe(1);
        expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);
    });
  });
});
