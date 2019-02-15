import { runServer } from "../app";
import http from "http";

const HTTP_URL = "http://localhost/";
const HTTPS_URL = "https://localhost/";

const OPTIONS = {
	tls: true,
	certificate: "D:/Coding/Utils/dev.pem",
	privatekey: "D:/Coding/Utils/dev.pvk",
	redirectHttp: true,
};

let closeFunction: () => void;

beforeAll(async () => {
	closeFunction = await runServer((req, res: any) => res.end("hellow"), OPTIONS);
});
afterAll(() => closeFunction());


describe("app.runServer", () => {

	it("should redirect to https", async (done) => {

		http.get(HTTP_URL, ((res) => {
			expect(res.statusCode).toEqual(301);
			expect(res.headers.location).toEqual(HTTPS_URL);
			done();
		})).end();
	});
});
