import { Compiler, Plugin } from "webpack";
import { Hooks } from "html-webpack-plugin";

/**
 * 生成额外的HTML文件，把其中的挂载点替换为 <!--vue-ssr-outlet--> 注释，并在<head>部分添加注入点。
 * 该插件依赖于 html-webpack-plugin，必须先加入它。
 */
export default class SSRTemplatePlugin implements Plugin {

	private readonly filename: string;
	private readonly el: string;

	private triggered = false;

	/**
	 * 创建该插件的实例
	 *
	 * @param filename 模板源文件名，与 html-webpack-plugin 的 filename 选项相同
	 * @param el 挂载点元素，通常是<div id=app></div>
	 */
	constructor(filename: string, el: string) {
		this.filename = filename;
		this.el = el;
	}

	apply(compiler: Compiler): void {
		compiler.hooks.afterEmit.tap(SSRTemplatePlugin.name, () => {
			if (!this.triggered) {
				throw new Error("SSRTemplatePlugin：未找到指定的HTML模板，filename=" + this.filename);
			}
		});
		compiler.hooks.compilation.tap(SSRTemplatePlugin.name, (compilation) => {
			const hook = (compilation.hooks as Hooks).htmlWebpackPluginAfterHtmlProcessing;
			if (!hook) {
				throw new Error("请将 html-webpack-plugin 加入到构建中");
			}
			hook.tap(SSRTemplatePlugin.name, this.afterHtmlProcessing.bind(this));
		});
	}

	afterHtmlProcessing(data: any) {
		if (data.outputName === this.filename) {
			let { html } = data;
			this.triggered = true;

			const headEnd = html.indexOf("</head>");
			html = html.substring(0, headEnd) + "{{{meta}}}" + html.substring(headEnd);
			data.html = html.replace(this.el, "<!--vue-ssr-outlet-->");
		}
		return data;
	}
}
