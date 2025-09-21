# @ng-queuex/template
`@ng-queuex/template` is a lightweight collection of structural and attribute directives built on top of Angular’s signals API.<br>
It provides a set of SSR-friendly, highly-performant primitives designed for fine-grained template reactivity without relying on RxJS.

## ✨ Features
  - ✅ Built entirely on Angular signals API (no RxJS required)
  - ✅ Works seamlessly with @ng-queuex/core scheduler
  - ✅ SSR-compatible thanks to transparent fallbacks
  - ✅ Fine-grained local change detection contexts
  - ✅ Direct DOM bindings for micro-optimizations
  - ✅ Designed for progressive adoption – drop-in replacements for Angular’s built-ins (*ngIf, *ngFor, etc.)
  - ✅ Exclusive support for immutable objects (for grate performance optimizations).

## 📦 Installation
```bash
npm install https://github.com/dagnygus/ng-queuex/releases/download/v0.0.2/ng-queuex-template-0.0.2.tgz
```
This package depends on `@ng-queuex/core`, so make sure you have it installed as well:
```bash
npm install https://github.com/dagnygus/ng-queuex/releases/download/v0.0.2/ng-queuex-core-0.0.2.tgz
```

## 🚀 Getting Started
### 1. Integration 🏗️
Go to `<project-root>/src/app/app.config.ts` and add `provideNgQueuexIntegration()` to providers.
```ts
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay, withIncrementalHydration } from '@angular/platform-browser';
import { provideNgQueuexIntegration } from "@ng-queuex/core";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // But avoid using package tools in lazy hydrated component. I am not able to predict the results because of lack of understanding how incremental hydration works.
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    provideNgQueuexIntegration()// This line will unlock functions like scheduleTask(() => {}) or detectChanges(cdRef)
  ]
}
```
### 2. Usage 🔧
Import the directives you need directly into your standalone component:
```ts
import { Component, signal, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { QueuexIf, QueuexWatch } from '@ng-queuex/template';

@Component({
  selector: 'user-card',
  imports: [QueuexIf],
  template: `
    <div *qxIf="isLoggedIn; else guest">
      <span>{{ userName() }}</span>
    </div>
    <ng-template #guest>
      <span>Guest</span>
    </ng-template>
  `,
})
export class UserCard {
  isLoggedIn = signal(true);
  userName = signal('Alice');
}

@Component({
  selector: 'isolated-counter',
  imports: [QueuexWatch]
  template: `
    <span *watch>{{ counter() }}</span>
    <button (click)="increment()">Increment</button>
    <button (click="decrement()")>Decrement</button>
  `
})
export class IsolatedCounter implements AfterViewInit {
  private _cdRef = inject(ChangeDetectorRef);

  counter = signal();

  increment(): void {
    this.counter.update((value) => ++value);
  }

  decrement(): void {
    this.counter.update((value) => --value);
  }

  ngAfterViewInit() {
    this._cdRef.detach();
  }
}
```

## 🧩 Directives Overview

### Structural Directives
  - *qxIf → drop-in replacement for *ngIf, with lazy view creation and isolated reactive contexts.
  - *qxFor → drop-in replacement for *ngFor, optimized for signals-based iteration.
  - *reactiveView → lazily creates a view with a reactive context and priority-based scheduling.
  - *scheduledView → lazily creates a view, detached from the change detection tree loosely connected to it via `ngDoCheck()`.
  - *lazyView → simplest lazy view creation, without detachment or a reactive context.
  - *queuexSwitchCase, *queuexSwitchDefault → companion directives for qxSwitch.
  - *watch → designed for elegant direct DOM property updates with fine-grained reactivity.

### Attribute Directives
  - [qxSwitch] → reactive alternative to Angular’s ngSwitch

### Fine-grained reactivity
Most directives (*watch, *qxIf, *qxFor, *reactiveView, *queuexSwitchCase, *queuexSwitchDefault) create
embedded views detached from change detection three. Local change detection is manage by separated
reactive context supported by concurrent scheduler from `@ng-queuex/core`. Directly read signals can trigger
local change detection if their updates.

Most directive inputs accepts signals directly without invocation parentheses (e.g. *reactiveView="priority()" ⇔
*reactiveView="priority", *qxFor="dataCollection()" ⇔ *qxFor="dataCollection") what can make then independent
from Angular's change detection cycles (or host component change detection).

### 🔄 Server-Side Rendering (SSR)
Unlike @ng-queuex/core, this package is **SSR-friendly by default**. Every directive has a appropriate fallback 
for server rendering, ensuring hydration compatibility:
  - views are rendered on the server just like standard Angular templates,
  - reactivity and scheduling kick in only on the client.

## 📚 Documentation
Each directive comes with its own README inside the package:
  - [*watch](./docs/watch.md)
  - [*qxIf](./docs/if.md)
  - [*qxFor](./docs/for.md)
  - [[qxSwitch]](./docs/switch.md)
  - [*qxSwitchCase](./docs/switch_case.md)
  - [*qxSwitchDefault](./docs/switch_default.md)
  - [*lazyView](./docs/lazy_view.md)
  - [*scheduledView](./docs/scheduled_view.md)
  - [*reactiveView](./docs/reactive_view.md)

## 🧪 Testing
Every directive in that package relies deeply on concurrent scheduler from `@ng-queuex/core`.
For this reason it is required:
  1. Add provideNgQueuexIntegration() to your test providers.
  2. Run completeIntegrationForTest() inside TestBed.runInInjectionContext.
  3. Reset testing module after each test.
```ts
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideNgQueuexIntegration()],
    imports: [QueuexReactiveView],
  }).runInInjectionContext(() => {
    completeIntegrationForTest();
  });
});

afterEach(() => {
  TestBed.resetTestingModule();
})
```

## 📜 License
MIT © 2025 — ng-queuex contributors

