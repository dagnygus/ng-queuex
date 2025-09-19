# QueuexReactiveView class

## Selector: `'ng-template[reactiveView]'`

## Description
`QueuexReactiveView` (`*reactiveView`) is a structural directive for rendering larger portions of the UI in a reactive, scheduler-driven way. It works similarly to `QueuexWatch`, but instead of creating the embedded view immediately, it instantiates it lazily and manages its lifecycle through a prioritized concurrent scheduler.

`QueuexReactiveView` (`*reactiveView`) is a structural directive for rendering larger portions of the UI in a reactive, scheduler-driven way. It works similarly to `QueuexWatch`, but instead of creating the embedded view immediately, it instantiates it lazily and manages its lifecycle through a prioritized concurrent scheduler.

  - As a numeric value: `*reactiveView="3"` (valid values: 1–5)
  - As a property binding: `*reactiveView="priorityLevel"`
  - As a string literal: `*reactiveView="'normal'"`
  (valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`)

This makes it possible to fine-tune how reactive views are scheduled and updated, striking the right balance between responsiveness and performance. Because views are created lazily and scheduled with explicit priorities, `QueuexReactiveView` is particularly suited for larger UI fragments or more complex sub-trees, where eager  rendering would be costly.

## Note
Change detection is triggered only for signals read directly in the template. Signals used inside child components or elsewhere in the component class will not automatically trigger local change detection within the reactive view.

## Server side fallback
On the server side, `QueuexReactiveView` is fully transparent. All client-side scheduling, lazy view creation, and reactive context features are disabled during SSR. The directive falls back to standard Angular template rendering,  ensuring clean, predictable HTML output without introducing overhead.

## Example
```html
<!-- Default priority (normal, 3) -->
<div *reactiveView>
  Counter: {{ counter() }}
</div>
<section *reactiveView>
  <app-dashboard></app-dashboard>
</section>

<!-- Explicit priority as number -->
<div *reactiveView="1">
  Current user: {{ userName() }}
</div>
<section *reactiveView="1">
  <app-heavy-chart></app-heavy-chart>
</section>

<!-- Priority bound to component property -->
<div *reactiveView="priorityLevel">
  Items total: {{ itemsCount() }}
</div>
<section *reactiveView="priorityLevel">
  <app-dynamic-feed></app-dynamic-feed>
</section>

<!-- Priority as string literal -->
<div *reactiveView="'low'">
  Status: {{ statusSignal() }}
</div>
<section *reactiveView="'low'">
  <app-lazy-widget></app-lazy-widget>
</section>
 ```

## Inputs
**<span style="color: seaGreen">@Input(</span>{ alias: <span style="color: darkgoldenrod">'reactiveViewPriority'</span>, transform: advancePriorityInputTransform }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> priority(value: <span style="color: purple">PriorityLevel</span> | <span style="color: purple">Signal\<PriorityLevel></span>)**
  - A priority for concurrent scheduler to manage view. It can be set as numeric value (1-5) or as string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3). This input also accepts the signal of the previously mentioned values.

**<span style="color: seaGreen">@Input()</span><br>
reactiveViewRenderCallback: (()<span style="color: blue"> => void </span>) | <span style="color: blue">null</span>**
  - A callback what will be called after view creation. This enables developers to perform actions when rendering has been done. The `reactiveViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered. The `reactiveViewRenderCallback` emits the latest value causing the view to update.
