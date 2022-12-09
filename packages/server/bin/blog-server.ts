#!/usr/bin/env node
import { argv } from "node:process";
import { Launcher } from "../lib/index.js";

await new Launcher().run(argv.slice(2));
