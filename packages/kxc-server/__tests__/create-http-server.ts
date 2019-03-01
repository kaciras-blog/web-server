import { runServer, createSNICallback } from "../app";
import http from "http";
import https from "https";
import tls, { Server, TLSSocket } from "tls";
import constants from "constants";
import { StringDecoder } from "string_decoder";
import path from "path";
import fs from "fs-extra";


const HTTP_URL = "http://localhost/";
const HTTPS_URL = "https://localhost/";

const OPTIONS = {
	tls: true,
	certificate: "D:/Coding/Utils/dev.pem",
	privatekey: "D:/Coding/Utils/dev.pvk",
	redirectHttp: true,
};

describe("app.runServer", () => {
	let close: () => void;

	beforeAll(async () => {
		close = await runServer((req, res: any) => res.end("hellow"), OPTIONS);
	});

	afterAll(() => close());

	it("should redirect to https", async (done) => {
		http.get(HTTP_URL, ((res) => {
			expect(res.statusCode).toEqual(301);
			expect(res.headers.location).toEqual(HTTPS_URL);
			done();
		})).end();
	});
});

describe("SNI callback", () => {
	let server: tls.Server;

	function resloveResource (name: string) {
		return path.join(__dirname, "resources", name);
	}

	beforeAll((done) => {
		const sniCallback = createSNICallback([{
			hostname: "localhost",
			cert: resloveResource("localhost.crt"),
			key: resloveResource("localhost.pvk"),
		}, {
			hostname: "127.0.0.2",
			cert: resloveResource("127_0_0_2.crt"),
			key: resloveResource("127_0_0_2.pvk"),
		}]);

		server = tls.createServer({
			SNICallback: sniCallback,
		}, (socket) => {
			socket.write("HELLOW");
			socket.end();
		});

		server.listen(41000, done);
	});

	afterAll(() => server.close());

	function verifyCertCN (servername: string) {
		return new Promise((resolve, reject) => {
			const socket = tls.connect({
				host: servername,
				port: 41000,
				rejectUnauthorized: false,
				servername,
			});
			socket.on("secureConnect", () => {
				const cert = socket.getPeerCertificate();
				expect(cert.subject.CN).toEqual(servername);
			});
			socket.on("data", (data) => {
				expect(data.length).toBeGreaterThan(5);
				resolve();
				socket.end();
			});
			socket.on("error", reject);
		});
	}

	it("should accept localhost", () => {
		return verifyCertCN("localhost");
	});

	it("should accept mutiple times", async () => {
		await verifyCertCN("127.0.0.2");
		await verifyCertCN("127.0.0.2");
		await verifyCertCN("127.0.0.2");
	});
});
