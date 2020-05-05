// TODO: 注释写在页面项目里，要不要移过来？
export interface BlogServerOptions {
	outputDir: string;
	assetsDir: string;

	blog: AppOptions;
	server: ServerOptions;
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
	host: string;
	serverAddress: string;
	dataDir: string;
	serverCert: string | true;

	serviceWorker?: boolean;
	useForwardedHeaders?: boolean;
	logging: SimpleLogConfig;
}

export interface ServerOptions {
	hostname?: string;
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
