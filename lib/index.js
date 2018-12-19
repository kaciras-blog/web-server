const log4js = require("log4js");
const app = require("./app");
const build = require("./plugins/build");


module.exports = function (options) {
	// 捕获全局异常，将其输出到日志中。
	const logger = log4js.getLogger("system");
	process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
	process.on("uncaughtException", err => logger.error(err.message, err.stack));

	switch (process.argv[3]) {
		case "build":
			build(options.webpack);
			break;
		case "serve":
			app(options);
			break;
		default:
			logger.error("Unresloved command: " + process.argv[3]);
	}
};
