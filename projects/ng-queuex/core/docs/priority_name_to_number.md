## Overloads
```ts
function priorityNameToNumber(priorityName: PriorityName): PriorityLevel;
function priorityNameToNumber(priorityName: PriorityName, debugFn: Function): PriorityLevel;
```
### Description
Converts Priority name to corresponding numeric value ('highest' => 1, 'high' => 2, 'normal' => 3, 'low' => 4, 'lowest' => 5).

**Params:**
 - `priorityName` - A name of priority ('highest', 'high', 'normal', 'low', 'lowest').
 - `debugFn` (optional) - A reference to the function making the assertion (used for the error message).

**Returns:** Numeric value of priority (1, 2, 3, 4, 5).

**Throws:** Error in invalid priority name is provided.

See also:
  - [priorityInputTransform()](./priority_input_transport.md).
  - [advancePriorityInputTransform()](./advance_priority_input_transport.md).
