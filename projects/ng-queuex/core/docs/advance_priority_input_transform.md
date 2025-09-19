## Declaration
```ts
function advancePriorityInputTransform(value: PriorityInput | Signal<PriorityInput>): PriorityLevel | Signal<PriorityLevel>
```
### Description
Transforms priority names to it's raw numeric values or transforms signal to computed signal with the same manner.

**Param:** value - Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5) or signal providing the same values.

See also: 
  - [PriorityInput](./priority_input.md).
  - [PriorityName](./priority_name.md).
  - [PriorityLevel](./priority_level.md).
