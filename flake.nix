{
  description = "CSM Mapban";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
      bun = pkgs.bun;
    in {
      devShells.default = pkgs.mkShell {
        buildInputs = with pkgs; [bun git reuse];
        NODE_ENV = "development";
      };

      apps = {
        default = {
          type = "app";
          program = "${pkgs.writeShellScript "csm-mapban" ''
            TMPDIR=$(mktemp -d)
            trap "chmod -R +w $TMPDIR 2>/dev/null || true; rm -rf $TMPDIR" EXIT
            
            cp -r ${toString ./.}/* $TMPDIR/
            chmod -R +w $TMPDIR
            cd $TMPDIR
            
            ${bun}/bin/bun install --frozen-lockfile
            
            export PATH="${bun}/bin:$PATH"
            ${bun}/bin/bun run --bun build
            
            ${bun}/bin/bun start
          ''}";
        };
      };
    });
}
