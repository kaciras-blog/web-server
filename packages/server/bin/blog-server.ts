#!/usr/bin/env node
import { argv } from "node:process";
import { install } from "source-map-support";
import { Launcher } from "../lib/index.js";

install();

await new Launcher().run(argv.slice(2));
