// TODO: 注释写在页面项目里，要不要移过来？
import { join } from "path";

export interface BlogServerConfig {
	outputDir: string;
	assetsDir: string;

	server: ServerOptions;
	app: AppOptions;
	backend: BackendOptions;
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

export interface SeparatedStoreLocation {
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
	dataDir: string | SeparatedStoreLocation;

	serviceWorker?: boolean;
	requestTimeout: number;

	logging: SimpleLogConfig;
}

export interface BackendOptions {
	internal: string;
	cert?: string | true;
	public: string | AddersSelector;
}

export interface AddersSelector {
	http: string;
	https: string;
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
	dataDir: SeparatedStoreLocation;
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
