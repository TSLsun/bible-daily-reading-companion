# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.2.1](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v2.2.0...bible-companion-v2.2.1) (2026-06-04)


### Bug Fixes

* raise scroll bar overlay above mobile tab bar ([#30](https://github.com/TSLsun/bible-daily-reading-companion/issues/30)) ([597cc50](https://github.com/TSLsun/bible-daily-reading-companion/commit/597cc501ad82ca02b52420954bf4cec82312b17e))

## [2.2.0](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v2.1.0...bible-companion-v2.2.0) (2026-05-24)


### Features

* cross-device sync via Cloudflare Worker + KV ([#28](https://github.com/TSLsun/bible-daily-reading-companion/issues/28)) ([8da263b](https://github.com/TSLsun/bible-daily-reading-companion/commit/8da263b8915e5e7609ca97cf9a44bac1f32c1056))

## [2.1.0](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v2.0.1...bible-companion-v2.1.0) (2026-05-22)


### Features

* custom scroll bar overlay with top/bottom nav (mobile + desktop) ([#24](https://github.com/TSLsun/bible-daily-reading-companion/issues/24)) ([af97b4f](https://github.com/TSLsun/bible-daily-reading-companion/commit/af97b4fa8b9c59f36ed13317c4baa21e6e0c8078))
* SearchPanel — book grid, chapter picker, and keyword search ([#20](https://github.com/TSLsun/bible-daily-reading-companion/issues/20)) ([ce1bc8d](https://github.com/TSLsun/bible-daily-reading-companion/commit/ce1bc8d9606a7b6beec40992e9e4a127510653dc))
* vim-inspired keyboard shortcuts with ? help modal ([#23](https://github.com/TSLsun/bible-daily-reading-companion/issues/23)) ([cb5c1ea](https://github.com/TSLsun/bible-daily-reading-companion/commit/cb5c1ea6f0519dc85cd57d4e380330c8ff02e703))


### Bug Fixes

* remove duplicate settings button from mobile header ([#22](https://github.com/TSLsun/bible-daily-reading-companion/issues/22)) ([3d0f8ee](https://github.com/TSLsun/bible-daily-reading-companion/commit/3d0f8ee9299ee9e24a4fe4764b359b8db64c87e2))

## [2.0.1](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v2.0.0...bible-companion-v2.0.1) (2026-05-16)


### Bug Fixes

* use PAT for Release Please so published releases trigger deploy ([#18](https://github.com/TSLsun/bible-daily-reading-companion/issues/18)) ([2797164](https://github.com/TSLsun/bible-daily-reading-companion/commit/27971648a51dc156e6beef13efccdd07a7cec4bf))

## [2.0.0](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v1.4.0...bible-companion-v2.0.0) (2026-05-16)


### ⚠ BREAKING CHANGES

* UI redesign — warm paper aesthetic, mobile layout, accent presets, book mode ([#15](https://github.com/TSLsun/bible-daily-reading-companion/issues/15))

### Features

* UI redesign — warm paper aesthetic, mobile layout, accent presets, book mode ([#15](https://github.com/TSLsun/bible-daily-reading-companion/issues/15)) ([d968aae](https://github.com/TSLsun/bible-daily-reading-companion/commit/d968aae665c57c51e36f085d099e0c0a1f350f0a))

## [1.4.0](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v1.3.0...bible-companion-v1.4.0) (2026-05-09)


### Features

* Add navigation to first unfinished day and next day in plan ([#13](https://github.com/TSLsun/bible-daily-reading-companion/issues/13)) ([3909ed1](https://github.com/TSLsun/bible-daily-reading-companion/commit/3909ed1b7e98af23d06c1cec29671f8ac0f694fa))

## [1.3.0](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v1.2.1...bible-companion-v1.3.0) (2026-04-29)


### Features

* support &lt;subheading&gt; and other HTML text in Bible verses ([b7f1c33](https://github.com/TSLsun/bible-daily-reading-companion/commit/b7f1c331f65ea478b2520f833616697bccecbfea))

## [1.2.1](https://github.com/TSLsun/bible-daily-reading-companion/compare/bible-companion-v1.2.0...bible-companion-v1.2.1) (2026-04-29)


### Bug Fixes

* use chinese book abbreviations for fhl api to avoid numeric prefix bug ([5e86ea1](https://github.com/TSLsun/bible-daily-reading-companion/commit/5e86ea1f86ff7a350c650f0b48f31225f12f9c93))

## [1.2.0](https://github.com/TSLsun/bible-daily-reading-companion/compare/v1.1.0...v1.2.0) (2026-04-15)


### Features

* make top-left logo a button to reload page ([a80afa6](https://github.com/TSLsun/bible-daily-reading-companion/commit/a80afa655ca4dec679c223e31eac0edf965264c4))
* implement release-please for automated release PRs and deployment ([ce01450](https://github.com/TSLsun/bible-daily-reading-companion/commit/ce014504d8ec295b9fc9cfb246b34c6087c473e8))


### Bug Fixes

* restore backward compatibility for bare IDs in navigation ([d49cd7d](https://github.com/TSLsun/bible-daily-reading-companion/commit/d49cd7d9fc1228a8b3957cc3c24e6389215c627f))
* restore plan-based navigation and add previous part button ([4bad03e](https://github.com/TSLsun/bible-daily-reading-companion/commit/4bad03e11480e2a00eabbb839cbea63446eafc2b))

## 1.1.0 (2026-04-12)


### 🚀 Performance Improvements

* persist migrated settings to localStorage immediately ([e05da99](https://github.com/TSLsun/bible-daily-reading-companion/commit/e05da99bd01493a4e55b753752f80ed7c4b6bf06))


### 🐛 Bug Fixes

* **app:** Enhance scroll-to-top and PWA configuration ([c920848](https://github.com/TSLsun/bible-daily-reading-companion/commit/c920848a18e0a3309172cb79b5da8e06d205de6e))
* calendar today highlight for YYYY-MM-DD date format ([02cbc4d](https://github.com/TSLsun/bible-daily-reading-companion/commit/02cbc4d09144937f3d92025660a53d5b9aa712bb))
* migrate legacy schedule JSON keys to YYYY-MM-DD format ([014899d](https://github.com/TSLsun/bible-daily-reading-companion/commit/014899d8a654d95af82e9cae85cd177920c320d4))
* Remove duplicate script and CSS link ([a3214d3](https://github.com/TSLsun/bible-daily-reading-companion/commit/a3214d3bd30c6d5509dadf52c1e339aa99e5d171))
* resolve CI dependency conflicts and adopt npm ci ([0bd5ba2](https://github.com/TSLsun/bible-daily-reading-companion/commit/0bd5ba24a9228a020961033193f13e3a22a9c4e1))


### ✨ Features

* Add ESM import maps for dependencies ([36ddc12](https://github.com/TSLsun/bible-daily-reading-companion/commit/36ddc12921ac51254c993fe235d9b0b5fd8a8823))
* add ncv version, app versioning, and reading enhancement ([9d303cf](https://github.com/TSLsun/bible-daily-reading-companion/commit/9d303cf9b06e0468652c4be5207cdd4a56dad3d7))
* Add Recovery Version to fallback translations ([43c9f96](https://github.com/TSLsun/bible-daily-reading-companion/commit/43c9f964a9aa3e25216aeba063f09d1470305e0f))
* automate versioning and tagging with standard-version ([7f14677](https://github.com/TSLsun/bible-daily-reading-companion/commit/7f14677b66abaea851b9978188d4553abb9050eb))
* configure project for GitHub Pages deployment ([856fa5f](https://github.com/TSLsun/bible-daily-reading-companion/commit/856fa5fc7ea83159da5e9559a34e34e3e108eb82))
* Enhance footer and add fallback translations ([68da4aa](https://github.com/TSLsun/bible-daily-reading-companion/commit/68da4aa6c3f83649cac950fd6b856a5fae64060e))
* Enhance PWA and rendering for Bible companion ([cdffa3d](https://github.com/TSLsun/bible-daily-reading-companion/commit/cdffa3d9393346763329fa8821250677beeb159f))
* fix loading icon color ([5ccac5f](https://github.com/TSLsun/bible-daily-reading-companion/commit/5ccac5fdb8a648bf54f82e86099dcde477683628))
* fix parsing logic to support searching by verse ([0a0bf6d](https://github.com/TSLsun/bible-daily-reading-companion/commit/0a0bf6d85573334c477fd65575cbad3a352b1279))
* fix the initial icon issue ([56a97fe](https://github.com/TSLsun/bible-daily-reading-companion/commit/56a97fe2782132f5ff41bd402bd2304826917357))
* Initialize Bible Daily Reading Companion project ([a501d1b](https://github.com/TSLsun/bible-daily-reading-companion/commit/a501d1b77c0619be8a888ec647b4a4138829953f))
* integrate ESLint, Husky, and lint-staged for code quality ([0b9912b](https://github.com/TSLsun/bible-daily-reading-companion/commit/0b9912b19de61701d9c390fe821b412c97bf85af))
* support multi-year reading plans and fix book rendering bugs ([59775af](https://github.com/TSLsun/bible-daily-reading-companion/commit/59775af99a4c36a2bd8a1ad4e8d9de992d61c97a))
* **ui:** Add import/export functionality ([0f5ee23](https://github.com/TSLsun/bible-daily-reading-companion/commit/0f5ee231f4e52c25925abf67640ae2c2ed5ea2ab))
* Update app icons and manifest ([e72c791](https://github.com/TSLsun/bible-daily-reading-companion/commit/e72c791634e7cfd68cde36ac1134c77349e7fc0d))
* Update Bible book codes and API endpoint ([3c817cc](https://github.com/TSLsun/bible-daily-reading-companion/commit/3c817cc99ef382e02e9c8115c65d2625f50c4ac8))
* update tsconfig and fix build issues ([c6760a3](https://github.com/TSLsun/bible-daily-reading-companion/commit/c6760a3701a3f54a82de6b864830cf4acfd5f97d))
* ux improving ([783e450](https://github.com/TSLsun/bible-daily-reading-companion/commit/783e4504b8142a28b7afe25cfcd6711f8ef4ac5b))
