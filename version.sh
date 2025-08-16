#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
# SPDX-License-Identifier: AGPL-3.0-only

set -euo pipefail

npm version "$1" || false
VERSION=$(jq -r '.version' package.json)
echo "$VERSION" > apps/frontend/public/version || false
git add apps/frontend/public/version || false
git commit --amend --no-edit || false
git tag -f "v$VERSION" || false