# QueuexIf<span style="color: purple">\<T = unknown></span> class

## Selector: `'ng-template[qxIf]'`

## Description
The `QueuexIf` directive is a structural directive that serves as a drop-in replacement for Angular’s native `NgIf` **(restricted to immutable objects)**,
but comes with additional advanced capabilities. Much like NgIf, it is designed for conditional rendering of templates based on the value bound to its input.
 *
When the input evaluates to a truthy value, the directive creates an embedded view from the attached ng-template (the default `“then”` template) or, more commonly,
from a custom template provided via the `[qxIfThen]` input. Conversely, when the input is falsy, the directive removes the active view and, if defined,
instantiates the template specified in `[qxIfElse]`.

Where `QueuexIf` truly stands out is in how it manages these views. Every embedded view is instantiated lazily through the concurrent scheduler provided by `"ng-queuex/core"`,
ensuring efficient rendering under heavy workloads. Each view is also assigned its own isolated reactive context, enabling local change detection that runs independently from Angular’s
global change detection cycles — and even separately from the host component’s change detection. Because views are detached from the parent logical tree, any signal read
directly within the template can autonomously trigger change detection for that specific view.

This architecture makes QueuexIf a powerful alternative to NgIf, combining familiar conditional rendering semantics with modern, high-performance rendering and granular reactivity.

## Server side fallback

On the server side, QueuexIf gracefully falls back to the behavior of Angular’s native NgIf. All the advanced client-side features — such as lazy
instantiation via the concurrent scheduler, isolated reactive contexts, and signal-driven change detection — are intentionally disabled during server-side rendering.
These capabilities are unnecessary in an SSR environment and would only introduce additional overhead. By reverting to a simplified NgIf-like mode, QueuexIf ensures
that server-rendered output remains clean, predictable, and optimized for maximum performance.

## Overriding default priority
To override default priority for `*qxIf`, use `provideQueuexIfDefaultPriority()` in providers array. 

## Inputs

**<span style="color: seaGreen">@Input(</span>{ required: <span style="color: blue">true</span> }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxIf(condition: <span style="color: purple">T | Signal\<T></span>)**
  - The value to evaluate as the condition for showing a template.

**<span style="color: seaGreen">@Input(</span>{ transform: advancePriorityInputTransform }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxIfPriority(priority: <span style="color: purple"> PriorityLevel | Signal\<PriorityLevel></span>)**

  - A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3). This input also accepts the signal of the previously mentioned values

**<span style="color: seaGreen">@Input()</span><br>
<span style="color: blue">set</span> qxIfThen(thenTmpRef: <span style="color: purple"> TemplateRef\<QueuexIfContext\<T>> | Signal\<TemplateRef\<QueuexIfContext\<T>>></span>)**
  - A template to show if the condition evaluates to be truthy.

**<span style="color: seaGreen">@Input()</span><br>
<span style="color: blue">set</span> qxIfElse(elseTmpRef: <span style="color: purple"> TemplateRef\<QueuexIfContext\<T>> | Signal\<TemplateRef\<QueuexIfContext\<T>>></span>)**
  - A template to show if the condition evaluates to be falsy.

**<span style="color: seaGreen">@Input()</span><br>
qxIfRenderCallback: ((arg: <span style="color: purple">T</span><span style="color: blue">) => void </span>) | <span style="color: blue">null</span>**
  - A callback what will be called when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done. The `qxIfRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered. The `qxIfRenderCallback` emits the latest value causing the view to update.

## Context variables
```ts
class QueuexIfContext<T = unknown> {
  public $implicit: Signal<T>
  public qxIf: Signal<T>
}
```
