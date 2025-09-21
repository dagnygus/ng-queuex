# QueuexWatch class

## Selector: `'ng-template[watch]'`

## Description

`QueuexWatch` is a lightweight structural directive designed for highly efficient, fine-grained property bindings on DOM elements.
 It is particularly suited for cases where only a small number of bindings are required (e.g. one or two element properties).

Unlike traditional bindings, `QueuexWatch` immediately creates its embedded view, detaching it from Angular’s logical
tree and assigning it a dedicated reactive context. This design ensures that change detection runs independently from the host
component or Angular’s global cycles.

Change detection is triggered as quickly as possible, using one of the following strategies depending on the current runtime state:
 - `onTaskExecuted(listener: VoidFunction)` hook, if a Task is currently running,
 - otherwise, a concurrent scheduler with the highest priority.

This makes `QueuexWatch` ideal for scenarios where reactive signals are used in detached components (`ChangeDetectorRef#detach()`),
and where binding directly to element properties results in a more elegant and performant solution.

### Example
```html
 <!-- Detached component with reactive signals -->
 <span *watch textContent="personName()"></span>
 
 <!-- Multiple properties can be bound if needed -->
<input
  *watch
  [value]="personName()"
  [title]="personAge() + ' years old'"
/>
```

## Server side fallback

On the server side, QueuexWatch is fully transparent and falls back to standard Angular property bindings, ensuring predictable SSR output without any additional overhead.
