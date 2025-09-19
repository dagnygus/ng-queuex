# QueuexSwitchCase class

## Selector: `'ng-template[qxSwitchCase]'`

## Description

`QueuexSwitchCase` (`*qxSwitchCase`) is a companion structural directive to  `QueuexSwitch` (`[qxSwitch]`). It defines a template block that is rendered when the bound `qxSwitch` expression matches the provided case value.

Each case view created by this directive is:
 - **Lazily instantiated** through the concurrent scheduler from `ng-queuex/core`.
 - **Detached from Angular’s logical tree**, so it is not affected by the host component’s change detection cycle.
 - Given its own **isolated reactive context**, which allows signals read directly in the template to trigger local, fine-grained change detection.

When the parent `[qxSwitch]` value changes, `QueuexSwitchCase` views are efficiently  scheduled and activated or destroyed depending on whether their case matches.

## Server side fallback
During server-side rendering, `QueuexSwitchCase` falls back to the behavior of  Angular’s native `NgSwitchCase`. Views are instantiated
synchronously and remain part of the standard logical view tree. No detachment, no isolated reactive contexts, and no scheduling are applied — ensuring clean, fast, and predictable SSR output.

## Example
```html
<div [qxSwitch]="status">
  <p *qxSwitchCase="'loading'">Loading…</p>
  <p *qxSwitchCase="'success'">Data loaded ✅</p>
  <p *qxSwitchCase="'error'">Something went wrong ❌</p>
  <p *qxSwitchDefault>Unknown state 🤔</p>
</div>
 ```
## Inputs
**<span style="color: seaGreen">@Input(</span>{ required: <span style="color: blue">true</span> }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxSwitchCase(value: <span style="color: purple">any | Signal\<any></span>)**
