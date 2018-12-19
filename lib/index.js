const log4js = require("log4js");
const service = require("./plugins/service");
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
			service(options, true);
			break;
		case "run":
			service(options, false);
			break;
		default:
			logger.error("Unresloved command: " + process.argv[3]);
	}
};
