# QueuexSwitchDefault class

## Selector: `'ng-template[qxSwitchDefault]'`

## Description

`QueuexSwitchDefault` (`*qxSwitchDefault`) is a companion structural directive for `QueuexSwitch` (`[qxSwitch]`). It defines a fallback template
that is rendered  when none of the `*qxSwitchCase` values match the parent `[qxSwitch]` expression.

The default view created by this directive is:
 - **Lazily instantiated** using the concurrent scheduler from `ng-queuex/core`.
 - **Detached from Angular’s logical tree**, ensuring it is independent of the  host component’s change detection.
 - Assigned its own **isolated reactive context**, so signals read directly in the
template can trigger local, fine-grained change detection.

If present, it guarantees that the switch will always render some content when no explicit case matches.

## Example

```html
<div [qxSwitch]="status">
  <p *qxSwitchCase="'loading'">Loading…</p>
  <p *qxSwitchCase="'success'">Data loaded ✅</p>
  <p *qxSwitchDefault>Nothing matched 🤷</p>
</div>
```
