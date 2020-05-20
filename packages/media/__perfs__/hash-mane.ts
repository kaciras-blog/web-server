import crypto from "crypto";
import { performance } from "perf_hooks";
import { murmurHash128 } from "murmurhash-native";

const buffer = crypto.randomBytes(1024 * 1024);

function sha3_256() {
	return crypto.createHash("sha3-256").update(buffer).digest("base64");
}

function sha2_256() {
	return crypto.createHash("sha256").update(buffer).digest("base64");
}

function md5() {
	return crypto.createHash("md5").update(buffer).digest("base64");
}

function murmurHash3_sync() {
	return murmurHash128(buffer, "base64");
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
