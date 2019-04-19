import { Configuration } from "webpack";
import { DevelopmentApi } from "../build";


describe("webpack config resloving", () => {
	let api: DevelopmentApi;

	beforeEach(() => {
		api = new DevelopmentApi();
	});

	it("should resolve config", () => {
		api.addConfiguration("test", () => {
			return { entry: "test" };
		});

		const config = api.resloveConfig("test");
		expect(config).toEqual({ entry: "test" });

		expect(api.resloveConfig("notexist")).toBeUndefined();
	});

	it("should throw on self refrence", () => {
		api.addConfiguration("A", (_) => _.resloveConfig("A") as Configuration);
		expect(() => api.resloveConfig("A")).toThrowError(/Cyclic refrence/);
	});

	it("should throw on cyclic refrence", () => {

		api.addConfiguration("A", (_) => {
			return Object.assign({}, _.resloveConfig("B"));
		});
		api.addConfiguration("B", (_) => {
			return Object.assign({}, _.resloveConfig("A"));
		});

		expect(() => api.resloveConfig("B")).toThrowError();
	});

	it("should cache configured configs", () => {
		const counter = jest.fn(() => ({ entry: "test" }));

		api.addConfiguration("test", () => counter());

		api.resloveConfig("test");
		api.resloveConfig("test");
		const config = api.resloveConfig("test");

		expect(counter.mock.calls.length).toBe(1);
		expect(config).toEqual({ entry: "test" });
	});
});
