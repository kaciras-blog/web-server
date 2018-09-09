const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

module.exports = fs;

const accessAsync = promisify(fs.access);

module.exports.accessAsync = accessAsync;
module.exports.writeFileAsync = promisify(fs.writeFile);

module.exports.existsAsync = path =>
	accessAsync(path, fs.constants.F_OK).then(() => true).catch(() => false);

function ensureDirs (dirPath) {
	const parent = path.dirname(dirPath);
	if (fs.existsSync(parent) && fs.statSync(parent).isDirectory()) return;
	ensureDirs(parent);
	fs.mkdirSync(parent);
}

module.exports.mkdirs = dirPath => {
	ensureDirs(dirPath);
	if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) return;
	fs.mkdirSync(dirPath);
};
