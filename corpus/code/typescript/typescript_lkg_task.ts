export const produceLKG = task({
    name: "LKG",
    description: "Makes a new LKG out of the built js files",
    dependencies: [local],
    run: async () => {
        if (!cmdLineOptions.bundle) {
            throw new Error("LKG cannot be created when --bundle=false");
        }

        const expectedFiles = [
            "built/local/tsc.js",
            "built/local/_tsc.js",
            "built/local/tsserver.js",
            "built/local/_tsserver.js",
            "built/local/tsserverlibrary.js",
            "built/local/tsserverlibrary.d.ts",
            "built/local/typescript.js",
            "built/local/typescript.d.ts",
            "built/local/typingsInstaller.js",
            "built/local/_typingsInstaller.js",
            "built/local/watchGuard.js",
        ].concat(libs().map(lib => lib.target));
        const missingFiles = expectedFiles
            .concat(localizationTargets)
            .filter(f => !fs.existsSync(f));
        if (missingFiles.length > 0) {
            throw new Error(
                "Cannot replace the LKG unless all built targets are present in directory 'built/local/'. The following files are missing:\n"
                    + missingFiles.join("\n"),
            );
        }

        await exec(process.execPath, ["scripts/produceLKG.mjs"]);
    },
});

export const lkg = task({
    name: "lkg",
    hiddenFromTaskList: true,
    dependencies: [produceLKG],
});

export const cleanBuilt = task({
    name: "clean-built",
    hiddenFromTaskList: true,
    run: () => fs.promises.rm("built", { recursive: true, force: true }),
});

export const clean = task({
    name: "clean",
    description: "Cleans build outputs",
    dependencies: [cleanBuilt, cleanDiagnostics],
});
