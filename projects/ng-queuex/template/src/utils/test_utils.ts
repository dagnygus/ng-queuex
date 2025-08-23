import { Priority } from "@ng-queuex/core";

export function describePriorityLevel(priority: Priority, fn: () => void) {
  describe(`Priority level = ${Priority[priority]}.`, fn)
}
