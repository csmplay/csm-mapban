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
      packages.default = pkgs.stdenv.mkDerivation {
        pname = "csm-mapban";
        version = "1.0.0";
        
        src = ./.;
        
        nativeBuildInputs = [ bun pkgs.nodejs ];
        
        buildPhase = ''
          export HOME=$(mktemp -d)
          bun install --frozen-lockfile
          bun run --bun build
        '';
        
        installPhase = ''
          mkdir -p $out/bin $out/share/csm-mapban
          cp -r . $out/share/csm-mapban/
          
          # Create wrapper script
          cat > $out/bin/csm-mapban << EOF
          #!/bin/sh
          cd $out/share/csm-mapban
          exec ${bun}/bin/bun start
          EOF
          chmod +x $out/bin/csm-mapban
        '';
      };

      devShells.default = pkgs.mkShell {
        buildInputs = with pkgs; [bun git reuse docker];
      };

      apps = {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/csm-mapban";
        };
      };
    });
}
