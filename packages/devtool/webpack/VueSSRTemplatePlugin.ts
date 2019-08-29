import { Compiler, Plugin } from "webpack";
import { Hooks } from "html-webpack-plugin";

/**
 * 生成额外的HTML文件，该文件把HTML模板中的挂载点替换为服务端渲染的 <!--vue-ssr-outlet--> 注释。
 * 该插件依赖于 html-webpack-plugin，必须先加入它。
 */
export default class VueSSRTemplatePlugin implements Plugin {

	private readonly filename: string;
	private readonly el: string;

	/**
	 * 创建该插件的实例
	 *
	 * @param filename 模板源文件名，通常与 html-webpack-plugin 的 filename 选项相同
	 * @param el 挂载点元素，通常是<div id=app></div>
	 */
	constructor(filename: string, el: string) {
		this.filename = filename;
		this.el = el;
	}

	apply(compiler: Compiler): void {
		compiler.hooks.compilation.tap(VueSSRTemplatePlugin.name, (compilation) => {
			const hook = (compilation.hooks as unknown as Hooks).htmlWebpackPluginAfterHtmlProcessing;
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
