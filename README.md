<!-- SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru> -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# CSM Mapban

[![REUSE status](https://api.reuse.software/badge/git.in.csmpro.ru/csmpro/mapban)](https://api.reuse.software/info/git.in.csmpro.ru/csmpro/mapban)
[![Latest release](https://git.in.csmpro.ru/csmpro/mapban/badges/release.svg)](https://git.in.csmpro.ru/csmpro/mapban/releases/latest)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-blue?logo=open-source-initiative&logoColor=white)](./LICENSE)
[![Service status](https://img.shields.io/website?url=https%3A%2F%2Fmapban.csmpro.ru&label=service&up_message=online&down_message=down&up_color=brightgreen&down_color=red&logo=rocket&logoColor=white)](https://mapban.csmpro.ru/)
[![Source code at CSM Git](https://img.shields.io/badge/source-CSM%20Git-24292e?logo=forgejo&logoColor=white)](https://git.in.csmpro.ru/csmpro/mapban)

CSM Mapban is a modern map veto and pick tool for tournaments, featuring
live-synced lobbies and OBS-ready overlays.

![CSM Mapban screenshot](https://cdn.csmpro.ru/mapban/screenshot.png)

## Features

- Clean, responsive UI
- Admin mode or auto start when two teams join
- Real‑time sync via WebSockets
- OBS overlay (browser source)
- Configurable map pools/modes and card colors

## Getting Started

### Production Deployment

For production deployment, you need to configure a reverse proxy (nginx, Caddy,
etc.) to route API requests to the backend:

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /api/ {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Using Prebuilt Images (Docker)

The easiest way to run CSM Mapban in production:

```bash
docker run -d git.in.csmpro.ru/csmpro/csm-mapban/backend:latest
docker run -d git.in.csmpro.ru/csmpro/csm-mapban/frontend:latest
```

Or with docker compose:

```bash
wget http://git.in.csmpro.ru/csmpro/csm-mapban/releases/download/latest/docker-compose.yml
docker compose up -d
```

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

The source code of this project is licensed under the **[GNU Affero General
Public License v3.0](./LICENSE) (AGPLv3-only)**.

The code is developed and maintained by **CyberSport Masters**.

### Trademarks

The **CyberSport Masters** and **CSM** logos are registered trademarks. They may
not be used, copied, modified, or distributed without explicit written
permission.