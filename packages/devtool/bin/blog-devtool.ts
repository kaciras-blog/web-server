#!/usr/bin/env node
import { argv } from "node:process";
import launcher from "../lib/main.js";

await launcher.run(argv.slice(2));
