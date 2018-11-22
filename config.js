module.exports = {
	logLevel: "info",
	fileLog: false,

	contentRoot: "D:/Project/Blog/WebContent/dist",
	imageRoot: "G:/备份/blog.kaciras.net/image",

	cacheMaxAge: 30 * 24 * 60 * 60 * 1000,
	cors: {
		maxAge: 864000,
		exposeHeaders: ["Location"],
		allowHeaders: ["X-CSRF-Token", "X-Requested-With", "Content-Type"],
		credentials: true,
	},

	server: {
		port: 80,
		tls: true,
		httpsPort: 443,
		certificate: "D:/Coding/Utils/dev.pem",
		privatekey: "D:/Coding/Utils/dev.pvk",
		redirectHttp: true,
	},

	apiServer: "https://localhost:2375",
};
