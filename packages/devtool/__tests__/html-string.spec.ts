import { expect, it } from "vitest";
import htmlStringPlugin from "../lib/plugin/html-string";
import { runVite, testEntry } from "./test-utils";

it("should expand self-closed tags", async () => {
	const { output } = await runVite({
		plugins: [
			htmlStringPlugin(),
			testEntry("window.s = $HTML`<div class='flex'/>`;"),
		],
	});
	expect(output[0].code).toBe("window.s='<div class=\"flex\"></div>';\n");
});

it("should keep expressions", async () => {
	const { output } = await runVite({
		plugins: [
			htmlStringPlugin(),
			testEntry("window.s = $HTML`<meta ${GetAttrs()}>`;"),
		],
	});
	expect(output[0].code).toBe("window.s=`<meta ${GetAttrs()}>`;\n");
});

it("should remove whitespaces between tags", async () => {
	const { output } = await runVite({
		plugins: [
			htmlStringPlugin(),
			testEntry("window.s = $HTML`\n\t<div>\n\t\t<p> Text </p>\n\t</div>\n`;"),
		],
	});
	expect(output[0].code).toBe('window.s="<div><p>Text</p></div>";\n');
});
