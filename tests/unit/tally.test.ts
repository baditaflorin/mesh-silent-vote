import { describe, expect, it } from "vitest";
import { tally } from "../../src/features/vote/tally";

describe("tally", () => {
  it("does not invent a lead before an approval ballot exists", () => {
    const result = tally("approval", ["Nola", "Kismet"], []);

    expect(result.winner).toBeNull();
    expect(result.rows).toEqual([
      { option: "Kismet", value: 0, label: "0" },
      { option: "Nola", value: 0, label: "0" },
    ]);
  });

  it("uses every replicated approval ballot in the visible tally", () => {
    const result = tally(
      "approval",
      ["Nola", "Kismet"],
      [{ approvals: ["Nola"] }, { approvals: ["Nola", "Kismet"] }],
    );

    expect(result.winner).toBe("Nola");
    expect(result.rows).toEqual([
      { option: "Nola", value: 2, label: "2" },
      { option: "Kismet", value: 1, label: "1" },
    ]);
  });

  it("does not call an empty ranked room a winner", () => {
    const result = tally("ranked", ["Nola", "Kismet"], []);

    expect(result.winner).toBeNull();
  });
});
