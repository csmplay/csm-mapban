// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

const BASE = (process.env.NEXT_PUBLIC_CDN_BASE || "").replace(/\/+$/g, "");
const LOGO = (process.env.NEXT_PUBLIC_CDN_LOGO || "").replace(/\/+$/g, "");

const join = (p: string) => `${BASE}/${p.replace(/^\/+/, "")}`;
export const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/["«»]/g, "");

export const CDN = {
	base: BASE,
	raw: (path: string) => join(path),
	map: (game: string, name: string) => join(`mapban/${game}/maps/${slugify(name)}.jpg`),
	mode: (game: string, name: string) => join(`mapban/${game}/modes/${slugify(name)}.png`),
	logo: (game: string) => join(`mapban/${game}/logo.png`),
	coin: (result: number) => join(`mapban/coin_${result}.webm`),
	side: (game: string, side: string, variant?: "white" ) => {
		const base = `mapban/${game}/${side.toLowerCase()}`;
		return join(`${base}${variant === "white" ? "_white" : ""}.png`);
	},
	brand: () => join(LOGO),
} as const;

