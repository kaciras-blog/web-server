import path from "path";
import MemoryFs from "memory-fs";
import HtmlWebpackPlugin from "html-webpack-plugin";
import SSRTemplatePlugin from "../lib/webpack/SSRTemplatePlugin";
import webpack = require("webpack");

it("should inject outlet and {{{meta}}}", (done) => {
	const fs = new MemoryFs();
	const compiler = webpack({
		entry: path.join(__dirname, "resources/a.js"),
		plugins: [
			new HtmlWebpackPlugin({
				template: path.join(__dirname, "resources/template.html"),
				filename: "/index.html",
			}),
			new SSRTemplatePlugin("/index.html", '<div id="app"></div>'),
		],
	});
	compiler.outputFileSystem = fs;
	compiler.run((err, stats) => {
		if (stats.hasErrors()) {
			console.error(stats.toJson());
		}
		const output = fs.readFileSync("/index.html", "utf8");
		expect(output).toMatch("{{{meta}}}");
		expect(output).toMatch("<!--vue-ssr-outlet-->");
		done();
	});
});
