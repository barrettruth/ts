{
  description = "type.barrettruth.com";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    {
      nixpkgs,
      systems,
      ...
    }:
    let
      forEachSystem =
        f:
        nixpkgs.lib.genAttrs (import systems) (
          system:
          f (
            import nixpkgs {
              inherit system;
            }
          )
        );
      commonPackages = pkgs: [
        pkgs.biome
        pkgs.just
        pkgs.openssh
        pkgs.python3
        pkgs.rsync
      ];
    in
    {
      formatter = forEachSystem (pkgs: pkgs.nixfmt-tree);

      devShells = forEachSystem (pkgs: {
        default = pkgs.mkShell { packages = commonPackages pkgs; };
        ci = pkgs.mkShell { packages = commonPackages pkgs; };
      });
    };
}
