import { Compiler, Plugin } from "webpack";
import { Hooks } from "html-webpack-plugin";

/**
 * 该插件依赖于 html-webpack-plugin，必须先加入它。
 */
export default class VueSSRTemplatePlugin implements Plugin {

	private readonly filename: string;
	private readonly el: string;

	constructor(filename: string, el: string) {
		this.filename = filename;
		this.el = el;
	}

	apply(compiler: Compiler): void {
		compiler.hooks.compilation.tap(VueSSRTemplatePlugin.name, (compilation) => {
			const hook = (compilation.hooks as Hooks).htmlWebpackPluginAfterHtmlProcessing;
			hook.tap(VueSSRTemplatePlugin.name, this.AfterHtmlProcessing.bind(this));
		});
	}

	AfterHtmlProcessing(data: any) {
		if (data.outputName === this.filename) {
			data.html = data.html.replace(this.el, "<!--vue-ssr-outlet-->");
		}
		return data;
	}
}
