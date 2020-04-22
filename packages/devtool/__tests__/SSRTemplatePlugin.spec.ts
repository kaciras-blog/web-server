import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import SSRTemplatePlugin from "../lib/webpack/SSRTemplatePlugin";
import { resolveFixture, runWebpack } from "./test-utils";

it("should insert inject points", async () => {
	const fs = await runWebpack({
		entry: resolveFixture("entry-empty.js"),
		plugins: [
			new HtmlWebpackPlugin({
				template: resolveFixture("template.html"),
				filename: "/index.html",
			}),
			new SSRTemplatePlugin("/index.html", '<div id="app"></div>'),
		],
	});

	const output = fs.readFileSync("/index.html", "utf8");
	expect(output).toMatch("<title>{{title}}</title>");
	expect(output).toMatch("{{{meta}}}");
	expect(output).toMatch("<!--vue-ssr-outlet-->");
});

// it("should throw error on no template matched", () => {
// 	const task = runWebpack({
// 		entry: path.join(__dirname, "fixtures/entry-empty.js"),
// 		plugins: [
// 			new HtmlWebpackPlugin({
// 				template: path.join(__dirname, "fixtures/template.html"),
// 				filename: "/non-match.html",
// 			}),
// 			new SSRTemplatePlugin("/index.html", '<div id="app"></div>'),
// 		],
// 	});
// 	return expect(task).rejects.toBeInstanceOf(Error);
// });
