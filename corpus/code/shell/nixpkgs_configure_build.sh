configurePhase() {
    runHook preConfigure

    # set to empty if unset
    : "${configureScript=}"

    if [[ -z "$configureScript" && -x ./configure ]]; then
        configureScript=./configure
    fi

    if [ -z "${dontFixLibtool:-}" ]; then
        export lt_cv_deplibs_check_method="${lt_cv_deplibs_check_method-pass_all}"
        local i
        find . -iname "ltmain.sh" -print0 | while IFS='' read -r -d '' i; do
            echo "fixing libtool script $i"
            fixLibtool "$i"
        done

        # replace `/usr/bin/file` with `file` in any `configure`
        # scripts with vendored libtool code.  Preserve mtimes to
        # prevent some packages (e.g. libidn2) from spontaneously
        # autoreconf'ing themselves
        CONFIGURE_MTIME_REFERENCE=$(mktemp configure.mtime.reference.XXXXXX)
        find . \
          -executable \
          -type f \
          -name configure \
          -exec grep -l 'GNU Libtool is free software; you can redistribute it and/or modify' {} \; \
          -exec touch -r {} "$CONFIGURE_MTIME_REFERENCE" \; \
          -exec sed -i s_/usr/bin/file_file_g {} \;    \
          -exec touch -r "$CONFIGURE_MTIME_REFERENCE" {} \;
        rm -f "$CONFIGURE_MTIME_REFERENCE"
    fi

    if [[ -z "${dontAddPrefix:-}" && -n "$prefix" ]]; then
        # For __structuredAttrs: if prefixKey ends in a space,
        # we need to add the prefixKey and the prefix as separate entries,
        # and since we prepend, we do it in reverse order.
        local -r prefixKeyOrDefault="${prefixKey:---prefix=}"
        if [ "${prefixKeyOrDefault: -1}" = " " ]; then
            prependToVar configureFlags "$prefix"
            prependToVar configureFlags "${prefixKeyOrDefault::-1}"
        else
            prependToVar configureFlags "$prefixKeyOrDefault$prefix"
        fi
    fi

    if [[ -f "$configureScript" ]]; then
        # Add --disable-dependency-tracking to speed up some builds.
        if [ -z "${dontAddDisableDepTrack:-}" ]; then
            if grep -q dependency-tracking "$configureScript"; then
                prependToVar configureFlags --disable-dependency-tracking
            fi
        fi

        # By default, disable static builds.
        if [ -z "${dontDisableStatic:-}" ]; then
            if grep -q enable-static "$configureScript"; then
                prependToVar configureFlags --disable-static
            fi
        fi

        if [ -z "${dontPatchShebangsInConfigure:-}" ]; then
            patchShebangs --build "$configureScript"
        fi
    fi

    if [ -n "$configureScript" ]; then
        local -a flagsArray
        concatTo flagsArray configureFlags configureFlagsArray

        echoCmd 'configure flags' "${flagsArray[@]}"
        # shellcheck disable=SC2086
        $configureScript "${flagsArray[@]}"
        unset flagsArray
    else
        echo "no configure script, doing nothing"
    fi

    runHook postConfigure
}


buildPhase() {
    runHook preBuild

    if [[ -z "${makeFlags-}" && -z "${makefile:-}" && ! ( -e Makefile || -e makefile || -e GNUmakefile ) ]]; then
        echo "no Makefile or custom buildPhase, doing nothing"
    else
        foundMakefile=1

        # shellcheck disable=SC2086
        local flagsArray=(
            ${enableParallelBuilding:+-j${NIX_BUILD_CORES}}
            SHELL="$SHELL"
        )
        concatTo flagsArray makeFlags makeFlagsArray buildFlags buildFlagsArray

        echoCmd 'build flags' "${flagsArray[@]}"
        make ${makefile:+-f $makefile} "${flagsArray[@]}"
        unset flagsArray
    fi

    runHook postBuild
}
