import { Options as CorsOptions } from "@koa/cors";

export interface CliServerOptions {
	outputDir: string;	// webpack的输出目录
	assetsDir: string;	// 公共资源的URL前缀，可以设为外部服务器等

	blog: AppOptions;
	server: ServerOptions;
}

/** 对应配置的 blog 属性 */
export interface AppOptions {
	imageRoot: string;
	cors?: CorsOptions;

	serverAddress: string;
	https?: boolean;
	serverCert: string | true;
}

export interface ServerOptions {
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
