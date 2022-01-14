import { join } from "path";
import { tmpdir } from "os";
import fs from "fs-extra";
import LocalFileStore from "../lib/LocalFileStore";

const root = fs.mkdtempSync(join(tmpdir(), "test-"));

const config = {
	data: join(root, "data"),
	cache: join(root, "cache"),
	logs: "UNUSED",
};

let store: LocalFileStore;

beforeEach(() => {
	store = new LocalFileStore(config, "image");
});
afterEach(() => fs.rmSync(root, { recursive: true }));


it("should get null if file not exists", () => {
	return expect(store.load("foobar.txt")).resolves.toBeNull();
});

it("should get null if cache not exists", () => {
	return expect(store.getCache("foobar", {})).resolves.toBeNull();
});

it("should save new file if not exists", async () => {
	const isNew = await store.save("foobar.txt", "bob");

	const path = join(config.data, "image", "foobar.txt");
	expect(isNew).toBe(true);
	expect(fs.readFileSync(path, "utf8")).toBe("bob");
});

it("should skip existing file on save",async () => {
	const path = join(config.data, "image", "foobar.txt");
	fs.writeFileSync(path, "alice");

	const isNew = await store.save("foobar.txt", "bob");

	expect(isNew).toBe(false);
	expect(fs.readFileSync(path, "utf8")).toBe("alice");
});
