import { Plugin, ResolvedConfig } from "vite";
import htmlnano from "htmlnano";
import MagicString from "magic-string";

/**
 * Does not work if attribute value contains "/>".
 */
const selfCloseRE = /<([^\s>]+)([^>]*)\/>/gs;

const minifyOptions = {
	minifyCss: false,
	minifyJs: false,
	collapseWhitespace: "all",
	removeAttributeQuotes: true,
};

async function process(html: string) {
	html = html.replaceAll(selfCloseRE, "<$1$2></$1>");
	return (await htmlnano.process(html, minifyOptions)).html;
}

/**
 *
 */
export default function htmlStringPlugin(): Plugin {
	let viteConfig: ResolvedConfig;

	return {
		name: "kaciras:html-string",

		configResolved(config) {
			viteConfig = config;
		},

		async transform(code, id) {
			if (id.includes("/node_modules/")) {
				return; // 因为没类型，标签可能跟三方库的重复，所以仅处理自己的代码。
			}

			const s = new MagicString(code);
			let i = code.indexOf("$HTML`");
			while (i >= 0) {
				const e = code.indexOf("`;", i);
				let html = code.slice(i + 6, e);

				html = await process(html);
				s.overwrite(i, e, "`" + html);
				i = code.indexOf("$HTML`", e);
			}

			if (!s.hasChanged()) {
				return null;
			}

			const { sourcemap } = viteConfig.build;
			return {
				code: s.toString(),
				map: sourcemap ? s.generateMap({ hires: true }) : null,
			};
		},
	};
}
