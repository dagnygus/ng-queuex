import { Component, PLATFORM_ID, provideZonelessChangeDetection, signal, Signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { completeIntegrationForTest, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { provideQueuexScheduledViewDefaultPriority, QueuexScheduledView } from "./scheduled_view";
import { By } from "@angular/platform-browser";
import { describePriorityLevel } from "../utils/test_utils";

interface TestEnvironmentOptions {
  zoneless?: boolean;
  serverPlatform?: boolean;
  defaultPriority?: PriorityName | 'undefined';
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
  standalone: false
})
class TestComponent {
  valueSource = signal<any>(undefined);
  priorityLevel: PriorityLevel = 3;
}

let fixture: ComponentFixture<TestComponent> = null!;

function setupTestEnvironment(config?: TestEnvironmentOptions): void {
  const localConfig = config ? { ...defaultTestEnvConfig, ...config} : defaultTestEnvConfig;
  const providers: any[] = [provideNgQueuexIntegration()];

  if (localConfig.defaultPriority !== "undefined") {
    console.log(localConfig.defaultPriority);
    providers.push(provideQueuexScheduledViewDefaultPriority(localConfig.defaultPriority));
  }
  if (localConfig.zoneless) {
    providers.push(provideZonelessChangeDetection());
  }
  if (localConfig.serverPlatform) {
    providers.push({ provide: PLATFORM_ID, useValue: 'server' });
  }

  TestBed.configureTestingModule({
    providers: providers,
    declarations: [TestComponent],
    imports: [QueuexScheduledView]
  });
}

function resetTestEnvironment(): void {
  TestBed.resetTestingModule()
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

function getQueuexScheduledViewDirective(predicate: string): QueuexScheduledView {
  return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexScheduledView);
}

function detectChanges(): void {
  fixture.detectChanges();
}

function expectTextContent(text: string): void {
  expect(fixture.nativeElement.textContent).toBe(text);
}

describe('QueuexScheduledView directive', () => {
  afterEach(() => {
    resetTestEnvironment();
    fixture = null!
  });

  it('Default priority should be normal.', async () => {
    setupTestEnvironment();
    const template = '<span *scheduledView></span>';
    createTestComponent(template);
    detectChanges();
    await whenIdle();
    //@ts-expect-error
    expect(getQueuexScheduledViewDirective('span')._priorityRef.value).toBe(Priority.Normal);
  });

  Priorities.forEach((priorityLevel) => {
    describePriorityLevel(priorityLevel, () => {
      it('Should have default priority provided by injection.', async () => {
        setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
        const template = '<span *scheduledView></span>';
        createTestComponent(template);
        detectChanges();
        await whenIdle();
        //@ts-expect-error
        expect(getQueuexScheduledViewDirective('span')._priorityRef.value).toBe(priorityLevel);
      });
    });
  });

  describe('Browser environment', () => {
    beforeEach(() => setupTestEnvironment());

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {
        it('Should schedule local change detection when in ngDoCheck hook', async () => {
          const template = '<span *scheduledView="priorityLevel">{{valueSource()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().valueSource.set('A');
          detectChanges();
          await whenIdle();
          expectTextContent('A');

          getComponent().valueSource.set('B');
          await whenIdle();
          expectTextContent('A');
          detectChanges();
          expectTextContent('A');
          await whenIdle();
          expectTextContent('B');
        });
      });
    });
  })
});
