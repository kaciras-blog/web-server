const fs = require("fs").promises;


/**
 * Node的 fs API 里没有很方便的判断文件存在并返回bool类型的函数，这里封装一个。
 *
 * @param path 路径
 * @return {Promise<boolean>} 如果存在将返回true，否则false
 */
module.exports.fileExist = function (path) {
	return fs.access(path).then(() => true).catch(() => false);
};
