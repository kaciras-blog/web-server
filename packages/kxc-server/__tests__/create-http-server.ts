import { runServer } from "../app";
import http from "http";

const HTTP_URL = "http://localhost/";
const HTTPS_URL = "https://localhost/";
const REQUEST_HANDLER = () => {};

describe("app.runServer", () => {

	it("should redirect to https", (done) => {
		runServer(REQUEST_HANDLER, { redirectHttp: true });

		http.get(HTTP_URL, ((res) => {
			expect(res.statusCode).toEqual(301);
			expect(res.headers.location).toEqual(HTTPS_URL);
			done();
		}));
	});
});
