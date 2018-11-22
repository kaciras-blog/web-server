const base = require("./config");

base.contentRoot = "../content/dist";
base.imageRoot = "./image";

base.server.certificate = "/etc/letsencrypt/live/blog.kaciras.net/cert.pem";
base.server.certificate = "/etc/letsencrypt/live/blog.kaciras.net/privkey.pem";

module.exports = base;
