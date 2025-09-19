# QueuexScheduled class

## Selector: `'ng-template[scheduledView]'`

## Description
`QueuexScheduledView` (`*scheduledView`) is a structural directive that lazily instantiates its template and detaches it from Angular’s logical view tree. Unlike `QueuexReactiveView`, it does not create an isolated reactive context.

Instead, the directive relies on Angular’s `ngDoCheck` lifecycle hook to plan local change detection runs via the concurrent scheduler from `ng-queuex/core`. This makes it suitable for scenarios where you need:
 - A detached, lazily created view,
 - No reactive signals directly driving change detection,
 - But still automatic local updates scheduled on each Angular check cycle.

In other words, the scheduler orchestrates when the detached view runs its own change detection, ensuring that rendering remains efficient while independent of the host component’s CD cycle.

## Server side fallback 

On the server side, `QueuexScheduledView` is fully transparent. Views are created synchronously without detachment, reactive contexts, or scheduling, ensuring clean and predictable SSR output.

## Example
```html
<!-- Default priority (Normal = 3) -->
<section *scheduledView>
  Last updated: {{ lastUpdate | date:'shortTime' }}
</section>

<!-- Explicit numeric priority -->
<section *scheduledView="1">
  Heavy widget content rendered with highest priority
</section>

<!-- Priority from component property -->
<section *scheduledView="priorityLevel">
  Dynamic priority scheduled content
</section>

<!-- Priority as string literal -->
<section *scheduledView="'low'">
  Low priority scheduled content
</section>
 ```

## Note
`QueuexScheduledView` does not react to signals directly. Instead, local change detection is triggered by the concurrent scheduler during Angular’s check cycle (`ngDoCheck`).

## Inputs
**<span style="color: seaGreen">@Input(</span>{ alias: <span style="color: darkgoldenrod">'scheduledViewPriority'</span>, transform: priorityInputTransform }<span style="color: seaGreen">)</span><br>
priority: <span style="color: purple">PriorityLevel</span>**
  - A priority for concurrent scheduler to create view and manage local change detection. It can be set as numeric value (1-5) or as string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).

**<span style="color: seaGreen">@Input()</span><br>
scheduledViewRenderCallback: (()<span style="color: blue"> => void </span>) | <span style="color: blue">null</span>**
  - A callback what will be called after view creation. This enables developers to perform actions when rendering has been done. The `scheduledViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered. The `scheduledViewRenderCallback` emits the latest value causing the view to update.
