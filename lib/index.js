const log4js = require("log4js");

/*
 * TODO:
 *   [ ] Reuseable middleware
 *   [ ] TypeScript
 *   [ ] Learn how to write a cli
 */

class ServerPluginList {

	constructor () {
		this.first = [];
		this.before = [];
		this.after = [];
		this.last = null;
	}

	// 全局预处理，不要返回
	addFirst (middleware) {
		this.first.push(middleware);
	}

	// 拦截和需要优先的处理
	addBeforeOptimizer (middleware) {
		this.before.push(middleware);
	}

	// 公共部分，大多都应添加在这
	addAfterOptimizer (middleware) {
		this.after.push(middleware);
	}

	setLastHandler (middleware) {
		this.last = middleware;
	}

	configure (instance) {
		const use = instance.use.bind(instance);
		this.first.forEach(use);
		this.before.forEach(use);
		this.after.forEach(use);
		use(this.last);
	}
}


class PluginRegistration {

	constructor () {
		this.webpackConfigurers = [];
		this.serverPlugins = new ServerPluginList();
		this.startupHooks = [];
	}

	addWebpackConfigurer (fn) {
		this.webpackConfigurers.push(fn);
	}

	addStartupHook (fn) {
		this.startupHooks.push(fn);
	}
}


module.exports = function (options) {
	// 捕获全局异常，将其输出到日志中。
	const logger = log4js.getLogger("system");
	process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
	process.on("uncaughtException", err => logger.error(err.message, err.stack));

	const registration = new PluginRegistration();
	options.plugins.forEach(p => p(registration));
	registration.startupHooks.forEach(cb => cb());
};
