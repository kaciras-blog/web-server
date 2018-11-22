const config = require("./config");

config.contentRoot = "../content/dist";
config.imageRoot = "./image";

config.server.certificate = "/etc/letsencrypt/live/blog.kaciras.net/cert.pem";
config.server.certificate = "/etc/letsencrypt/live/blog.kaciras.net/privkey.pem";

module.exports = config;
