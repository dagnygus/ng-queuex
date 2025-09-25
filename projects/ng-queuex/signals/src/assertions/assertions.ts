import { assertInInjectionContext } from "@angular/core";
import { CleanupScope } from "../cleanup_scope/cleanup_scope";

// export const NOT_IN_INJECTION_CONTEXT_MESSAGE =
//   ''

// /**
//  * Asserts that the current stack frame is within an injection context or in cleanup scope.
//  * @param debugFn A reference to function making the assertion.
//  */
// export function assertInInjectionContextOrInCleanupScope(debugFn: Function): void {
//   const scope = CleanupScope.current();
//   if (scope) {
//     return;
//   }

//   try {
//     assertInInjectionContext(debugFn);
//   } catch {
//     throw 
//   }
// }
