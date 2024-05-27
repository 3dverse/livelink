#!/usr/bin/env node

import { name, description } from "../package.json";
import { program } from "commander";
import { generate } from "./generator";

//------------------------------------------------------------------------------
program
    .name(name)
    .description(description)
    .argument("<file_path>", "file path of an AscynAPI specification file")
    .option("--build-path <buildPath>", "Output of the generator", "./_prebuild/")
    .action(async (specFilePath: string, { options }: { options: {} }) => {
        await generate(specFilePath, options);
    });

//------------------------------------------------------------------------------
async function main() {
    try {
        await program.parseAsync();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

//------------------------------------------------------------------------------
main();
