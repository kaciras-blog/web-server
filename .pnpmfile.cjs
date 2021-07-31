/*
 * 部分 webpack 插件同时支持 4 和 5 版本，它们引用了 @types/webpack@4.x 会导致类型冲突。
 * 这里使用 pnpm 的扩展功能将 @types/webpack@4.x 的引用全部移除。
 *
 * 移除后类型仍是正确的，因为 webpack 4 和 5 的类型里插件的接口名字是一样的。
 */

function readPackage(pkg, context) {
	const { name, dependencies } = pkg;
	const webpackType = dependencies["@types/webpack"];

	if (/[~^]?4/.test(webpackType)) {
		delete dependencies["@types/webpack"];
		context.log(`Remove old webpack types for ${name}`);
	}

	return pkg;
}

module.exports = { hooks: { readPackage } };
