import { expect, it } from "vitest";
import { hashName } from "../lib/common";

it("should generate hash name", () => {
	const name = hashName(Buffer.from("foo+bar"));
	expect(name).toBe("ZBLARqvF4-_cDUmPkjsH");
});
