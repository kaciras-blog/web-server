import { hashName } from "../lib/common";

it("should generate hash name", () => {
	const name = hashName(Buffer.from("foobar"));
	expect(name).toBe("PJ4QJiiZf0Ssh7CxMcaZ");
});
