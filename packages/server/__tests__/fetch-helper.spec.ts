import { describe, expect, it } from "vitest";
import { buildURL } from "../lib/index";

describe("buildURL", () => {
	it.each([null, ""])("should ignore falsy base value %#", () => {
		expect(buildURL("", "http://example.com", {})).toBe("http://example.com/");
	});

	it("should build the URL", () => {
		const url = buildURL("http://alice@example.com/left", "/right#title", {
			bool: true,
			noe: null,
			number: 123,
			str: "string",
			empty: "",
		});
		expect(url).toBe("http://alice@example.com/right?bool=true&noe=null&number=123&str=string&empty=#title");
	});

	it("should ignore undefined value in params", () => {
		const params = { foo: undefined, bar: 1 };
		const url = buildURL(undefined, "http://example.com/p", params);
		expect(url).toBe("http://example.com/p?bar=1");
	});
});
