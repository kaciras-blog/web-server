const config = require("./config");

config.contentRoot = "../wwwroot/dist";
config.imageRoot = "./image";

config.server.certificate = "/etc/letsencrypt/live/blog.kaciras.net/cert.pem";
config.server.privatekey = "/etc/letsencrypt/live/blog.kaciras.net/privkey.pem";

module.exports = config;
