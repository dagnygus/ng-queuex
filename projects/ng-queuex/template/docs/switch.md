# QueuexSwitch class

## Selector: `'[qxSwitch]:not(ng-template)'`

## Descriptions
`QueuexSwitch` (`[qxSwitch]`) is the core structural directive of the switch family, designed as a drop-in replacement for Angular’s `NgSwitch` **(restricted to immutable objects)**. It enables conditional rendering of templates based on the value of an expression, in combination with `QueuexSwitchCase` (`*qxSwitchCase`) and `QueuexSwitchDefault` (`*qxSwitchDefault`).

Each embedded view created by `QueuexSwitch` is:
  - **Lazily instantiated** using the concurrent scheduler from `ng-queuex/core`.
  - **Detached from Angular’s logical tree**, ensuring that it does not participate in the host component’s change detection cycle.
  - Assigned its own **isolated reactive context**, which means signals read directly
  in the template can trigger fine-grained, independent change detection.

When the `[qxSwitch]` expression changes, the directive activates the first matching `*qxSwitchCase` view (or the `*qxSwitchDefault` view if no case matches). Because views are scheduled and detached, rendering is both efficient and predictable, even for complex UI states.

## Server side fallback
On the server side, `QueuexSwitch` behaves like Angular’s native `NgSwitch`. No detached views or reactive contexts are created, and no concurrent scheduling takes place. All cases are evaluated synchronously, ensuring predictable and performant SSR output.

## Overriding default priority
To override default priority for `[qxSwitch]` (that applies also for `*qxSwitchCase` and `*qxSwitchDefault`) , use `provideQueuexSwitchDefaultPriority()` in providers array. 

## Example

```ts
<div [qxSwitch]="status">
  <p *qxSwitchCase="'loading'">Loading...</p>
  <p *qxSwitchCase="'success'">Data loaded successfully ✅</p>
  <p *qxSwitchCase="'error'">Something went wrong ❌</p>
  <p *qxSwitchDefault>Unknown state 🤔</p>
</div>
```

## Inputs

**<span style="color: seaGreen">@Input(</span>{ required: <span style="color: blue">true</span> }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxSwitch(value: <span style="color: purple">any | Signal\<any></span>)**

**<span style="color: seaGreen">@Input(</span>{ transform: advancePriorityInputTransform }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> priority(priority: <span style="color: purple"> PriorityLevel | Signal\<PriorityLevel></span>)**
  - A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
  This input also accepts the signal of the previously mentioned values.

## Outputs
**<span style="color: blue">readonly</span> render: <span style="color: purple">OutputEmitterRef</span>**
  - A output what will be emitted when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done. The `render` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered. The `render` emits the latest value causing the view to update.
