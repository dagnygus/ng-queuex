![alt text](./ng_queuex_logo.png)
# ng-queuex

**Queuex** is an experimental ecosystem for Angular that introduces a React-inspired **concurrent scheduler**  
and a set of **signal-driven structural directives** for fine-grained, isolated change detection.  

Unlike traditional Angular patterns (services, RxJS-heavy abstractions), Queuex provides a **minimal API**:  
just a scheduler exposed in simple functional API and directives built directly on top of Angular’s Signal API.

---

## ✨ Why Queuex?

Angular's default change detection is global, synchronous, and tied to the logical tree.  
Queuex takes a different approach:

- 🔹 **Minimal & functional API** – no services, no RxJS boilerplate, just functions and signals.  
- 🔹 **Concurrent scheduler** – inspired by React, with priority levels and abortable tasks.  
- 🔹 **Fine-grained change detection** – run detection only where it’s needed.  
- 🔹 **Hydration-aware** – application stabilization (`ApplicationRef#onStable`) waits until the scheduler is idle.  
- 🔹 **Server-side transparent** – on the server, all directives gracefully fall back to Angular’s native behavior.  

---

## 📦 Packages

### [@ng-queuex/core](./projects/ng-queuex/core/README.md)
Core utilities and the concurrent scheduler.

⚠️ **Note**: Scheduling functions are **client-side only**.  
On the server they intentionally throw, ensuring that developers provide explicit server side fallbacks (as demonstrated in `@ng-queuex/template`).  
Other utilities in this package remain safe to use in both environments.


- `scheduleTask()` – enqueue clean, abortable tasks.  
- `detectChanges()` / `scheduleChangeDetection()` – enqueue dirty tasks with built-in coalescing.  
- Designed to be minimal and functional: no Angular DI services, no RxJS.  
- Hydration-aware: delays `ApplicationRef#onStable` until the scheduler is idle. 

➡️ [Read more](./projects/ng-queuex/core/README.md)

---

### [@ng-queuex/template](./projects/ng-queuex/template/README.md)
Signal-driven structural directives powered by the core scheduler.

⚠️ **Note**: All directives are built upon signal APIs, so its usage is **restricted to immutable objects**.  

- `*qxIf` – granular alternative to `NgIf`.  
- `*qxFor` – concurrent alternative to `NgForOf`.  
- `*watch` – elegant property binding to DOM.  
- `*qxSwitch`, `*qxSwitchCase`, `*qxSwitchDefault`.  
- `*lazyView`, `*scheduledView`, `*reactiveView` – lazy rendering with different levels of isolation and scheduling.  
- All directives are **SSR-friendly** with transparent fallbacks, and compatible with **Hydration**.

➡️ [Read more](./projects/ng-queuex/template/README.md)

---

## 🚀 Getting Started

Install the main packages:

```bash
npm install https://github.com/dagnygus/ng-queuex/releases/download/v0.0.3/ng-queuex-core-0.0.4.tgz
```
```bash
npm install https://github.com/dagnygus/ng-queuex/releases/download/v0.0.3/ng-queuex-template-0.0.4.tgz
```

## 🛠 Example

```ts
import { scheduleTest, Priority } from "@ng-queuex/core"

const abort = scheduleTask(() => {
  console.log('running with highest priority.')
}, Priority.Highest)

// Later, if needed
abort();
```
```html
<span *watch [textContent]="personName()"></span>
```

## 📖 Public API

[@ng-queuex/core](./projects/ng-queuex/core/README.md)<br>
[@ng-queuex/template](./projects/ng-queuex/template/README.md)

## 🗺 Roadmap

- ✅ Core scheduler (done) 
- ✅ Template directives (done)
- 🔄 Package dedicated for angular signals
- 🔄 Virtual scrolling and virtualization

