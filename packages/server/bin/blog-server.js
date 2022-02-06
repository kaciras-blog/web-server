#!/usr/bin/env node
import { install } from "source-map-support";
import { argv } from "node:process";
import { Launcher } from "../lib/index.js";

install();
new Launcher().run(argv.slice(2));
