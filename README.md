<!-- SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru> -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# CSM Mapban

#### Author: [@goosemooz](https://github.com/goosemooz)

#### Maintainers: [@ch4og](https://github.com/ch4og)

CSM Mapban is a modern map veto/pick and overlay tool for tournaments. It
provides live‑synced lobbies, admin or auto flow, and OBS‑ready overlays with
flexible customization.

## Features

- Clean, responsive UI
- Admin mode or auto start when two teams join
- Real‑time sync via WebSockets
- OBS overlay (browser source)
- Configurable map pools/modes and card colors

### Quick start with Docker (prebuilt images)

Run the containers:

```bash
docker run -d -p 1703:4000 --name csm-mapban-backend ghcr.io/csmplay/csm-mapban-backend:latest
docker run -d -p 1702:3000 --name csm-mapban-frontend ghcr.io/csmplay/csm-mapban-frontend:latest
```

OR

Use docker compose:

```bash
wget https://raw.githubusercontent.com/csmplay/csm-mapban/main/docker-compose.yml
docker compose up -d
```

Open http://localhost:1702

### Build from source

#### Docker

1. Create env file:

```bash
cp .env.example .env
```

2. Start dev stack:

```bash
docker compose -f docker-compose-dev.yml up --build
```

Open http://localhost:1702

#### No Docker

Requirements: Node.js 20+ and Yarn 1.x.

1. Install dependencies

```bash
yarn install
```

2. Create .env:

```bash
cp .env.example .env
```

3. Build and start

```bash
yarn build
yarn start
```

Open http://localhost:3000

## License and Trademark Notice

### REUSE Compliance

This project is fully compliant with the
[REUSE Specification 3.3](https://reuse.software/spec-3.3/).

- Wherever technically possible, each source file contains SPDX-compliant
  license and copyright information directly in its header.
- For files where inline annotations are not feasible (for example, binary
  assets), the relevant information is provided in [REUSE.toml](./REUSE.toml).
- All license files can be found in the [LICENSES](./LICENSES) directory.

### Source Code License

The source code of this project is licensed under the **GNU Affero General
Public License v3.0 (AGPLv3-only)**.

The code is developed and maintained by **CyberSport Masters**.

### Trademarks

The **CyberSport Masters** and **CSM** logos are registered trademarks. They may
not be used, copied, modified, or distributed without explicit written
permission. Detailed rules on trademark usage can be found in the
[CyberSport Masters Trademark Policy](./LICENSES/LicenseRef-CyberSportMasters.txt).

### Third-Party Intellectual Property

This project incorporates certain game assets (such as maps, icons, and logos)
that are the intellectual property of their respective owners.

All such assets remain the property of their respective owners.\
Their inclusion is solely for purposes of identification, commentary, and
integration into new, transformative works that add significant value beyond the
original context. Such use is believed to constitute **fair use** under
applicable copyright law.

Use of these materials is subject to the rights and policies of the respective
companies. CyberSport Masters does **not** claim ownership of or affiliation
with these companies.

If you have any questions or concerns regarding the use of third-party assets,
please contact us at [git@csmpro.ru](mailto:git@csmpro.ru).
