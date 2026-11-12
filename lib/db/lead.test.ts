import { describe, expect, it } from "vitest";
import { leadWith } from "./lead";

describe("cover photo", () => {
  const imgs = [{ url: "a" }, { url: "b" }, { url: "c" }];
  it("moves the chosen photo first and keeps the rest in order", () => expect(leadWith(imgs, "c").map((x) => x.url)).toEqual(["c", "a", "b"]));
  it("ignores an unknown or missing cover", () => { expect(leadWith(imgs, "z")).toBe(imgs); expect(leadWith(imgs, null)).toBe(imgs); });
});
