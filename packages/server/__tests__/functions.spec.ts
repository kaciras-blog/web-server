import { debounceFirst, once } from "../lib/functions";
import PromiseSource from "../lib/PromiseSource";

describe("debounceFirst", () => {

	it("should pass context", async () => {
		const obj = {
			value: 333,
			func() { return Promise.resolve(this.value); },
		};

		obj.func = debounceFirst(obj.func);
		expect(await obj.func()).toBe(333);
	});

	it("should avoid multiple calls", () => {return new Promise((done) => {
		let task!: PromiseSource<number>;
		const func = (a: number, b: number) => task = new PromiseSource();
		const debounced = debounceFirst(func);

		expect(debounced(5, 6)).toBe(debounced(3, 4));

		task.resolve(123);

		debounced(1, 2)
			.then((v) => expect(v).toBe(123))
			.then(done);
	})});

	it("should call after first resolved", async () => {
		const func = (x: number) => Promise.resolve(x * x);
		const debounced = debounceFirst(func);

		await debounced(3).then((v) => expect(v).toBe(9));
		await debounced(4).then((v) => expect(v).toBe(16));
	});

	it("should reset after exception", async () => {
		const debounced = debounceFirst(async (throws) => {
			if (throws) {
				throw new Error("test");
			}
			return 123456;
		});
		await expect(debounced(true)).rejects.toThrow();
		expect(await debounced(false)).toBe(123456);
	});
});

describe("once", () => {

	it("should pass context", () => {
		const obj = {
			value: 333,
			func() { return this.value; },
		};

		obj.func = once(obj.func);
		expect(obj.func()).toBe(333);
	});

	it("should skip subsequent calls", () => {
		let counter = 0;

		const func = jest.fn(() => counter++);
		const wrapped = once(func);

		expect(wrapped()).toBe(0);
		expect(wrapped()).toBe(0);

		expect(func.mock.calls).toHaveLength(1);
	});

	it("should allow calls after exception", () => {
		function testFn(throws: boolean) {
			if (throws) {
				throw new Error();
			}
			return 123456;
		}
		const func = jest.fn(testFn);
		const wrapped = once(func);

		expect(() => wrapped(true)).toThrow();
		expect(() => wrapped(true)).toThrow();
		expect(wrapped(false)).toBe(123456);

		expect(func.mock.calls).toHaveLength(3);
	});
});
