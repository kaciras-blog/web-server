import { isCaseSensitive, validateFilename } from "../lib/fs-utils";

it("should check case sensitive", () => {
	expect(isCaseSensitive(".")).toBe(process.platform !== "win32");
});

it.each([
	["foobar.png", true],
	["com2.png", true],
	["ends-with-dot.", true],

	["", false],
	["foobar*.png", false],
	["foo/bar.png", false],
	["foo:bar.png", false],
	["foo|bar.png", false],
	["fo>o<bar.png", false],
	["NUL", false],
	["LPT9", false],
])("should validate filename %s", (name, result) => {
	expect(validateFilename(name, "win32")).toBe(result);
});
