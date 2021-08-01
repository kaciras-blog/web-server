const os = require("os");
const { fs } = require("memfs");

module.exports = fs;

// fs-extra 加载时需要访问这个属性，但测试没有用到，所以简单的 HACK 一下。
fs.realpath.native = { name: "native" };

// 解决临时目录不存在的问题。因为通常都会假定系统的临时目录是存在的，但memfs并不自动创建这个目录，
// 这就会造成文件夹不存在问题。
fs.mkdirSync(os.tmpdir(), { recursive: true });
