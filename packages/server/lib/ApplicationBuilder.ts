import Koa, { Middleware } from "koa";

export interface ClassPlugin {
	configureCliServer(builder: ApplicationBuilder): void;
}

export type FunctionPlugin = (builder: ApplicationBuilder) => void;

/**
 * 把 Koa 的中间件分下组，便于解耦。
 */
export default class ApplicationBuilder {

	private readonly beforeAll: Middleware[] = [];
	private readonly beforeFilter: Middleware[] = [];
	private readonly filter: Middleware[] = [];
	private readonly resource: Middleware[] = [];

	private fallBack?: Middleware;

	build() {
		const app = new Koa();
		const setup = app.use.bind(app);

		this.beforeAll.forEach(setup);
		this.beforeFilter.forEach(setup);
		this.filter.forEach(setup);
		this.resource.forEach(setup);

		if (this.fallBack) {
			app.use(this.fallBack);
		}
		return app;
	}

	/** 做一些全局处理的中间件，比如CORS、访问日志，请求体解析 */
	useBeforeAll(middleware: Middleware) {
		this.beforeAll.push(middleware);
	}

	/** 不希望被其他插件干涉的中间件，比如webpack的热更新不能被压缩 */
	useBeforeFilter(middleware: Middleware) {
		this.beforeFilter.push(middleware);
	}

	/** 拦截和资源优化的中间件，比如压缩、屏蔽、全局权限 */
	useFilter(middleware: Middleware) {
		this.filter.push(middleware);
	}

	/** 资源中间件，比如静态文件、图片存储服务 */
	useResource(middleware: Middleware) {
		this.resource.push(middleware);
	}

	/**
	 * 用于处理之前中间件没处理的请求，这个中间件通常有自己的路由机制，例如服务端渲染。
	 * 这个中间件只能设置一次，多次调用说明插件有冲突。
	 */
	useFallBack(middleware: Middleware) {
		if (this.fallBack) {
			throw new Error("A fall back middleware already exists.");
		}
		this.fallBack = middleware;
	}

	addPlugin(plugin: FunctionPlugin | ClassPlugin) {
		if (typeof plugin === "function") {
			plugin(this);
		} else {
			plugin.configureCliServer(this);
		}
	}
}
