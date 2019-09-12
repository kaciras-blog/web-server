import { Options as CorsOptions } from "@koa/cors";

// TODO: 通常做法是一套对外的选项，各组件也有自己的选项，在启动类里做转换。可是我懒得再设计了
// TODO: 注释写在页面项目里，要不要移过来？
export interface CliServerOptions {
	outputDir: string;
	assetsDir: string;

	blog: AppOptions;
	server: ServerOptions;
}

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
