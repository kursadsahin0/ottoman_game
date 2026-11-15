# Ottoman Legacy — release and monetization plan

Prepared 29 October 2026. This is a proposal based on the checked repository,
not evidence that the game is ready for a public launch. No monetization code is
part of this plan.

## Recommendation

When ready to sell, launch as a **single paid premium game** with one purchase
and no ads, in-game purchases, or gameplay advantages for sale. This suits a
focused simulation, avoids billing infrastructure, and is easy to explain.
Choose price only after estimating finished content and regional pricing; this
plan does not assign an unvalidated price.

The repository describes a playable vertical slice, not a finished commercial
campaign. Gate public launch on a complete beginning-to-end campaign, device
testing, support and privacy materials, store assets, and a signed release
build. If a preview is needed sooner, make it a clearly labeled free demo and
the full paid game a separate product. Do not add a paid unlock until the full
product and purchase support exist.

## Monetization options

| Model | Complexity | Player expectations | Platform and maintenance | Fit |
| --- | --- | --- | --- | --- |
| Paid premium | Low | Complete, coherent game for one price; no ads or pay-to-win | Paid-app setup and store pricing; no game-side billing for a single paid download. One product and save path. | Recommended for the eventual full game. |
| Free demo + paid full game | Medium/high | Demo stands on its own and has clear limits; full version adds substantial play | Two listings/build variants or in-app entitlement, billing, and demo-save transfer. Maintain both. | Possible later; not a shortcut to shipping an incomplete game. |
| Optional cosmetics | Medium | Optional, clearly priced, never obscure normal play | Billing, restore/entitlement support, catalog and asset QA. | Defer until there is demand. |
| Separate expansions | Medium/high | Base game remains complete; each pack has a clear scope and compatibility promise | Store products, entitlements, content versioning, combination QA and support. | Best future add-on if substantial campaigns are made. |
| Paid historical scenarios | High | Each scenario is researched, authored, tested, and distinct | Scenario tooling, billing, historical review, save compatibility, and per-pack support. | Defer; do not imply certification. |

No loot boxes, battle ads, energy timers, pay-to-win items, or deliberate base-
game frustration. Later paid packs should add a complete experience rather than
make the base campaign feel incomplete.

## Minimum viable release

### Verified product basis in this repository

Current documentation and automated checks support a local single-player
isometric settlement simulation with keyboard and touch controls; crop planting,
growth and harvest; a small market and land loop; seven scheduled fictional
residents with interaction; calendar, weather, local events; family history and
succession systems; political, historical, quest and battle systems; local
save/load with JSON import/export and backup recovery. The browser smoke suite
checks desktop and mobile-sized layouts, touch, IndexedDB, scene restarts,
assets, and save/load. System tests passing does not establish campaign
completeness, balance, or Android quality.

### Proposed launch promise

For the first paid version, promise only a complete, tested **early-frontier
campaign** centered on one settlement, farming and trade, a generational family
chronicle, succession, and a finite set of local political and historical
decisions. Before using that promise, confirm every loop is reachable in the
release build, can be completed, persists after save/load, has instructions,
and works on supported physical devices. The current README calls the build a
vertical slice and says there is no live enemy encounter actor for the touch
attack control; combat must not be promised until resolved and verified.
Exclude any system not accessible and end-to-end tested.

### Future expansion proposals (not available content)

- Additional historical periods with separate research and period-accurate art.
- New Anatolian and neighboring regional maps and settlement relationships.
- Authored campaign scenarios with alternative political constraints.
- Deeper family, inheritance, alliance and political systems if playtests show
  they add worthwhile choices.

Do not list or sell any proposed expansion until implemented, content-complete,
and tested. Cosmetics are not in the launch plan.

## Draft store listing

Current Play Console limits are 30 characters for the app name, 80 for short
description, and 4,000 for full description. Recheck at submission.

**Name:** Ottoman Legacy

**Short description (77 characters):**

Build a family’s fortunes in an isometric simulation on the Ottoman frontier.

**Long description:**

Begin a life on the early Ottoman frontier. Tend your fields, bring grain to
market, meet the people of a small settlement, and leave a record for the family
that follows you.

Ottoman Legacy is a single-player isometric simulation about work, community,
and the passage of generations. Follow the calendar as crops grow, make choices
in village encounters, and keep your campaign in a family chronicle.

Features in the current game:

- Plant, grow, and harvest wheat and barley across the seasons.
- Trade crops and supplies in the local market.
- Explore an isometric frontier settlement with keyboard or touch controls.
- Meet fictional residents who follow daily routines and remember selected
  interactions.
- Advance the calendar, experience changing weather, and resolve local events.
- Preserve campaign progress in local saves, with save export and import.

This is a fictional simulation inspired by the early Ottoman frontier. Named
residents and local events are fictional. The game is not an official or
certified historical reference.

Before publication, remove any feature not reachable in the release build. If
family succession or political decisions are release-ready and part of the
player-facing loop, add those specific claims then. This copy does not claim
multiplayer, cloud saves, historical certification, or available expansions.

## Store assets and capture plan

1. Capture clean in-game screenshots on the release build: settlement overview,
   farm action, market transaction, resident interaction, and family
   chronicle/succession only if those panels are release-ready. Show real UI and
   state; do not composite unavailable features.
2. Include device types requested by Play Console (currently at least two
   screenshots across device types). Current image guidance: JPEG or 24-bit PNG,
   320–3,840 px, with long dimension no more than twice the short dimension.
   Capture phone and supported larger-screen layouts instead of stretching.
3. Prepare a 512×512 PNG app listing icon (32-bit with alpha, max 1 MB) and a
   1024×500 JPEG or 24-bit PNG feature graphic without alpha. Use original,
   licensed art, readable silhouettes, and no fake awards, badges, or unsupported
   feature claims.
4. Promotional illustration is optional. Keep early Anatolian frontier art
   period-aware and maintain source/license records. Do not use third-party
   game art.
5. A preview video is optional; if created, record actual gameplay and caption
   it accurately.

Verify current asset/device rules in [Google Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

## Devices, operating systems and privacy

### Supported devices and OS

- Android is configured for minimum API 24, compile API 36, target API 36, and
  runs through Capacitor/WebView. Treat API 24+ as a technical floor only after
  testing the actual signed build on minimum and representative current devices.
- Tauri desktop builds exist, but this plan does not certify any desktop OS or
  minimum hardware. Publish requirements only after testing packaged builds on
  named OS versions and machines.
- Browser measurements are not Android benchmarks. The prior headless desktop
  profile missed its p95 frame-time target; no physical Android or representative
  emulator profile was used.

### Data practices observed in source

Settings use browser local storage; campaigns use local IndexedDB. Import/export
uses JSON; Android writes exports to app cache and opens the system share sheet.
Saves are not encrypted. There is no account or cloud sync. Source inspection
found no analytics, ad, crash-reporting, or app-level network service integration.
The Android manifest declares `INTERNET`; inspect the merged manifest,
transitive SDKs, and final build before making declarations.

**Draft disclosure, pending SDK and legal review:** “Campaign saves and settings
are stored locally on your device. The game does not provide an account or cloud
save service. You can export a save file and share it using your device’s share
tools. Exported saves may contain campaign state and are not encrypted by the
game.”

Google Play currently requires published apps, including apps collecting no
user data, to complete Data safety and provide a privacy policy link in the
listing and app. Account for all included SDKs; the declaration must match the
shipped build. Host and add a reviewed privacy policy before published testing
or production. See [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) and [Play user data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).

## Save compatibility policy

- Preserve versioned saves and migrations across normal updates. Never silently
  reset an unknown or invalid campaign.
- Keep backup recovery and explicit export/import. Explain saves are local,
  device-bound by default, and not cloud-synced; JSON export is manual transfer.
- Test a previous-version save, multi-generation campaign, backup recovery, and
  interrupted write before each release.
- If a breaking change is unavoidable, announce it before update and retain
  export compatibility or provide recovery where technically possible.

## Known limitations and publication blockers

- Product is still documented as a vertical slice. Finish a campaign and verify
  marketed loops end to end.
- No physical Android or representative emulator performance profile exists.
  Test frame time, memory, save/load, background/resume, and long sessions.
- The recorded headless Chrome profile missed the desktop 16.7 ms p95 target;
  Android performance is unknown.
- `npm run build` emits a roughly 1.86 MB minified main JavaScript chunk and a
  warning for chunks over 500 kB. Assess WebView startup and low-memory behavior.
- Android Gradle build is unvalidated here: wrapper needs Gradle 8.14.3 and
  network access to `services.gradle.org` was unavailable. No signed APK/AAB
  was produced.
- Android has `versionCode 1` and `versionName "1.0"`, while `package.json` is
  `0.1.0`. Align release metadata and adopt a monotonically increasing code.
- No in-game privacy-policy surface or hosted policy is confirmed. No crash
  reporting integration is present.
- Confirm title availability, developer identity and package registration,
  target audience, content rating, privacy/Data safety, regional availability,
  and all current Play Console prompts. No historical certification exists.

## Android build, signing and version workflow

The existing [platform build guide](PLATFORM_BUILDS.md) documents Capacitor
commands. Validate on a machine with the Android SDK and Gradle distribution:

1. From a reviewed commit, run `npm ci`, `npm test`, `npm run build`, and
   `npm run test:smoke` in the supported Chrome environment.
2. Install the Android SDK/Studio versions required by the current project and
   Play rules. Run `npm run android:sync`; build/install a debug package on the
   minimum API emulator and representative physical devices. Check save,
   export/import, and long sessions.
3. Before each release, increment Android `versionCode` (integer, always
   increasing) and update human-readable `versionName` (for example `1.0.0`).
   Keep app identity `com.ottomanlegacy.game` fixed after Play setup.
4. Produce a signed release Android App Bundle (AAB). Create a private upload
   key, store it outside source control (prefer CI secrets), enable Play App
   Signing, and back up key/recovery material securely. Never commit keys or
   passwords. Verify artifact and signature.
5. Upload to Internal testing first, then Closed testing with feedback and
   release-candidate notes. For personal accounts created after 13 November
   2023, current policy requires 12 testers continuously opted in for 14 days
   before requesting production access; confirm the account-specific Console
   requirement.
6. Resolve Console errors and declarations. Submit for production access if
   required. Have support and monitoring ready. Watch Android Vitals, reviews,
   reports, launch failures and save recovery. Staged rollout can limit updates,
   not the first production release; expand an update gradually and halt if
   evidence shows a regression.

Validation performed for this plan: prior `npm test`, `npm run build`, and
Chrome smoke run (70 passed, 0 failed) passed before this documentation-only
change. The Play signing/AAB workflow remains untested because Gradle could not
be downloaded. Do not call native release tested until a real AAB is built,
signed, installed, and checked.

As checked 29 October 2026, new apps and updates must target API 36 or higher
starting 31 August 2026; this project is configured for 36. Verify again at
submission. Android 15+ apps targeting API 35+ must support 16 KB memory pages;
Play says unsupported updates will be blocked starting 1 February 2027. Check
the final package and native/transitive libraries. See [target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) and [16 KB page-size guidance](https://developer.android.com/guide/practices/page-sizes).

Recheck [personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [listing field limits](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en), [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), and [staged rollouts](https://support.google.com/googleplay/android-developer/answer/6346149?hl=en) at submission. Play rules change.

## Crash reporting

There is no crash reporting integration. During closed testing, begin with
Android Vitals, Play Console crash/ANR reporting, and a clear feedback route.
Before adding a third-party crash SDK, review collection, consent, retention,
residency, and Data safety impact; document the change. Play reporting is not
cloud save.

## Release notes draft — 1.0.0 (not a completed release claim)

- Begin a single-player life in an early Ottoman frontier settlement.
- Plant and harvest seasonal crops, trade in the village market, and meet
  residents through local events.
- Keep progress in local saves, with JSON export and import.

Replace this draft with the exact changes and resolved issues in the signed
release candidate. Do not publish until the promised campaign is complete and
verified.

## Monetization decision checklist

Before setting a price or enabling paid distribution, confirm campaign length
and content volume, market/regional tax and refund implications, accessibility
and device compatibility, support ownership, store pricing presentation, and a
sustainable update budget. If paid content later makes sense, sell named,
self-contained expansions transparently and preserve the complete base game.
