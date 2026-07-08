# type

Minimal typing trainer for QWERTY, Dvorak, Colemak-DH, and my custom keyboard
layout "Baremak".

> [!NOTE]
> Due to GitHub's historic unreliability, active development is hosted on
> [Forgejo](https://forge.barrettruth.com/barrettruth/type).
> GitHub is maintained as a read-only mirror.

## Levels

The typing trainer is inspired by https://learn.dvorak.nl. "Levels" test
your typing abilities with generally increasing difficulty. All levels respect
the selected keyboard layout (for example, "home" tests asdf/aeou on QWERTY/Dvorak).

| Level | Name | How it is made |
| --- | --- | --- |
| 01 | home | the home row; 3-6 letters mixed with eligible [SCOWL](https://wordlist.aspell.net/) words |
| 02 | top | the home and top row, mixed with SCOWL words |
| 03 | bottom | the home and bottom row, mixed with SCOWL words |
| 04 | short | real lowercase SCOWL words less than 5 characters |
| 05 | prose | real lowercase SCOWL words of any length |
| 06 | caps | SCOWL words with a 75% lowercase, 12.5% title-case, 12.5% SCOWL abbreviation mix |
| 07 | punct | SCOWL words with a mix of puncutation and prose spans |
| 08 | numbers | Miscellant of generated numeric phrases including dates, times, counts, versions, etc. |
| 09 | symbols | Uniform random symbol tokens from the active layout's symbol set |
| 10 | sentences | Excerpts of Project Gutenberg texts sentences |
| 11 | code | Short code snippets of various languages including C++, Lua, and Python |

## Baremak

My custom layout "Baremak" keeps Colemak-DH letters and uses a custom layer for
convenience. See [my config](https://forge.barrettruth.com/barrettruth/nix/src/commit/7c01a83254aafceac8ae81400cdfb13fbf58feee/config/xkb/baremak) for the layout.

```text
base
q w f p b   j l u y ;
a r s t g   m n e i o '
z x c d v   k h , . /
```

```text
custom layer
! @ # < /   \ > & $ |
~ = [ { (   ) } ] - + `
% ^ * _ ?   : ; ' "
```

