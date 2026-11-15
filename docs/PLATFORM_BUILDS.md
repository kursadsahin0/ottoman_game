# Platform builds

The Phaser/TypeScript game remains one Vite application. Capacitor and Tauri package the same `dist/` output; platform-specific behavior lives in `src/platform/PlatformAdapter.ts`. Browser development remains `npm run dev`.

## Android (Capacitor 8)

Requirements: Node.js 22+, Android Studio 2025.2.1 or newer with Android SDK/platform tools, and an API 24+ emulator image or device. Android Studio supplies the JDK; install the SDK platform needed by the generated project (currently compile/target API 36). Capacitor's runtime minimum is Android API 24. See [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) and [Android workflow](https://capacitorjs.com/docs/android).

```sh
npm ci
npm run android:sync
npm run android:open
# or: npm run android:run
# release artifacts: npm run android:build
```

`android:add` is only needed once if regenerating the native project. Build signing keys and passwords belong in local Gradle properties or CI secrets; do not commit them.

## Desktop (Tauri 2)

Install Node.js 22+ and Rust stable via rustup. Also install the operating-system toolchain: Xcode Command Line Tools on macOS, Microsoft C++ Build Tools and WebView2 on Windows, and WebKitGTK 4.1 plus the build dependencies listed by the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) on Linux.

```sh
npm ci
npm run tauri:dev
npm run tauri:build
```

Tauri embeds the Vite `dist/` output. Build artifacts are under `src-tauri/target/release/bundle/`. Sign/notarize each operating system's release with its platform credentials before publishing.

## Saves and transfer

Each packaged app has its own WebView origin and therefore its own IndexedDB save database. Browser, Android, and each desktop installation do not share slots automatically. The in-game Save screen exports a slot as JSON (Android writes it into app cache and opens the native share sheet) and imports a JSON save into an empty slot. Export/import is the supported cross-platform transfer path. Save data is not encrypted; do not treat it as secret storage. Android may reclaim WebView storage when device space is low, so export important campaigns regularly.

## Controls and performance

Desktop movement uses WASD or arrow keys; movement keys can be rebound from the in-game Settings panel. Mouse clicks work for menus and world interaction. The game has no active gamepad adapter, so controller support is not advertised. Phones use the virtual joystick and contextual action button; the current world has no live enemy encounter actor to bind an attack button to.

Graphics quality can be cycled in Settings. The renderer caps device pixel ratio at 1.5. Low hides the full-screen atmosphere layers and pauses ambient house-smoke tweens; Balanced shows the vignette, while High also shows the sunbeam. The simulation pauses while the page is hidden. On mobile devices reporting 4 GB or less of memory, Low quality is selected by default.

## Build validation

`npm run build` verifies TypeScript and creates the common web bundle. `npm run test` runs simulation and save-schema tests. `npm run test:smoke` drives Chrome through desktop/mobile viewport, touch, IndexedDB, asset-path, and reload-continuation checks. Native packaging commands require the relevant SDK/toolchain and signing setup; browser tests are not physical-device certification.
