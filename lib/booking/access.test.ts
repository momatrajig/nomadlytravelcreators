import { describe, expect, it } from "vitest";
import { accessCookie, accessValue, emailFromAccess } from "./access";

describe("booking access cookie", () => {
  it("round trips the lead email for the same booking", () => {
    expect(emailFromAccess("NMD 231821", accessValue("NMD 231821", "a@b.co"))).toBe("a@b.co");
    expect(emailFromAccess("NMD231821", accessValue("NMD 231821", "a@b.co"))).toBe("a@b.co");
  });
  it("rejects another booking, a forged email and junk", () => {
    const v = accessValue("NMD 231821", "a@b.co");
    expect(emailFromAccess("NMD 999999", v)).toBe("");
    expect(emailFromAccess("NMD 231821", `${Buffer.from("x@y.co").toString("base64url")}.${v.split(".")[1]}`)).toBe("");
    expect(emailFromAccess("NMD 231821", "nope")).toBe("");
    expect(emailFromAccess("NMD 231821", undefined)).toBe("");
  });
  it("names one cookie per booking", () => {
    expect(accessCookie("NMD 1")).not.toBe(accessCookie("NMD 2"));
    expect(accessCookie("NMD 1")).toMatch(/^bk_[0-9a-f]{12}$/);
  });
});
