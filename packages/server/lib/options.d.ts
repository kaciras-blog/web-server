// TODO: 注释写在页面项目里，要不要移过来？
export interface BlogServerOptions {
	outputDir: string;
	assetsDir: string;

	server: ServerOptions;
	app: AppOptions;
	contentServer: ContentServerOptions;
}

interface SimpleLogConfig {

	level: string;

	file?: string;

	/**
	 * 即使用了文件日志，还是保持控制台输出，使用此选项可以关闭控制台的输出。
	 * 【注意】很多日志处理系统默认读取标准流，所以不建议关闭。
	 */
	noConsole?: boolean;
}

export interface AppOptions {
	title: string;
	author: string;

	dataDir: string;

	serviceWorker?: boolean;

	logging: SimpleLogConfig;
}

export interface ContentServerOptions {
	internalOrigin: string;

	cert: string | true;

	publicOrigin: string | AddersSelector;
}

export interface AddersSelector {
	http: string;
	https: string;
}

// ===================================================

export interface ServerOptions {
	hostname?: string;
	useForwardedHeaders?: boolean;

	http?: HttpServerOptions;
	https?: HttpsServerOptions;
}

export interface HttpServerOptions {
	port?: number;
	redirect?: number | true;
}

export interface HttpsServerOptions extends HttpServerOptions {
	keyFile: string;
	certFile: string;
	sni?: SNIProperties[];
}

export interface SNIProperties {
	cert: string;
	key: string;
	hostname: string;
}
