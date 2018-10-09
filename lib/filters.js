const axios = require("axios");

module.exports = async (ctx, next) => {
	await next();
};
