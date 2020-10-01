import { isCaseSensitive, validateFilename } from "../lib/fs-utils";

it("should check case sensitive", () => {
	expect(isCaseSensitive(".")).toBe(process.platform !== "win32");
});

it.each([
	"",
	"foobar*.png",
	"foo/bar.png",
	"foo:bar.png",
	"foo|bar.png",
	"fo>o<bar.png",
	"NUL",
	"LPT9",
])("should validate filename %s", name => {
	expect(validateFilename(name, "win32")).toBe(false);
});

it.each([
	"foobar.png",
	"com2.png",
	"ends-with-dot.",
])("should validate filename %s", name => {
	expect(validateFilename(name, "win32")).toBe(true);
});
