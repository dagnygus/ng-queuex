# QueuexLazyView class

## Selector: `'ng-template[lazyView]'`

## Description

`QueuexLazyView` (`*lazyView`) is a lightweight structural directive that lazily instantiates its template without detaching it from Angular’s logical tree  and without creating a separate reactive context.

Unlike `QueuexReactiveView`, this directive does not create isolated reactive contexts. However, it still supports **prioritized lazy rendering** through its main input. The priority determines when the view is instantiated relative to other scheduled tasks.

Priority can be provided in several ways:
 - Numeric value: `*lazyView="3"` (1–5, default is `3` – Normal)
 - Property binding: `*lazyView="priorityLevel"`
 - String literal: `*lazyView="'highest'" | 'high' | 'normal' | 'low' | 'lowest'`

This makes `QueuexLazyView` suitable for medium-sized UI fragments that benefit from lazy creation, while keeping standard Angular change detection.

## Server side fallback
On server this directive is simply transparent.

## Inputs
**<span style="color: seaGreen">@Input(</span>{ alias: <span style="color: darkgoldenrod">'lazyViewPriority'</span>, transform: priorityInputTransform }<span style="color: seaGreen">)</span><br>
priority: <span style="color: purple">PriorityLevel</span>**
  - A priority for concurrent scheduler to create view. It can be set as numeric value (1-5) or as string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).

**<span style="color: seaGreen">@Input()</span><br>
lazyViewRenderCallback: (()<span style="color: blue"> => void </span>) | <span style="color: blue">null</span>**
  - A callback what will be called after view creation. This enables developers to perform actions when rendering has been done. The `lazyViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered. The `lazyViewRenderCallback` emits the latest value causing the view to update.
