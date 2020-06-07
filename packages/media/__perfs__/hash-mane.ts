/*
 * 因为要对上传的文件做Hash，故测试了常用的一些Hash函数性能。
 *
 * md5              - 57.62 ms
 * sha3_256         - 125.29 ms
 * sha2_256         - 94.65 ms
 * murmurHash3_sync - 5.73 ms
 */
import crypto from "crypto";
import { performance } from "perf_hooks";
import { murmurHash128 } from "murmurhash-native";

const buffer = crypto.randomBytes(1024 * 1024);

function md5() {
	return crypto.createHash("md5").update(buffer).digest("hex");
}

function sha3_256() {
	return crypto.createHash("sha3-256").update(buffer).digest("hex");
}

function sha2_256() {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function murmurHash3_sync() {
	return murmurHash128(buffer, "hex");
}

async function test(func: any) {
	const start = performance.now();
	let result;
	for (let i = 0; i < 32; i++) {
		result = func();
	}
	const end = performance.now();

	console.log("\n" + func.name);
	console.log(result);
	console.log(`${(end - start).toFixed(2)} ms`);
}

test(sha3_256);
test(sha2_256);
test(md5);
test(murmurHash3_sync);
