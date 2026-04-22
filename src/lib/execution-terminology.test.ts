import { describe, expect, it } from "vitest";

import { EXECUTION_TERMS, replaceExecutionTerminology } from "./execution-terminology";

describe("execution terminology", () => {
  it("maps job and lot labels to batch and bag wording", () => {
    expect(replaceExecutionTerminology("Job Workflow")).toBe("Batch Workflow");
    expect(replaceExecutionTerminology("Open next lot")).toBe("Open next bag");
  });

  it("exposes canonical batch and bag labels", () => {
    expect(EXECUTION_TERMS.batch.workflow).toBe("Batch Workflow");
    expect(EXECUTION_TERMS.bag.number).toBe("Bag Number");
  });
});
