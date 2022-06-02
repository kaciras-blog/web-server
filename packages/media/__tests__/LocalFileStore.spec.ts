import { join } from "path";
import { tmpdir } from "os";
import fs from "fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LocalFileStore from "../lib/LocalFileStore";

const root = fs.mkdtempSync(join(tmpdir(), "test-"));

const sourceDir = join(root, "data");
const cacheDir = join(root, "cache");

let store: LocalFileStore;

beforeEach(() => {
	store = new LocalFileStore(sourceDir, cacheDir);
});
afterEach(() => fs.rmSync(root, { recursive: true }));

it("should get null if file not exists", () => {
	return expect(store.load("foobar.txt")).resolves.toBeNull();
});

it("should get null if cache not exists", () => {
	return expect(store.getCache("foobar", {})).resolves.toBeNull();
});

describe("listCache", () => {
	it("should return null if cache zone is not exists", async () => {
		expect(await store.listCache("NOT_EXISTS")).toBeNull();
	});

	it("should return [] if cache zone is empty", async () => {
		fs.mkdirSync(join(cacheDir, "foobar"));
		expect(await store.listCache("foobar")).toHaveLength(0);
	});

	it("should return all of cache item params", async () => {
		const zone = join(cacheDir, "foobar");
		fs.mkdirSync(zone);
		fs.writeFileSync(join(zone, "type=1&codec=av1"), "");
		fs.writeFileSync(join(zone, "type=2&encoding=br"), "");

		const [a, b] = (await store.listCache("foobar"))!;

		expect(a).toStrictEqual({ type: "1", codec: "av1" });
		expect(b).toStrictEqual({ type: "2", encoding: "br" });
	});
});

it("should load the file", async () => {
	const path = join(sourceDir, "foobar.txt");
	fs.writeFileSync(path, "alice");

	const result = (await store.load("foobar.txt"))!;

	// ReadStream 不关闭会影响文件删除，造成下面一个测试错误。
	result.data.destroy();
	await new Promise(resolve => result.data.close(resolve));

	expect(result.size).toBe(5);
	expect(result.data).toBeTruthy();
	expect(result.mtime.getTime()).toBeGreaterThan(1642320000000);
});

it("should save new file if not exists", async () => {
	const isNew = await store.save("foobar.txt", "bob");

	const path = join(sourceDir, "foobar.txt");
	expect(isNew).toBe(true);
	expect(fs.readFileSync(path, "utf8")).toBe("bob");
});

it("should skip existing file on save", async () => {
	const path = join(sourceDir, "foobar.txt");
	fs.writeFileSync(path, "alice");

	const isNew = await store.save("foobar.txt", "bob");

	expect(isNew).toBe(false);
	expect(fs.readFileSync(path, "utf8")).toBe("alice");
});
