export const generateTypesMap = task({
    name: "generate-types-map",
    run: async () => {
        await fs.promises.mkdir("./built/local", { recursive: true });
        const source = "src/server/typesMap.json";
        const target = "built/local/typesMap.json";
        const contents = await fs.promises.readFile(source, "utf-8");
        JSON.parse(contents); // Validates that the JSON parses.
        await fs.promises.writeFile(target, contents.replace(/\r\n/g, "\n"));
    },
});

// Drop a copy of diagnosticMessages.generated.json into the built/local folder. This allows
// it to be synced to the Azure DevOps repo, so that it can get picked up by the build
// pipeline that generates the localization artifacts that are then fed into the translation process.
const builtLocalDiagnosticMessagesGeneratedJson = "built/local/diagnosticMessages.generated.json";
const copyBuiltLocalDiagnosticMessages = task({
    name: "copy-built-local-diagnostic-messages",
    dependencies: [generateDiagnostics],
    run: async () => {
        const contents = await fs.promises.readFile(diagnosticMessagesGeneratedJson, "utf-8");
        JSON.parse(contents); // Validates that the JSON parses.
        await fs.promises.writeFile(builtLocalDiagnosticMessagesGeneratedJson, contents);
    },
});

export const otherOutputs = task({
    name: "other-outputs",
    description: "Builds miscelaneous scripts and documents distributed with the LKG",
    dependencies: [typingsInstaller, watchGuard, generateTypesMap, copyBuiltLocalDiagnosticMessages],
});

export const watchOtherOutputs = task({
    name: "watch-other-outputs",
    description: "Builds miscelaneous scripts and documents distributed with the LKG",
    hiddenFromTaskList: true,
    dependencies: [watchTypingsInstaller, watchWatchGuard, generateTypesMap, copyBuiltLocalDiagnosticMessages],
});

export const local = task({
    name: "local",
    description: "Builds the full compiler and services",
    dependencies: [localize, tsc, tsserver, services, lssl, otherOutputs, dts],
});
export default local;

export const watchLocal = task({
    name: "watch-local",
    description: "Watches the full compiler and services",
    hiddenFromTaskList: true,
    dependencies: [localize, watchTsc, watchTsserver, watchServices, lssl, watchOtherOutputs, dts, watchSrc],
});

const runtestsDeps = [tests, generateLibs].concat(cmdLineOptions.typecheck ? [dts] : []);

export const runTests = task({
    name: "runtests",
    description: "Runs the tests using the built run.js file.",
    dependencies: runtestsDeps,
    run: () => runConsoleTests(testRunner, "mocha-fivemat-progress-reporter", /*runInParallel*/ false),
});
