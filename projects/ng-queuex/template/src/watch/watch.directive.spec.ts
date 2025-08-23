// import { Component, Directive, DoCheck, PLATFORM_ID, provideZonelessChangeDetection, signal } from "@angular/core";
// import { ComponentFixture, TestBed } from "@angular/core/testing";
// import { Priority, PriorityLevel, PriorityName, completeIntegrationForTest, isTaskQueueEmpty, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
// import { provideQueuexWatchDefaultPriority, QueuexWatch } from "./watch.directive";
// import { By } from "@angular/platform-browser";
// import { describePriorityLevel } from "../utils/test_utils";

// interface TestEnvironmentOptions {
//   defaultPriority?: PriorityName | 'undefined';
//   zoneless?: boolean;
//   serverPlatform?: boolean
// }

// const defaultTestEnvConfig: Required<TestEnvironmentOptions> = {
//   defaultPriority: 'undefined',
//   zoneless: false,
//   serverPlatform: false
// }

// @Component({
//   selector: 'test-cmp',
//   template: '',
//   standalone: false,
// })
// class TestComponent {
//   counter = signal(0);
//   priorityLevel: PriorityLevel = Priority.Normal;

//   increment(): void {
//     this.counter.update((val) => ++val);
//   }

//   decrement(): void {
//     this.counter.update((val) => --val);
//   }
// }


// @Directive({ selector: '[test-directive]', standalone: false })
// class TestDirective implements DoCheck {
//   checkCount = -1;

//   constructor() {}

//   ngDoCheck(): void {
//     this.checkCount++;
//   }
// }


// const Priorities: PriorityLevel[] = [1, 2, 3, 4, 5];

// function createTestComponent(template: string): ComponentFixture<TestComponent> {
//   TestBed
//     .overrideComponent(TestComponent, { set: { template } })
//     .runInInjectionContext(() => completeIntegrationForTest());
//   return TestBed.createComponent(TestComponent);
// }


// describe('QueuexWatch directive', () => {

//   let fixture!: ComponentFixture<TestComponent>

//   function getComponent(): TestComponent {
//     return fixture.componentInstance
//   }
//   function query(predicate: string): HTMLElement {
//     return fixture.debugElement.query(By.css(predicate)).nativeElement;
//   }
//   function queryAll(predicate: string): HTMLElement[] {
//     return fixture.debugElement.queryAll(By.css(predicate)).map((debugEl) => debugEl.nativeElement);
//   }
//   function getQxWatchDirective(predicate: string): QueuexWatch {
//     return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexWatch)
//   }
//   function getTestDirective(predicate: string): TestDirective {
//     return fixture.debugElement.query(By.css(predicate)).injector.get(TestDirective)
//   }
//   function getTextContent(): string {
//     return fixture.nativeElement.textContent;
//   }
//   async function whenStable(): Promise<void> {
//     while(1) {
//       if (!fixture.isStable()) {
//         await fixture.whenStable();
//       }
//       await whenIdle()
//       if (fixture.isStable()) {
//         break;
//       }
//     }
//     return;
//   }

//   function setupTestEnvironment(config?: TestEnvironmentOptions) {
//     const localConfig = config ? { ...defaultTestEnvConfig, ...config } : defaultTestEnvConfig;
//     const providers: any[] = [provideNgQueuexIntegration()];

//     if (localConfig.defaultPriority !== 'undefined') {
//       providers.push(provideQueuexWatchDefaultPriority(localConfig.defaultPriority));
//     }

//     if (localConfig.zoneless) {
//       providers.push(provideZonelessChangeDetection());
//     }

//     if (localConfig.serverPlatform) {
//       providers.push({ provide: PLATFORM_ID, useValue: 'server' });
//     }

//     TestBed.configureTestingModule({
//       imports: [QueuexWatch],
//       declarations: [TestComponent, TestDirective],
//       providers,
//     });
//   }

//   function resetTestEnvironment(): void {
//     TestBed.resetTestingModule();
//   }

//   afterEach(() => {
//     fixture = null!;
//     resetTestEnvironment();
//   });

//   it('Should create embedded view immediately and not pollute concurrent task queue.', () => {
//     setupTestEnvironment()

//     const template = '<span *watch>HELLO</span>';
//     expect(isTaskQueueEmpty()).toBe(true);
//     fixture = createTestComponent(template);
//     expect(getTextContent()).toBe('HELLO');
//     expect(isTaskQueueEmpty()).toBeTrue();
//   })

//   it('Default priority should be highest', async () => {
//     setupTestEnvironment();
//     const template = '<span *watch></span>';
//     fixture = createTestComponent(template);
//     expect(getQxWatchDirective('span').priority()).toBe(Priority.Highest);
//   })

//   Priorities.forEach((priorityLevel) => {
//     describePriorityLevel(priorityLevel, () => {
//       it('Should have default default priority level provided by injection.', async () => {
//         setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
//         const template = '<span *watch></span>';
//         fixture = createTestComponent(template);
//         expect(getQxWatchDirective('span').priority()).toBe(priorityLevel);
//       });
//     });
//   });

//   describe('Browser. Without zoneless change detection.' , () => {
//     beforeEach(() => setupTestEnvironment());

//     // Priorities.forEach((priorityLevel) => {

//       it('Should update embedded view locally if consumed signal will change.', async () => {
//         const template =
//           '<span test-directive class="outer-test-dir"></span>'
//           '<div *watch>' +
//             '<span test-directive class="inner-test-dir"></span>' +
//             '<span>{{counter()}}</span>' +
//           '</div>'
//         fixture = createTestComponent(template);
//         // getComponent().priorityLevel = priorityLevel

//         fixture.detectChanges();
//         expect(getTextContent()).toBe('0');
//         expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
//         expect(getTestDirective('span.inner-test-dir').checkCount).toBe(0);

//         getComponent().increment();
//         await whenIdle();
//         expect(getTextContent()).toBe('1');
//         expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
//         expect(getTestDirective('span.inner-test-dir').checkCount).toBe(1);

//         getComponent().increment();
//         await whenIdle();
//         expect(getTextContent()).toBe('2');
//         expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
//         expect(getTestDirective('span.inner-test-dir').checkCount).toBe(2);
//       });

//     // })

//   })
// })
