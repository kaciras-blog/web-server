const fs = require("fs").promises;


module.exports.fileExist = function (path) {
	return fs.access(path).then(() => true).catch(() => false);
};
