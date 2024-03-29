import { join } from "path";

export interface BlogServerConfig {
	outputDir: string;
	assetsDir: string;
	ssr?: string;

	sentry: SentryOptions;
	server: ServerOptions;
	app: AppOptions;
	backend: BackendOptions;
	env: Record<string, any>;
}

export interface SentryOptions {
	dsn?: string;
	tunnel: boolean;
	authToken?: string;
	org?: string;
	project?: string;
}

export interface SimpleLogConfig {

	level: string;

	file?: string;

	/**
	 * 即使用了文件日志，还是保持控制台输出，使用此选项可以关闭控制台的输出。
	 *
	 * 【注意】
	 * 很多日志处理系统默认读取标准流，所以不建议关闭。
	 */
	noConsole?: boolean;
}

export interface DataStoreLocation {
	data: string;
	logs: string;
	cache: string;
}

export interface AppOptions {
	title: string;
	author: string;

	/**
	 * 本地数据存储目录，分为缓存、日志、数据三部分，可以分别指定；
	 * 也能只填一个字符串，此时将在该目录下创建三个子目录。
	 */
	dataDir: string | DataStoreLocation;

	serviceWorker?: boolean;

	logging: SimpleLogConfig;
}

export interface BackendOptions {
	timeout: number; // TODO: 还未实现
	internal: string;
	cert?: string | true;
	public: string | number | AddersSelector;
}

export interface AddersSelector {
	http: string | number;
	https: string | number;
}

export interface ServerOptions {
	hostname?: string;
	useForwardedHeaders?: boolean;

	connectors: Array<HttpServerOptions | HttpsServerOptions>;
}

export interface HttpServerOptions {
	version: 1 | 2;
	port: number;
	redirect?: string;
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

export interface ResolvedConfig extends BlogServerConfig {
	app: ResolvedAppOptions;
}

export interface ResolvedAppOptions extends AppOptions {
	dataDir: DataStoreLocation;
}

export function resolveConfig(config: BlogServerConfig) {
	const { app } = config;

	let dataDir = app.dataDir;
	if (typeof app.dataDir === "string") {
		dataDir = {
			logs: join(app.dataDir, "log"),
			cache: join(app.dataDir, "cache"),
			data: join(app.dataDir, "data"),
		};
	}

	return { ...config, app: { ...app, dataDir } } as ResolvedConfig;
}
