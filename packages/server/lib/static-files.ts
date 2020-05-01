/**
 * koa-static 和 koa-send 扩展性不能满足本项目的需要，特别是缓存控制的部分，所以就自己撸一个。
 *
 * https://github.com/koajs/send
 * https://github.com/koajs/static
 */
import { basename, extname, join, normalize, parse, resolve, sep } from "path";
import { Middleware, Next, ParameterizedContext } from "koa";
import fs from "fs-extra";
import createError from "http-errors";

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/

const NOT_FOUND = ["ENOENT", "ENAMETOOLONG", "ENOTDIR"];

/**
 * Resolve relative path against a root path.
 *
 * 源代码来自：https://github.com/pillarjs/resolve-path
 * 因为原作者没有添加Typescript定义所以就抄过来了，有改动，删除了多余的检查。
 */
function resolvePath(root: string, path: string) {
	path = path.substr(parse(path).root.length);

	// containing NULL bytes is malicious
	if (path.indexOf("\0") !== -1) {
		throw createError(400, "Malicious Path");
	}

	// path outside root
	if (UP_PATH_REGEXP.test(normalize("." + sep + path))) {
		throw createError(403);
	}

	// join the relative path
	return normalize(join(resolve(root), path));
}

async function send(root: string, ctx: ParameterizedContext, next: Next) {
	const { method, path } = ctx;
	let file: string;

	if (method !== "GET" && method !== "HEAD") {
		return next();
	}

	try {
		file = decodeURIComponent(path);
	} catch (e) {
		return ctx.throw(400, "failed to decode");
	}
	file = resolvePath(root, file);

	let encodingExt = "";
	if (ctx.acceptsEncodings("br", "identity") === "br" && (await fs.pathExists(file + ".br"))) {
		file = file + ".br";
		encodingExt = ".br";
		ctx.set("Content-Encoding", "br");
	} else if (ctx.acceptsEncodings("gzip", "identity") === "gzip" && (await fs.pathExists(file + ".gz"))) {
		file = file + ".gz";
		encodingExt = ".gz";
		ctx.set("Content-Encoding", "gzip");
	}

	let stats: fs.Stats;
	try {
		stats = await fs.stat(file);
		if (stats.isDirectory()) {
			return next();
		}
	} catch (err) {
		if (NOT_FOUND.includes(err.code)) {
			return next();
		}
		err.status = 500;
		throw err;
	}

	if (encodingExt) {
		ctx.type = extname(basename(file, encodingExt));
	} else {
		ctx.type = extname(file);
	}

	if (path.startsWith("/static/")) {
		ctx.set("Cache-Control", "public,max-age=31536000,immutable");
	}

	ctx.set("Content-Length", stats.size.toString());
	ctx.set("Last-Modified", stats.mtime.toUTCString());
	ctx.body = fs.createReadStream(file);
}

export default function (root: string): Middleware {
	return (ctx, next) => send(root, ctx, next);
}
