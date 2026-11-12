import { describe, expect, it } from "vitest";
import { dropDominated, roomTitle } from "./RateList";

describe("room names", () => {
  it("drops a repeated bracket and rate names", () => {
    expect(roomTitle("Deluxe Room, 1 King Bed(1 King Bed)")).toBe("Deluxe Room, 1 King Bed");
    expect(roomTitle("Premier Room, 1 King Bed(1 King Bed) - Advantage Rate")).toBe("Premier Room, 1 King Bed");
    expect(roomTitle("DELUXE DOUBLE ROOM, CITY VIEW")).toBe("Deluxe Double Room, City View");
    expect(roomTitle("Junior Suite (Eiffel Tower view)")).toBe("Junior Suite (Eiffel Tower view)");
    expect(roomTitle("Superior Room Non-Refundable")).toBe("Superior Room Non-Refundable");
    expect(roomTitle("Superior Room - Non-Refundable")).toBe("Superior Room");
    expect(roomTitle("Deluxe Double room (full double bed) (bed type is subject to availability)")).toBe("Deluxe Double room (full double bed)");
  });
});

describe("price options", () => {
  const r = (refundable: boolean, readerPrice: number, board = "RO") => ({ refundable, readerPrice, board, cancelDeadline: refundable ? "2099-01-01" : null });
  it("hides a non refundable option that is not cheaper than a free one with the same meals", () => {
    const out = dropDominated([r(true, 4571), r(false, 4574), r(false, 4400), r(false, 4500, "BB")], (x) => x.refundable);
    expect(out.map((x) => `${x.refundable}:${x.readerPrice}:${x.board}`)).toEqual(["true:4571:RO", "false:4400:RO", "false:4500:BB"]);
  });
});
