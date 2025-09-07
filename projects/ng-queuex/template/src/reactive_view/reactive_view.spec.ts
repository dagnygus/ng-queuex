import { ChangeDetectionStrategy, Component, Directive, DoCheck, PLATFORM_ID, provideZonelessChangeDetection, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { completeIntegrationForTest, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { provideQueuexReactiveViewDefaultPriority, QueuexReactiveView } from "./reactive_view";
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  valueSource = signal<any>(0);
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

describe('QueuexReactiveView directive.', () => {
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
  function getReactiveViewDirective(predicate: string): QueuexReactiveView {
    return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexReactiveView);
  }

  function setupTestEnvironment(config?: TestEnvironmentOptions): void {
    const localConfig = config ? { ...defaultTestEnvConfig, ...config } : defaultTestEnvConfig

    const providers: any[] = [provideNgQueuexIntegration()]

    if (localConfig.defaultPriority !== 'undefined') {
      providers.push(provideQueuexReactiveViewDefaultPriority(localConfig.defaultPriority));
    }

    if (localConfig.zoneless) {
      providers.push(provideZonelessChangeDetection());
    }

    if (localConfig.serverPlatform) {
      providers.push({ provide: PLATFORM_ID, useValue: 'server' });
    }

    TestBed.configureTestingModule({
      providers: providers,
      imports: [QueuexReactiveView],
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

  it('Default priority should be normal', async () => {
    setupTestEnvironment();
    const template = '<span *reactiveView></span>'
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    //@ts-expect-error
    expect(getReactiveViewDirective('span')._priorityRef.value).toBe(Priority.Normal);
  });

  Priorities.forEach((priorityLevel) => {
    describePriorityLevel(priorityLevel, () => {
      it('Should have default priority provided by injection.', async () => {
        setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
        const template = '<span *reactiveView>HELLO</span>'
        createTestComponent(template);
        detectChanges();
        await whenIdle();
        //@ts-expect-error
        expect(getReactiveViewDirective('span')._priorityRef.value).toBe(priorityLevel);
      });
    })
  })

  describe('Browser environment.', () => {
    beforeEach(() => setupTestEnvironment());

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {
        it('Should update embedded view locally if consumed signal will change.', async () => {
          const template =
            '<span test-directive class="outer-test-dir"></span>' +
            '<div *reactiveView="priorityLevel; renderCallback: renderCallback">' +
              '<span test-directive class="inner-test-dir"></span>' +
              '<span>{{valueSource()}}</span>' +
            '</div>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          const spy = jasmine.createSpy();
          getComponent().renderCallback = spy;

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0');
          expect(spy.calls.count()).toBe(1);
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

          getComponent().valueSource.set(1);
          await whenIdle();
          expect(getTextContent()).toBe('1');
          expect(spy.calls.count()).toBe(1);
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

          getComponent().valueSource.set(2);
          await whenIdle();
          expect(getTextContent()).toBe('2');
          expect(spy.calls.count()).toBe(1);
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
        })
      })
    })

  });

  describe('Server environment.', ()  => {
    beforeEach(() => setupTestEnvironment({ serverPlatform: true }));

    it('Should create embedded view immediately and be transparent for change detection cycles.', () => {
      const template =
          '<span test-directive class="outer-test-dir"></span>' +
          '<div *reactiveView="\'normal\'; renderCallback: renderCallback">' +
            '<span test-directive class="inner-test-dir"></span>' +
            '<span>{{valueSource()}}</span>' +
          '</div>';
        createTestComponent(template);


        detectChanges();
        expect(getTextContent()).toBe('0');
        expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
        expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

        getComponent().valueSource.set(1);
        detectChanges();
        expect(getTextContent()).toBe('1');
        expect(getTestDirective('span.outer-test-dir').checkCount).toBe(1);
        expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

        getComponent().valueSource.set(2);
        detectChanges();
        expect(getTextContent()).toBe('2');
        expect(getTestDirective('span.outer-test-dir').checkCount).toBe(2);
        expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
    });
  })
})
