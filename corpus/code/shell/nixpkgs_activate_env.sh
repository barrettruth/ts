_activatePkgs() {
    local hostOffset targetOffset
    local pkg

    for hostOffset in "${allPlatOffsets[@]}"; do
        local pkgsVar="${pkgAccumVarVars[hostOffset + 1]}"
        for targetOffset in "${allPlatOffsets[@]}"; do
            (( hostOffset <= targetOffset )) || continue
            local pkgsRef="${pkgsVar}[$targetOffset - $hostOffset]"
            local pkgsSlice="${!pkgsRef}[@]"
            for pkg in ${!pkgsSlice+"${!pkgsSlice}"}; do
                activatePackage "$pkg" "$hostOffset" "$targetOffset"
            done
        done
    done
}

# Run the package setup hooks and build _PATH
_activatePkgs

# Set the relevant environment variables to point to the build inputs
# found above.
#
# These `depOffset`s, beyond indexing the arrays, also tell the env
# hook what sort of dependency (ignoring propagatedness) is being
# passed to the env hook. In a real language, we'd append a closure
# with this information to the relevant env hook array, but bash
# doesn't have closures, so it's easier to just pass this in.
_addToEnv() {
    local depHostOffset depTargetOffset
    local pkg

    for depHostOffset in "${allPlatOffsets[@]}"; do
        local hookVar="${pkgHookVarVars[depHostOffset + 1]}"
        local pkgsVar="${pkgAccumVarVars[depHostOffset + 1]}"
        for depTargetOffset in "${allPlatOffsets[@]}"; do
            (( depHostOffset <= depTargetOffset )) || continue
            local hookRef="${hookVar}[$depTargetOffset - $depHostOffset]"
            if [[ -z "${strictDeps-}" ]]; then

                # Keep track of which packages we have visited before.
                local visitedPkgs=""

                # Apply environment hooks to all packages during native
                # compilation to ease the transition.
                #
                # TODO(@Ericson2314): Don't special-case native compilation
                for pkg in \
                    "${pkgsBuildBuild[@]}" \
                    "${pkgsBuildHost[@]}" \
                    "${pkgsBuildTarget[@]}" \
                    "${pkgsHostHost[@]}" \
                    "${pkgsHostTarget[@]}" \
                    "${pkgsTargetTarget[@]}"
                do
                    if [[ "$visitedPkgs" = *"$pkg"* ]]; then
                        continue
                    fi
                    runHook "${!hookRef}" "$pkg"
                    visitedPkgs+=" $pkg"
                done
            else
                local pkgsRef="${pkgsVar}[$depTargetOffset - $depHostOffset]"
                local pkgsSlice="${!pkgsRef}[@]"
                for pkg in ${!pkgsSlice+"${!pkgsSlice}"}; do
                    runHook "${!hookRef}" "$pkg"
                done
            fi
        done
    done
}

# Run the package-specific hooks set by the setup-hook scripts.
_addToEnv
