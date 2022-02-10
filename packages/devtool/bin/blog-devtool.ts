#!/usr/bin/env node
import { argv } from "node:process";
import { install } from "source-map-support";
import launcher from "../lib/main.js";

install();

await launcher.run(argv.slice(2));
