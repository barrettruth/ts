unpackPhase() {
    runHook preUnpack

    if [ -z "${srcs:-}" ]; then
        if [ -z "${src:-}" ]; then
            # shellcheck disable=SC2016
            echo 'variable $src or $srcs should point to the source'
            exit 1
        fi
        srcs="$src"
    fi

    local -a srcsArray
    concatTo srcsArray srcs

    # To determine the source directory created by unpacking the
    # source archives, we record the contents of the current
    # directory, then look below which directory got added.  Yeah,
    # it's rather hacky.
    local dirsBefore=""
    for i in *; do
        if [ -d "$i" ]; then
            dirsBefore="$dirsBefore $i "
        fi
    done

    # Unpack all source archives.
    for i in "${srcsArray[@]}"; do
        unpackFile "$i"
    done

    # Find the source directory.

    # set to empty if unset
    : "${sourceRoot=}"

    if [ -n "${setSourceRoot:-}" ]; then
        runOneHook setSourceRoot
    elif [ -z "$sourceRoot" ]; then
        for i in *; do
            if [ -d "$i" ]; then
                case $dirsBefore in
                    *\ $i\ *)
                        ;;
                    *)
                        if [ -n "$sourceRoot" ]; then
                            echo "unpacker produced multiple directories"
                            exit 1
                        fi
                        sourceRoot="$i"
                        ;;
                esac
            fi
        done
    fi

    if [ -z "$sourceRoot" ]; then
        echo "unpacker appears to have produced no directories"
        exit 1
    fi

    echo "source root is $sourceRoot"

    # By default, add write permission to the sources.  This is often
    # necessary when sources have been copied from other store
    # locations.
    if [ "${dontMakeSourcesWritable:-0}" != 1 ]; then
        chmod -R u+w -- "$sourceRoot"
    fi

    runHook postUnpack
}


patchPhase() {
    runHook prePatch

    local -a patchesArray
    concatTo patchesArray patches

    local -a flagsArray
    concatTo flagsArray patchFlags=-p1

    for i in "${patchesArray[@]}"; do
        echo "applying patch $i"
        local uncompress=cat
        case "$i" in
            *.gz)
                uncompress="gzip -d"
                ;;
            *.bz2)
                uncompress="bzip2 -d"
                ;;
            *.xz)
                uncompress="xz -d"
                ;;
            *.lzma)
                uncompress="lzma -d"
                ;;
        esac

        # "2>&1" is a hack to make patch fail if the decompressor fails (nonexistent patch, etc.)
        # shellcheck disable=SC2086
        $uncompress < "$i" 2>&1 | patch "${flagsArray[@]}"
    done

    runHook postPatch
}
