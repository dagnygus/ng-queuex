## Declaration
```ts
function detectChangesSync(cdRef: ChangeDetectorRef): boolean;
```
### Description
Tries to invoke `cdRef.detectChanges()` method synchronously, unless internal coalescing system will prevent this action. To learn more, see descriptions of `scheduleChangeDetection()` and `detectChanges()` functions.

**Param:** cdRef - A component `ChangeDetectorRef` or `ViewRef` of embedded view.<br>
**Returns:** true if succeeded, other wise it was coalesced with concurrent task.<br>
**Throws:** `Error` if integration was not provided.<br>
**Throws:** `Error` if is server environment.<br>
**Throws:** `Error` if integration for unit test is not completed.<br>
