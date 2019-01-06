import { Options } from "webpack";


/* =========================================================================== *\
								配置选项定义
\* =========================================================================== */

export interface WebServerConfiguration {
	dev?: DevelopmentOptions;
	webpack?: WebpackOptions;
}

export interface DevelopmentOptions {
	useHotClient?: boolean;
	slient?: boolean;
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";

	outputPath: string;	// webpack的输出目录
	publicPath: string;	// 公共资源的URL前缀，可以设为外部服务器等
	assetsDirectory: string;	// 公共资源输出目录，是outputPath的子目录

	bundleAnalyzerReport: boolean;

	client: {
		useBabel: boolean,
		parallel: boolean, // 多线程编译JS文件
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: any;
}

