import { Compiler, Plugin } from "webpack";
import { getHooks } from "html-webpack-plugin";

/**
 * 生成额外的HTML文件，把其中的挂载点替换为 <!--vue-ssr-outlet--> 注释，并在<head>部分添加注入点。
 * 该插件依赖于 html-webpack-plugin，必须先加入它。
 *
 * TODO: 似乎从模板生成普通HTML更容易
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
				throw new Error("未找到指定的HTML模板，filename=" + this.filename);
			}
		});
		compiler.hooks.compilation.tap(SSRTemplatePlugin.name, (compilation) => {
			const hook = getHooks(compilation).beforeEmit;
			if (!hook) {
				throw new Error("请将 html-webpack-plugin 加入到构建中");
			}
			hook.tap(SSRTemplatePlugin.name, this.afterHtmlProcessing.bind(this));
		});
	}

	afterHtmlProcessing(data: any) {
		if (data.outputName === this.filename) {
			this.triggered = true;
			let html = data.html as string;

			const headEnd = html.indexOf("</head>");
			html = html.substring(0, headEnd) + "{{{meta}}}" + html.substring(headEnd);

			data.html = html
				.replace(/<title>[^<]*<\/title>/, "<title>{{title}}</title>")
				.replace(this.el, "<!--vue-ssr-outlet-->");
		}
		return data;
	}
}
