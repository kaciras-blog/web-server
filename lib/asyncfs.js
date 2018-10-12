const fs = require("fs");
const { promisify } = require("util");

module.exports = fs;

const accessAsync = promisify(fs.access);

module.exports.accessAsync = accessAsync;
module.exports.writeFileAsync = promisify(fs.writeFile);

module.exports.existsAsync = path =>
	accessAsync(path, fs.constants.F_OK).then(() => true).catch(() => false);
