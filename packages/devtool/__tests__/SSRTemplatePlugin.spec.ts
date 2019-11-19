import path from "path";
import MemoryFs from "memory-fs";
import HtmlWebpackPlugin from "html-webpack-plugin";
import SSRTemplatePlugin from "../lib/webpack/SSRTemplatePlugin";
import webpack, { Configuration } from "webpack";

function runWebpack(config: Configuration) {
	return new Promise<MemoryFs>((resolve, reject) => {
		const outputFs = new MemoryFs();
		const compiler = webpack(config);
		compiler.outputFileSystem = outputFs;

		compiler.run((err, stats) => {
			if (err) {
				return reject(err);
			}
			if (stats.hasErrors()) {
				const message = stats.toString({
					children: true,
				});
				return reject(new Error(message));
			}
			return resolve(outputFs);
		});
	});
}

it("should inject outlet and {{{meta}}}", async () => {
	const fs = await runWebpack({
		entry: path.join(__dirname, "resources/entry.js"),
		plugins: [
			new HtmlWebpackPlugin({
				template: path.join(__dirname, "resources/template.html"),
				filename: "/index.html",
			}),
			new SSRTemplatePlugin("/index.html", '<div id="app"></div>'),
		],
	});
	const output = fs.readFileSync("/index.html", "utf8");
	expect(output).toMatch("{{{meta}}}");
	expect(output).toMatch("<!--vue-ssr-outlet-->");
});

it("should throw error on html-webpack-plugin found", () => {
	const task = runWebpack({
		entry: path.join(__dirname, "resources/entry.js"),
		plugins: [
			new SSRTemplatePlugin("/index.html", '<div id="app"></div>'),
		],
	});
	return expect(task).rejects.toBeInstanceOf(Error);
});

it("should throw error on no template matched", () => {
	const task = runWebpack({
		entry: path.join(__dirname, "resources/entry.js"),
		plugins: [
			new HtmlWebpackPlugin({
				template: path.join(__dirname, "resources/template.html"),
				filename: "/non-match.html",
			}),
			new SSRTemplatePlugin("/index.html", '<div id="app"></div>'),
		],
	});
	return expect(task).rejects.toBeInstanceOf(Error);
});
