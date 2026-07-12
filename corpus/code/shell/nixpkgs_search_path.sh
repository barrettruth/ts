addToSearchPathWithCustomDelimiter() {
    local delimiter="$1"
    local varName="$2"
    local dir="$3"
    if [[ -d "$dir" && "${!varName:+${delimiter}${!varName}${delimiter}}" \
          != *"${delimiter}${dir}${delimiter}"* ]]; then
        export "${varName}=${!varName:+${!varName}${delimiter}}${dir}"
    fi
}

addToSearchPath() {
    addToSearchPathWithCustomDelimiter ":" "$@"
}

# Prepend elements to variable "$1", which may come from an attr.
#
# This is useful in generic setup code, which must (for now) support
# both derivations with and without __structuredAttrs true, so the
# variable may be an array or a space-separated string.
#
# Expressions for individual packages should simply switch to array
# syntax when they switch to setting __structuredAttrs = true.
prependToVar() {
    local -n nameref="$1"
    local useArray type

    if [ -n "$__structuredAttrs" ]; then
        useArray=true
    else
        useArray=false
    fi

    # check if variable already exist and if it does then do extra checks
    if type=$(declare -p "$1" 2> /dev/null); then
        case "${type#* }" in
            -A*)
                echo "prependToVar(): ERROR: trying to use prependToVar on an associative array." >&2
                return 1 ;;
            -a*)
                useArray=true ;;
            *)
                useArray=false ;;
        esac
    fi

    shift

    if $useArray; then
        nameref=( "$@" ${nameref+"${nameref[@]}"} )
    else
        nameref="$* ${nameref-}"
    fi
}

# Same as above
appendToVar() {
    local -n nameref="$1"
    local useArray type

    if [ -n "$__structuredAttrs" ]; then
        useArray=true
    else
        useArray=false
    fi

    # check if variable already exist and if it does then do extra checks
    if type=$(declare -p "$1" 2> /dev/null); then
        case "${type#* }" in
            -A*)
                echo "appendToVar(): ERROR: trying to use appendToVar on an associative array, use variable+=([\"X\"]=\"Y\") instead." >&2
                return 1 ;;
            -a*)
                useArray=true ;;
            *)
                useArray=false ;;
        esac
    fi

    shift

    if $useArray; then
        nameref=( ${nameref+"${nameref[@]}"} "$@" )
    else
        nameref="${nameref-} $*"
    fi
}
