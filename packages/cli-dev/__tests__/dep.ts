import { Configuration } from "webpack";
import { DevelopmentApi } from "../index";

describe("webpack config resloving", () => {

	it("should reslove config", () => {
		const d = new DevelopmentApi();
		d.addConfiguration("test", () => {
			return { mode: "development" };
		});

		const config = d.resloveConfig("test");
		expect(config).toEqual({ mode: "development" });

		expect(d.resloveConfig("notexist")).toBeUndefined();
	});

	it("should throw on self refrence", () => {
		const d = new DevelopmentApi();
		d.addConfiguration("A", (api) => api.resloveConfig("A") as Configuration);
		expect(() => d.resloveConfig("A")).toThrowError(/Cyclic refrence/);
	});

	it("should throw on cyclic refrence", () => {
		const d = new DevelopmentApi();

		d.addConfiguration("A", (api) => {
			return Object.assign({}, api.resloveConfig("B"));
		});
		d.addConfiguration("B", (api) => {
			return Object.assign({}, api.resloveConfig("A"));
		});

		expect(() => d.resloveConfig("B")).toThrowError();
	});

	it("should cache configured configs", () => {
		const counter = jest.fn(() => ({ entry: "test" }));
		const d = new DevelopmentApi();
		d.addConfiguration("test", () => counter());

		d.resloveConfig("test");
		d.resloveConfig("test");
		const config = d.resloveConfig("test");

		expect(counter.mock.calls.length).toBe(1);
		expect(config).toEqual({ entry: "test" });
	});
});
