// 完全插件化之前的选项定义
import { Options } from "webpack";
import {CliServerOptions} from "kxc-server/OldOptions";

export interface WebpackOptions {
	mode: "development" | "production" | "none";

	outputPath: string;	// webpack的输出目录
	publicPath: string;	// 公共资源的URL前缀，可以设为外部服务器等
	assetsDirectory: string;	// 公共资源输出目录，是outputPath的子目录

	bundleAnalyzerReport: any;

	client: {
		useBabel: boolean,
		parallel: boolean, // 多线程编译JS文件
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		template: string;
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: any;
}

export interface DevServerOptions {
	useHotClient: boolean;
	slient: boolean;
}

export default interface CliDevelopmentOptions extends CliServerOptions {
	webpack: WebpackOptions;
	dev: DevServerOptions;
}
