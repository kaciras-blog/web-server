import {debounceFirst, once } from "../functions";
import PromiseCompletionSource from "../PromiseCompletionSource";

describe("debounceFirst", () => {

	it("should pass context", async () => {
		const obj = {
			value: 333,
			func() { return Promise.resolve(this.value); },
		};

		obj.func = debounceFirst(obj.func);
		expect(await obj.func()).toBe(333);
	});

	it("should avoid multiple calls", (done) => {
		let task!: PromiseCompletionSource<number>;
		const func = (a: number, b: number) => task = new PromiseCompletionSource();
		const debounced = debounceFirst(func);

		expect(debounced(5, 6)).toBe(debounced(3, 4));

		task.resolve(123);

		debounced(1, 2)
			.then((v) => expect(v).toBe(123))
			.then(done);
	});

	it("should call after first resolved", async () => {
		const func = (x: number) => Promise.resolve(x * x);
		const debounced = debounceFirst(func);

		await debounced(3).then((v) => expect(v).toBe(9));
		await debounced(4).then((v) => expect(v).toBe(16));
	});

	it("should reset after exception", async (done) => {
		const debounced = debounceFirst(async (throws) => {
			if (throws) {
				throw new Error();
			}
			return 123456;
		});
		try {
			await debounced(true);
			done.fail("expect to throws");
		} catch (e) {
			expect(await debounced(false)).toBe(123456);
			done();
		}
	});
});

