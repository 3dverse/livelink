# Replace Variant Launch with a self-owned iOS App Clip for `livelink.webxr`

> **Status** — Phase 4 (web-side launcher) is **done and merged into the working tree**; the sample
> still runs on Variant Launch until `VITE_WEBXR_APP_CLIP_DOMAIN` is set, so nothing has regressed.
> The fork exists at [`3dverse/ios-webxr`](https://github.com/3dverse/ios-webxr), but **which branch
> to base on is undecided** pending the spike in Phase 1b — see the `feature/iwer-2` finding below.
> Phases 0–3 are external setup (Apple enrollment, Codemagic, DNS) and are the critical path;
> Phase 5 device validation is blocked behind them.

## Context

`livelink.samples/src/samples/advanced/x-web-xr-ios` currently reaches WebXR on iPhone through
[launch.variant3d.com](https://launch.variant3d.com/): the sample loads Variant's SDK, and when
`XRLivelink.isSessionSupported("immersive-ar")` comes back false it redirects to
`VLaunch.getLaunchUrl(location.href)`, which bounces the user into Variant's App Clip — a WKWebView
with an ARKit-backed WebXR polyfill injected.

That path is a single point of failure owned by a third party. The goal is to own the clip:
fork [wem-technology/ios-webxr](https://github.com/wem-technology/ios-webxr) (Apache-2.0), rebrand
it as a 3dverse App Clip, host the launch domain ourselves, and swap the sample's VLaunch call for
our own launcher — while keeping Variant Launch selectable as a fallback until ours is approved.

---

## Review of the stated assumptions

| Assumption                                               | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variant Launch is unmaintained                           | **Partly.** The site is live and still selling ($99/$199 per month). But the public SDK repo `Variant3d/v-launch-sdk` has exactly two commits, the newest (2025-07-19) titled _"move repo archive from bitbucket to github"_. No changelog, no dated status. Unmaintained is a fair read; "dead" is not proven.                                                                                                               |
| It might break on an iOS update                          | True, but that is not the sharpest risk. The real one: the clip is **Variant's own App Store listing**. If they stop renewing, get pulled, or change pricing, every downstream experience dies at once and there is no recourse. That is the actual argument for owning the clip.                                                                                                                                             |
| wem's repo is fully open source _including_ the app clip | **Confirmed.** `project.yml` declares a real `WebXRClip` target of type `application.on-demand-install-capable`, with `com.apple.developer.on-demand-install-capable`, `associated-domains: ["appclips:${DOMAIN_URL}"]` and `parent-application-identifiers`. Apache-2.0. **But see the finding below — `main` has been dormant since 2026-02-02 and the maintainer's real work continued on the unmerged `feature/iwer-2`.** |
| It needs rebranding                                      | **Confirmed, and it is already built for it.** `generate_xcode_project.sh` is a white-label script driving XcodeGen from `APP_NAME` / `BUNDLE_ID` / `VERSION` / `DOMAIN_URL` / `START_URL` / `DEVELOPMENT_TEAM` / `ICON_SOURCE`, with `Scripts/generate_icons.sh` as a preGen step. Rebranding is ~6 variables plus a 1024×1024 `icon.png`.                                                                                   |
| I need to add "launch the app clip from the browser"     | **Already implemented — do not build it.** `Sources/WebXRApp/App.swift` handles `onContinueUserActivity(NSUserActivityTypeBrowsingWeb)`, parses the `to` query item off the invocation URL, and loads it. `https://<our-domain>/?to=<encoded url>` is the exact equivalent of `VLaunch.getLaunchUrl()`. The missing pieces are **hosting the domain** and **configuring the App Clip experience**, not Swift code.            |
| Nice if it also launches from Chrome                     | **Not possible.** App Clip Smart App Banners / App Clip cards render only in Safari and `SFSafariViewController`. Chrome for iOS will not show them, and there is no programmatic invocation. Variant Launch has the same limit ("the user must be in a Safari browser session"). Best available: detect a non-Safari iOS browser and tell the user to open in Safari.                                                        |
| I'm not on macOS so I need a macOS workstation           | **Half true.** Compiling needs macOS, but not one you own — `codemagic.yaml` already in the repo runs the whole thing on a cloud `mac_mini_m2` (xcodegen → fetch signing for both bundle IDs → build-ipa → TestFlight). You never open Xcode. What _does_ want a Mac is Safari Web Inspector against a physical device, which is why a rented Mac is worth having for debugging only.                                         |

One more fact that shapes everything below: **the Safari banner only appears once the parent app is
publicly released on the App Store.** An App Clip cannot be published independently of its full app.
Until then, TestFlight App Clip Invocations (max 3 URLs, launched from the TestFlight app) are the
only test path — which is why this plan is phased.

Also still true in 2026: iPhone Safari exposes no `navigator.xr` and no `immersive-ar`. There is no
"just wait for Apple" option.

---

## Late finding — upstream `main` is the wrong base; `feature/iwer-2` is where the work is

The fork at [`3dverse/ios-webxr`](https://github.com/3dverse/ios-webxr) was created 2026-09-03. Its
branches are **upstream's**, copied by the fork — every commit is authored by Liam McFadden (wem's
maintainer), not by anyone at 3dverse.

`feature/iwer-2` is **21 commits ahead of `main`, 1 behind, and has no pull request** — it was never
proposed for merge. Upstream `main` has been dormant since 2026-02-02; this branch ran to 2026-06-13.
So the "actively maintained" row in the table above is misleading in an important way: `main` is
stale, and development continued on an unmerged branch. Every other branch (`feature/app-clip`,
`feature/camera-access-performance`, `feature/url-scanner`, …) is from January 2026 and already
contained in `main`.

**What the branch changes.** It replaces the WebXR implementation wholesale:

|                        | `main`                                                                                      | `feature/iwer-2`                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Polyfill               | Mozilla `webxr-ios-js` (2019) + Google `webxr-polyfill` (2017), **MPL-2.0**, both abandoned | **IWER** — Meta's Immersive Web Emulation Runtime, **MIT**, last push 2026-07-27 |
| Size                   | 231 KB                                                                                      | 348 KB                                                                           |
| Hit-test               | ✗ no `XRHitTestSource`                                                                      | ✓ `XRHitTestSource` / `requestHitTestSource`                                     |
| `camera-access` gating | ✗ base64 JPEG pushed every frame                                                            | ✓ gated on `allFeatures.contains("camera-access")`                               |
| Floor alignment        | ✗                                                                                           | ✓ `setWorldOrigin` with `columns.3.y = -1.6`                                     |
| `isInspectable`        | ✗                                                                                           | ✓ already set for iOS 16.4+                                                      |
| Geolocation            | ✗                                                                                           | ✓ new `GeolocationHandler.swift` + `geolocation-shim.js`                         |

Changed files: `webxr-polyfill.js` (rewritten), `ARWebCoordinator.swift` (+96/−57),
`ARWebView.swift`, `ContentView.swift` (+39/−49), `WebXRKit/Package.swift`, plus the two new
geolocation files.

> **Do not trust GitHub's compare API here.** `compare/main...feature/iwer-2` reports only 4 changed
> files — the 348 KB polyfill patch truncates the response before the rest is listed. Blob SHAs
> confirm `webxr-polyfill.js` (`d3b58e9` → `63b13e9`) and `ARWebView.swift` (`3b32abb` → `2fc9574`)
> both changed. Diff a local clone, not the web UI.

**This retires four of the seven Phase 5 risks before we start**: hit-test, the per-frame base64
camera cost, floor height, and the `isInspectable` patch Phase 1 planned to add. Two remain
unchanged — the WebXR `dom-overlay` feature is still unimplemented on both branches (neither IWER nor
the Swift side sets `domOverlayState`, so `has_dom_overlay` stays false and `#reportDomOverlayState`
still warns; the DOM is visible regardless, because the page composites over the camera), and the
fake-alpha / transparent-background check is still ours to run.

**The cost.** Basing on it means tracking an unmerged, unreviewed, single-author WIP branch idle for
three months — in tension with the "thin fork, track upstream `main`" decision. The polyfill license
improves (MPL-2.0 → MIT), but the diligence is ours either way.

**Unverified.** The custom native-bridge glue appended after the IWER bundle could not be read
remotely — WebFetch truncates well before the end of a 348 KB file. The "Fix DOM overlay" and
"Don't pass DOM overlay touches through to canvas" commits most likely live there, and they bear
directly on whether the sample's DOM UI is **clickable** in AR. Reading it needs a local clone; that
is Phase 1b.

---

## How it will work

```
Safari on iPhone                                   iOS
─────────────────                                  ───
sample page (no navigator.xr)
  │  isSessionSupported("immersive-ar") === false
  │  launcher builds:
  ▼
https://xr.3dverse.com/?to=<encodeURIComponent(sample url)>
  │  AASA at /.well-known/apple-app-site-association → "appclips": { "apps": ["TEAM.com.3dverse.xr.Clip"] }
  │  page meta: <meta name="apple-itunes-app" content="app-id=…, app-clip-bundle-id=…, app-clip-display=card">
  ▼
App Clip card ── user taps ──▶ 3dverse XR Clip
                                 │ App.swift: onContinueUserActivity → reads ?to=
                                 │ ARWebView: ARSCNView (back) + transparent WKWebView (front)
                                 │ WebXRKit injects webxr-polyfill.js → navigator.xr
                                 ▼
                               sample page reloads, immersive-ar now supported,
                               livelink.webxr composites its stream over the camera via fake alpha
```

The critical architectural detail (from `WebXRKit/Sources/WebXRKit/ARWebView.swift`): the camera is an
`ARSCNView` placed **behind** a `WKWebView` that is set `isOpaque = false` / `backgroundColor = .clear`
when AR is active. The whole page — DOM _and_ WebGL canvas — is composited over the camera by UIKit.
That is why DOM UI will be visible even though the polyfill implements no `dom-overlay`, and why
`LXRSurface`'s fake-alpha path (`enable_fake_alpha = is_ar`, luminance→alpha in `LXRContext.ts`) is
exactly the right compositing model here.

---

## Phase 0 — Accounts and prerequisites (no Mac, all web)

1. **Apple Developer Program** enrollment for 3dverse as an organization ($99/yr, needs a D-U-N-S
   number — allow days, not hours). Note the **Team ID**.
2. In the Developer portal, register two App IDs — Codemagic's `fetch-signing-files --create`
   creates _profiles_, not App IDs. Registering an identifier starts by choosing a **type**, and
   that choice does most of the work:

   **a. Parent app** — new identifier, type **App**, bundle ID `com.3dverse.xr`. Enable
   **Associated Domains**. Do _not_ tick _On Demand Install Capable for App Clip Extensions_ here;
   the entitlement belongs on the clip bundle only.

   **b. Clip** — new identifier, type **App Clip**. It then asks for a **Parent App ID**
   (`com.3dverse.xr`) and a product name; entering `Clip` generates the bundle ID
   `com.3dverse.xr.Clip` for you. On the capabilities screen that follows, **On Demand Install
   Capable is already enabled and cannot be turned off** — there is nothing to tick for that one.

   > ⚠️ **Associated Domains is _not_ auto-enabled here — tick it manually.** Only On Demand Install
   > Capable comes for free with the App Clip type. Miss it and the build gets all the way to
   > _Build IPA_ before dying with
   > `Provisioning profile "… Clip …" doesn't include the Associated Domains capability` — because
   > `project.yml` gives `WebXRClip` the `com.apple.developer.associated-domains` entitlement that
   > the profile does not grant. This is the single most likely first-build failure.

   So the App Clip identifier type settles two things by itself: the bundle-ID prefix (derived from
   the parent, so it cannot be got wrong) and
   `com.apple.developer.parent-application-identifiers` (from the Parent App ID field). Neither is a
   checkbox. Regenerate provisioning profiles after creating both.

3. **App Store Connect** → Apps → New App for `com.3dverse.xr` (name e.g. "3dverse XR"). For the
   **SKU**, use the bundle ID verbatim: `com.3dverse.xr`. It is internal only — never shown to
   users, it just labels the app in sales and finance reports — but it **cannot be edited after
   creation** and cannot be reused for another app, so matching the bundle ID leaves no scheme to
   misremember. (Format, if you want your own: letters, numbers, hyphens, periods, underscores; must
   not _start_ with a hyphen, period or underscore; case-sensitive, max 150 chars.) Nothing
   downstream reads it — do not spend time on it.
4. Create an **App Store Connect API key** — App Store Connect → **Users and Access** →
   **Integrations** → _App Store Connect API_ (older docs call this tab "Keys"). Give it **App
   Manager** access. Three values come out of it:

   | Value                 | What it is                                                        | Where                                                               |
   | --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
   | **Issuer ID**         | UUID identifying the account; one per account, shared by all keys | Above the keys table                                                |
   | **Key ID**            | ~10-char id of this specific key                                  | Column in the keys table                                            |
   | **`.p8` private key** | The key file itself                                               | Downloaded on creation — **once only**, Apple never offers it again |

   If `fetch-signing-files --create` later fails on permissions while creating the distribution
   certificate, Admin is the fallback role.

5. **Codemagic** personal account (500 free macOS-M2 minutes/month; builds here run ~5–10 min).
   Connect the fork, then add the API key. **On a personal account the path is
   Teams → _your Personal Account_ → Integrations → Developer Portal → Connect**, then
   **Manage keys** to upload the `.p8` and enter the Key ID and Issuer ID. Give the key a name —
   that name is what the yaml references.

   Codemagic files the personal account _inside_ the "Teams" section, which is the unintuitive part.
   The other documented path — Team settings → Team integrations → Developer Portal — applies only
   to real shared teams and needs team-admin rights, so it simply does not appear on a personal
   account. (And free minutes are not available on a Team, which is why this plan uses a personal
   account.)

   **Use the integration, not the three env vars.** Upstream's `codemagic.yaml` is a half-and-half
   of Codemagic's two supported routes: it declares `integrations: app_store_connect: Codemagic`
   (_wem's_ key name — must be replaced) _and_ separately passes
   `api_key: $APP_STORE_CONNECT_PRIVATE_KEY` / `key_id: $APP_STORE_CONNECT_KEY_IDENTIFIER` /
   `issuer_id: $APP_STORE_CONNECT_ISSUER_ID` to `publishing`, which then have to exist in the `Wem`
   variable group. Collapse it to the integration route:

   ```yaml
   # workflow level — keep `integrations:` exactly where upstream has it,
   # as a sibling of `environment:`. Only the value changes.
   integrations:
     app_store_connect: 3dverse # the name given to the key in Codemagic

   publishing:
     app_store_connect:
       auth: integration
       submit_to_testflight: true
   ```

   Codemagic's own docs are inconsistent about whether `integrations:` nests under `environment:` or
   sits beside it — their workflow skeleton omits the key entirely, while the publishing page shows
   it as a sibling. Upstream's file uses the sibling form and builds, so **do not move it**.

   One credential stored once, read by both the signing steps and publishing, with no `.p8` pasted
   into a variable group. `groups: - Wem` can go too, unless other variables are kept there.
   Should the env-var route ever be needed instead, `APP_STORE_CONNECT_PRIVATE_KEY` is the **whole
   PEM contents** of the `.p8` — not a path, not base64 — including the `BEGIN`/`END` lines, and
   marked **Secure**.

6. **Generate a certificate private key and add it as `CERTIFICATE_PRIVATE_KEY`.** Not optional,
   and not mentioned anywhere in upstream's `codemagic.yaml`: without it the build dies at _Fetch
   Signing Files_ with `Cannot save Signing Certificates without certificate private key`.
   `fetch-signing-files --create` asks Apple for a certificate, but a certificate is only half a
   signing identity — it has to bind to a private key we supply.

   ```bash
   # -m PEM is essential; without it ssh-keygen emits OPENSSH format, which will not work
   ssh-keygen -t rsa -b 2048 -m PEM -f ios_distribution_private_key -q -N ""
   ```

   Paste the **entire** private key — `-----BEGIN RSA PRIVATE KEY-----` and `END` lines included —
   into Codemagic → the app → **Environment variables** as `CERTIFICATE_PRIVATE_KEY`, marked
   **Secure**, inside a group (e.g. `appstore`). Then import that group in the workflow:

   ```yaml
   environment:
     groups:
       - appstore # secrets must live in a group for the workflow to import them
   ```

   `fetch-signing-files` reads the variable from the environment automatically; passing
   `--certificate-key @env:CERTIFICATE_PRIVATE_KEY` is equivalent and more explicit.

   **Store this key in 3dverse's password manager.** It is the private half of the Apple
   Distribution certificate the first build creates. Lose it and the certificate must be revoked and
   reissued — and Apple caps the account at 2 Apple Distribution certificates, so they cannot be
   churned casually.

7. **Provision the launch domain.** `xr.3dverse.com` is a placeholder used throughout — any host
   3dverse controls works, the name just has to match `DOMAIN_URL` everywhere. It exists to serve
   two static files:
   - `/.well-known/apple-app-site-association` — how iOS learns this domain may launch the clip.
   - a landing page at `/` — carries the Smart App Banner meta tag, plus the "open in Safari"
     message for other browsers.

   No backend: `?to=` is parsed natively by the clip in `App.swift`, not by the server.

   Requirements, each of which fails **silently** if wrong:
   - Public DNS and valid TLS. Not behind auth, VPN or an IP allowlist — Apple's CDN must fetch it.
   - **No redirects** on the AASA path. A host that 301s apex→www breaks it.
   - AASA served with **no file extension** and `Content-Type: application/json`.
   - Host matches `appclips:${DOMAIN_URL}` exactly — `xr.3dverse.com` vs `www.xr.3dverse.com` fails.
   - Apple's CDN caches it 24–48h, so pick once and do not churn.

   **Host choice matters more than it looks.** `livelink.samples` already deploys to GitLab Pages
   (the `pages:` job in `.gitlab-ci.yml`), so that is the obvious place to reach for — but GitLab
   Pages cannot set `Content-Type` on an extensionless file and supports no custom-header config,
   making it a poor fit for the AASA specifically. Prefer Cloudflare Pages or Netlify (both honour a
   `_headers` file), S3 + CloudFront (per-object metadata), or a route on an existing 3dverse
   service.

   Not to be confused with the **samples** host, which is the `?to=` target: that one needs nothing
   at all — no AASA, no meta tag. Only the launch domain carries Apple configuration.

8. A physical iPhone (A9+, iOS 16+) and the TestFlight app.

9. **Know which `codemagic.yaml` variables actually change.** Two traps here, both easy to miss:
   `DEVELOPMENT_TEAM` is _not in the file at all_ — upstream supplies it through the `Wem` variable
   group — so dropping that group without adding it breaks signing. And `XCODE_SCHEME` is **not**
   branding and must stay `WebXRApp`.

   | Variable           | In upstream `vars:`?                | Change it?                   | Notes                                                                                      |
   | ------------------ | ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
   | `APP_NAME`         | ✓ `"HelloXR"`                       | ✓ → `"3dverseXR"`            | Also names the generated project — `build-ipa --project "$APP_NAME.xcodeproj"`             |
   | `BUNDLE_ID`        | ✓                                   | ✓ → `com.3dverse.xr`         | The clip's is derived as `${BUNDLE_ID}.Clip`                                               |
   | `DOMAIN_URL`       | ✓                                   | ✓ → `xr.3dverse.com`         | Bare host, no scheme or path                                                               |
   | `START_URL`        | ✓                                   | ✓ → `https://xr.3dverse.com` | With scheme                                                                                |
   | `VERSION`          | ✓ `"1.3.0"`                         | ✓ → reset to `"1.0.0"`       | Upstream's version, not ours                                                               |
   | `XCODE_SCHEME`     | ✓ `"WebXRApp"`                      | ✗ **keep as-is**             | See below                                                                                  |
   | `DEVELOPMENT_TEAM` | ✗ **absent** (from the `Wem` group) | ✓ **must add**               | The Team ID from step 1                                                                    |
   | `BUILD_NUMBER`     | ✗ absent                            | ✗ do not add                 | Codemagic injects it — hence upstream's "Remove manual BUILD_NUMBER from Codemagic" commit |

   **Why `XCODE_SCHEME` stays `WebXRApp`.** In `project.yml` the target is literally named
   `WebXRApp`; only its `productName` is `${APP_NAME}`. XcodeGen names schemes after targets, so the
   scheme is `WebXRApp` no matter what the app is called. The _project file_, meanwhile, comes from
   `name: ${APP_NAME}` and becomes `3dverseXR.xcodeproj`. That is why the build step legitimately
   passes two different values: `--project "3dverseXR.xcodeproj" --scheme "WebXRApp"`.

   (If basing on `feature/iwer-2`, note its "Switch back XCode scheme" commit — confirm the scheme
   name there before assuming it is still `WebXRApp`.)

---

## Phase 1 — Rebrand, on a base chosen by a two-branch spike

The fork already exists at `3dverse/ios-webxr`. What is **not** settled is which base to rebrand, so
this phase opens with a spike rather than a decision — see the finding above.

### 1a. Ask upstream (non-blocking, do it first)

Open an issue on `wem-technology/ios-webxr` asking whether `feature/iwer-2` is intended to land. It
costs nothing, and the answer decides whether we are tracking a branch or adopting an orphan.

> ⚠️ **Outward-facing**, posted publicly under a 3dverse identity. Review the wording before it goes
> out — in particular the closing offer, which commits us to work if taken up.

Draft:

> **Is `feature/iwer-2` intended for `main`?**
>
> We're evaluating this project as the basis for a white-labelled WebXR App Clip. `feature/iwer-2`
> looks like a substantial step forward over `main` — IWER in place of the Mozilla/Google polyfill,
> working hit-test, `camera-access` gating, and the `-1.6m` world-origin alignment — but it has no
> PR and `main` hasn't moved since February.
>
> Is it headed for `main`, or is it an experiment we should treat as a fork point? Anything known to
> be unfinished or unstable on it? Happy to help get it over the line if that's useful.

### 1b. Spike both branches

Clone locally and, for each of `main` and `feature/iwer-2`:

- Read the **untruncated** custom glue appended after the IWER bundle in `webxr-polyfill.js` — the
  one thing that could not be read remotely.
  `git diff main..feature/iwer-2 -- '*.js'` is the fastest read of what actually changed.
- Answer the two questions that decide the base: **does the sample's DOM UI receive touches while an
  AR session is live**, and **is `session.domOverlayState` set**? (Expected: no — `has_dom_overlay`
  stays false either way, and that is fine. Touch handling is the one that matters.)
- Build both through Codemagic (Phase 2) and compare on device against the Phase 5 checklist.

Rebase `feature/iwer-2` onto `main` first — the one commit it is behind is a `FUNDING.yml` change, so
the rebase is trivial.

Decide the base on that evidence, then apply the rebrand below to whichever wins.

### 1c. The rebrand itself

Keep `WebXRKit/` otherwise untouched so upstream rebases stay cheap. The whole intended diff:

| File                                        | Change                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate_xcode_project.sh`                 | `APP_NAME="3dverseXR"`, `BUNDLE_ID="com.3dverse.xr"`, `DOMAIN_URL="xr.3dverse.com"` (bare domain — no scheme, no path; it lands in `appclips:${DOMAIN_URL}` on the clip and `applinks:${DOMAIN_URL}` on the parent, once the fix below is applied), `START_URL="https://xr.3dverse.com"`, `DEVELOPMENT_TEAM="<TEAM_ID>"`, `VERSION`/`BUILD_NUMBER` |
| `icon.png`                                  | 3dverse 1024×1024 PNG (consumed by `Scripts/generate_icons.sh` as an XcodeGen preGenCommand)                                                                                                                                                                                                                                                       |
| `codemagic.yaml`                            | Same vars in `environment.vars`; replace `groups: - Wem` with our group; replace `integrations.app_store_connect: Codemagic` with ours                                                                                                                                                                                                             |
| `Sources/WebXRApp/ContentView.swift`        | _(optional, recommended)_ Gate the URL bar + Google-search fallback out of the **Clip** target. It is an App Review risk under guideline 4.2 (generic browser wrapper) and pointless UX in a clip that always arrives with a `?to=`                                                                                                                |
| `WebXRKit/Sources/WebXRKit/ARWebView.swift` | _(only if basing on `main`)_ `#if DEBUG webView.isInspectable = true #endif` — required on iOS 16.4+ for any remote inspection of the clip's WKWebView. **Already present on `feature/iwer-2`**, though unconditional there; consider `#if DEBUG`-gating it before shipping                                                                        |
| `NOTICE` / `README.md`                      | Attribution + what we changed (Apache-2.0 requires the NOTICE be carried). The polyfill license differs by base: **MPL-2.0** (Mozilla `webxr-ios-js`) on `main`, **MIT** (IWER) on `feature/iwer-2` — the NOTICE must reflect whichever ships                                                                                                      |

**`project.yml` needs one real fix.** Upstream declares
`com.apple.developer.associated-domains: ["appclips:${DOMAIN_URL}"]` on **both** targets. `appclips:`
is correct for `WebXRClip`, but the parent app should use **`applinks:`** — `appclips:` on a full app
does nothing. The consequence is narrow but real: once a user installs the full app, tapping
`https://xr.3dverse.com/?to=…` will not route to it, so the `onContinueUserActivity` handler in
`App.swift` (shared by both targets) never fires there. Change the `WebXRApp` target to
`["applinks:${DOMAIN_URL}"]`, and upstream this as a fix.

Everything else in `project.yml` is already an env placeholder and needs no edits. Consider bumping
`options.xcodeVersion` (currently `"15.0"`) if Codemagic's `xcode: latest` complains.

Send anything of general value (the `isInspectable` flag, any polyfill fixes from Phase 5) upstream
as PRs rather than accumulating fork debt.

---

## Phase 2 — First cloud build to TestFlight

### Order of operations (do not click "Start your first build" before this)

The repo's `codemagic.yaml` is still wem's — it references a variable group `Wem` and an integration
named `Codemagic` that do not exist in our account, and a `BUNDLE_ID` we do not own. Building it
unchanged fails immediately. The domain (Phase 0 step 6) is **not** a blocker here; it only matters
at runtime, so provision it in parallel.

1. **Codemagic → Teams → _your Personal Account_ → Integrations → Developer Portal → Manage keys**:
   add the `.p8` + Key ID + Issuer ID. Whatever _name_ is given to the key is what goes in the yaml
   below. (Personal accounts are filed under "Teams"; the Team settings path is for real shared
   teams only.) Also add `CERTIFICATE_PRIVATE_KEY` as a secure variable in a group — see Phase 0
   step 6.
2. **In the fork, on a branch**, apply the Phase 1c rebrand to `generate_xcode_project.sh` and
   `codemagic.yaml`. For the yaml that means dropping `groups: - Wem`, pointing
   `integrations.app_store_connect` at the key name from step 1, and setting `APP_NAME`,
   `BUNDLE_ID`, `DOMAIN_URL`, `START_URL` and `DEVELOPMENT_TEAM` in `environment.vars`.
3. **Comment out the `publishing:` block for the first run.** The goal is to prove compile plus
   signing; keeping the TestFlight upload in play means debugging two failure modes at once. Restore
   it once the build is green.
4. **Start new build** → pick the branch → workflow **iOS deployment** (`ios-deploy`). Roughly
   5–10 min.

Phase 0 steps 1–3 must already be done: `fetch-signing-files --create` creates _provisioning
profiles_, not identifiers, so both App IDs have to exist first, and the App Store Connect app record
has to exist before publishing can succeed.

### First-run failures and what they actually mean

| Symptom                                                                             | Cause                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Cannot save Signing Certificates without certificate private key`                  | `CERTIFICATE_PRIVATE_KEY` is missing — Phase 0 step 6                                                                                                                                                                                                                                            |
| `Provisioning profile "… Clip …" doesn't include the Associated Domains capability` | Associated Domains not ticked on the **clip's** App ID. Enable it, then **delete the stale profile** in Profiles — `fetch-signing-files` re-downloads an invalidated profile instead of recreating it                                                                                            |
| `fetch-signing-files` permission error                                              | API key role — promote App Manager → Admin                                                                                                                                                                                                                                                       |
| Profile creation fails for `${BUNDLE_ID}.Clip`                                      | App Clip identifier not registered, or its Parent App ID is wrong                                                                                                                                                                                                                                |
| `xcodegen` yields an empty `APP_NAME` / bundle id                                   | A var never reached the environment — check indentation under `vars:`                                                                                                                                                                                                                            |
| Build green, upload fails                                                           | The App Store Connect app record is missing (Phase 0 step 3) — the reason publishing is off for run one                                                                                                                                                                                          |
| `APP_STORE_CONNECT_PRIVATE_KEY` … `is not a valid PEM encoded private key`          | The `publishing:` block is still upstream's env-var form. Replace it with `auth: integration`. Note `CERTIFICATE_PRIVATE_KEY` (RSA, from `ssh-keygen`, for the signing certificate) and `APP_STORE_CONNECT_PRIVATE_KEY` (the `.p8` API key) are unrelated — mixing them gives exactly this error |
| `Complete test information is required … for external testing`                      | `submit_to_testflight: true` submits to Beta App **Review**, needed only for external testers. The upload already succeeded and internal testers can install now — set the flag `false`, or fill in Test Information once                                                                        |

### The workflow itself

Run it unchanged in structure. It already does:

```
brew install xcodegen && xcodegen generate
keychain initialize
app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --create
app-store-connect fetch-signing-files "${BUNDLE_ID}.Clip" --type IOS_APP_STORE --create
keychain add-certificates
xcode-project use-profiles --project "$APP_NAME.xcodeproj"
xcode-project build-ipa --project "$APP_NAME.xcodeproj" --scheme WebXRApp
→ submit_to_testflight: true
```

### Restore publishing once the archive is green

With a green build and an `.ipa` in the artifacts, put the `publishing:` block back:

```yaml
publishing:
  app_store_connect:
    auth: integration
    submit_to_testflight: true
    submit_to_app_store: false
```

**What that actually does.** Codemagic takes `build/ios/ipa/*.ipa` and uploads it to App Store
Connect over the API, against the app record whose bundle ID matches `BUNDLE_ID`. The `.ipa`
contains the app **and the embedded App Clip** — the clip is never uploaded separately. Apple then
_processes_ the build (typically 5–30 min); it does not appear in TestFlight until that finishes.
`submit_to_app_store: false` keeps it out of App Review entirely.

> **`submit_to_testflight: true` means Beta App _Review_, which is an external-testing concept.**
> It is not what puts the build in TestFlight — the upload does that, and the build is installable by
> **internal** testers the moment processing finishes, with no review of any kind. Leaving the flag
> on before the test information is filled in fails the pipeline with
> `Complete test information is required … missing required Beta App Review Information` even though
> the upload itself succeeded. Set it to `false` until external testers are actually needed, or fill
> in _Beta App Information_ (Feedback Email) and _Beta App Review Information_ (name, phone, email)
> once under TestFlight → Test Information.

> **Export compliance blocks TestFlight install, not the upload.** `project.yml` sets no
> `ITSAppUsesNonExemptEncryption`, so App Store Connect flags every build _Missing Compliance_ and
> asks _"What type of encryption algorithms does your app implement?"_ before it can be distributed.
>
> For this app the answer is **"None of the algorithms mentioned above"**. The option above it —
> _standard algorithms instead of, or in addition to, Apple's OS encryption_ — is for apps shipping
> their own crypto; this clip is a `WKWebView` plus ARKit whose HTTPS all runs through WebKit and
> `URLSession`, i.e. the OS. The livelink WebRTC/WebSocket traffic inside the page does not change
> that: WebKit performs the cryptography, the binary implements none.
>
> This is a declaration under US export regulations rather than a technical checkbox, so have
> whoever owns export compliance at 3dverse confirm it — "None" is the standard answer for a WebView
> wrapper, but that is analysis, not sign-off.
>
> Answering in the UI clears only the current build. To pre-answer it permanently add
> `ITSAppUsesNonExemptEncryption: false` to the `info.properties` of **both** targets in
> `project.yml` — `WebXRApp` _and_ `WebXRClip`. Miss the clip and the prompt returns.

### First device test

**The simplest path skips the domain entirely.** Launched without an invocation URL, the clip opens
whatever `START_URL` was baked into its `Info.plist` — so point that at the deployed sample and there
is nothing else to configure:

```yaml
START_URL: "https://samples.livelink.3dverse.com/#/web-xr-ios"
```

Rebuild, upload, install from TestFlight, launch — the sample loads immediately. That exercises the
only thing that matters at this stage: whether livelink renders over ARKit through the polyfill.
`DOMAIN_URL` can stay a placeholder; an associated-domain entitlement pointing at a host that does
not exist blocks neither the build nor the TestFlight install, it only means universal links do not
resolve, which is not in play yet.

Exercise the `?to=` flow below **after** that works, since it is what the product actually uses. The
launch domain still does not need to exist for it: TestFlight starts the clip itself rather than
through a universal link, so no AASA is consulted. What _must_ be reachable is the `?to=` target,
because the clip genuinely loads it.

1. Wait for processing, then **App Store Connect → TestFlight → Internal Testing** → add yourself to
   a group and give it the build. Answer export compliance if prompted.
2. **TestFlight → the build → App Clip Invocations → Add** (up to 3):
   - Title: `3dverse WebXR sample`
   - URL: `https://<launch-domain>/?to=https%3A%2F%2Fsamples.livelink.3dverse.com%2F%23%2Fweb-xr-ios`
   - Keep one spare for a staging sample host.
   - ⚠️ The sample is a **hash route**, so `#` must be percent-encoded as `%23`. Without it the
     fragment binds to the outer URL and `to=` arrives truncated. `LXRAppClipLauncher` encodes
     it correctly; a hand-typed URL here will not.
3. On the iPhone, install **TestFlight**, accept the invite, open the app's page — the invocations
   appear there. Tapping one launches the clip, which reads `?to=` in
   `onContinueUserActivity` and loads the sample.

**If TestFlight invocations misbehave**, the documented fallback needs neither a domain nor a
TestFlight experience: enable Developer Mode (Settings → Privacy & Security → Developer Mode), then
Settings → Developer → **Local Experiences** → Register Local Experience with the URL prefix, the
clip bundle ID and a title. Apple's own help page is silent on whether TestFlight invocation
validates the AASA; the evidence says it does not, but Local Experiences is the guaranteed path.

Then work the Phase 5 checklist — that first launch is the whole point of this phase. Also check the
build report for the **App Clip size budget (15 MB uncompressed on iOS 16+)** while you are here.

**No App Review and no App Store release are needed for any of the above.** This is the loop to
iterate in for Phases 4 and 5.

---

## Phase 3 — Launch domain

On `xr.3dverse.com`, over HTTPS with a valid cert and **no redirects**:

1. `/.well-known/apple-app-site-association`, served as `application/json`, no `.json` extension.
   Two sections, matching the two entitlements — `appclips` for the clip, `applinks` so the full app
   takes over the same URLs once installed:

   ```json
   {
     "appclips": { "apps": ["<TEAM_ID>.com.3dverse.xr.Clip"] },
     "applinks": {
       "details": [{ "appIDs": ["<TEAM_ID>.com.3dverse.xr"], "components": [{ "/": "*" }] }]
     }
   }
   ```

   The `applinks` half is optional for the clip to work at all, but without it a user who installs
   the full app keeps getting the clip experience from Safari instead of their installed app.

2. A landing page at `/`. This is the whole "web app" — one static HTML file, no backend. Its only
   inputs are the `?to=` query parameter and the visitor's browser. The clip parses `?to=` itself
   natively, so the page never has to act on it except to pass it through or redirect to it.

   It must carry the Smart App Banner tag, which is what actually renders the App Clip card:

   ```html
   <meta
     name="apple-itunes-app"
     content="app-id=6808246041, app-clip-bundle-id=com.3dverse.xr.Clip, app-clip-display=card"
   />
   ```

   Beyond that it is a dispatcher. What each visitor should get:

   | Visitor                               | Behaviour                                                                                                                                                                                                               |
   | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | iOS Safari, clip not installed        | The meta tag makes iOS show the App Clip card. Tapping it launches the clip with the full URL, `?to=` included. Page content is only what shows behind the card — a line of explanation.                                |
   | iOS Safari, full app installed        | The `applinks` AASA entry makes this a universal link: the full app opens directly and no card appears. Nothing extra to build.                                                                                         |
   | iOS Chrome / Firefox / in-app browser | No banner will ever appear here. Say so plainly — "open this link in Safari" — and offer the URL to copy. This is the most confusing failure mode for end users.                                                        |
   | Android                               | Android has **native WebXR**. The launch domain is pointless there: redirect straight to the `?to=` target.                                                                                                             |
   | Desktop                               | Same redirect, or better — render a **QR code of the current launch URL**. Scanning it lands the user in iOS Safari on the URL that shows the App Clip card, and QR is itself a first-class App Clip invocation method. |

   > ⚠️ **`?to=` is an open redirect.** A page on a 3dverse domain that forwards to an arbitrary
   > attacker-supplied URL is a phishing primitive, and it will be found. Validate `to` before
   > redirecting to it or rendering it as a link: require `https:` plus an allowlist of hosts
   > (`samples.livelink.3dverse.com` and whichever customer domains are intended), and fall back to
   > the default experience rather than forwarding anything unrecognised. The clip should apply the
   > same check natively before loading.

Apple's CDN caches the AASA for roughly 24–48h, so budget for that after any change. The banner
itself stays invisible until Phase 6 — that is expected, not a misconfiguration.

---

## Phase 4 — Launcher in `livelink.webxr`, VLaunch kept as fallback ✅ DONE

Shipped. Launch logic no longer lives in the sample: it is a strategy interface in the package, with
the two clips as interchangeable implementations. Off iOS every launcher reports `supported` and does
nothing, so consumers wire one in unconditionally rather than branching on the platform.

### Added

| File                                         | What                                                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sources/launch/LXRLauncher.ts`              | `LXRLauncher` interface, the `LXRLaunchState` union (`supported` / `launch-required` / `unsupported`), and iOS + Safari detection (`isIOS`, `isSafariOnIOS`)                                          |
| `sources/launch/LXRAppClipLauncher.ts`       | Self-hosted clip. Builds `https://<domain>/?to=<current url>`. No SDK, no key, no network round trip. `getLaunchUrl(target)` is public so a landing page or QR code can be generated for another page |
| `sources/launch/LXRVariantLaunchLauncher.ts` | Variant Launch, ported from the sample                                                                                                                                                                |
| `sources/launch/index.ts`                    | Barrel                                                                                                                                                                                                |
| `sources/react/WebXRLaunchHooks.ts`          | `useXRLaunch({ mode, launcher, onEnter })` → `{ state, isResolving, canLaunch, willRedirect, message, launch }`                                                                                       |

Exported from `sources/index.ts` and `sources/react/index.ts`. Documented under
**Entering XR on iOS** in the package README.

### Changed

- `livelink.samples/.../x-web-xr-ios/index.tsx` — `XRButton` went from ~140 lines of SDK plumbing to
  ~25 lines around the hook; **net −127 lines** across the file. Launcher chosen at module scope from
  env: `VITE_WEBXR_APP_CLIP_DOMAIN` wins, else `VITE_WEBXR_VARIANT_LAUNCH_SDK_KEY`, else none.
- `livelink.samples/.env` — documented `VITE_WEBXR_APP_CLIP_DOMAIN`, commented out until the clip
  ships. The Variant key stays live, so **behaviour is unchanged today**.
- `x-web-xr-ios/meta.json` — summary no longer names launch.variant3d.com.
- `livelink.webxr/README.md` — new section; the `domOverlayRoot` row no longer says "via Variant
  Launch".

### Two things worth knowing

**A race was fixed, not ported.** The original registered its `vlaunch-initialized` listener _after_
injecting the SDK script, which is why `window.VLaunch` was reliably absent on the first pass — the
`TODO: something is not clear here [...] This works but may be by chance` at the old
`index.tsx:393`. `LXRVariantLaunchLauncher` listens before injecting, so the handshake cannot be
missed. The SDK also loads at most once per instance now, shared across every button on the page.

**Non-Safari iOS browsers are reported, not hidden.** `launch-required` carries `needs_safari`, and
the stock message becomes _"Open in Safari to enter AR"_ rather than a button that navigates
somewhere nothing happens. Detection is a vendor-token list (`CriOS`, `FxiOS`, `GSA/`, `FBAN`, …);
anything unlisted is taken for Safari, which fails harmlessly.

### Still open in this phase

- `#xr-dom-overlay-root-launcher` (renamed from `…-variant-launch`) is **kept** — the body-portal
  workaround is probably unnecessary under our clip, but that is a Phase 5 device check. A `TODO` in
  the sample points here.

### Verified

`tsc --noEmit` clean on both packages · `eslint --max-warnings 0` clean · `prettier --check` clean ·
`livelink.webxr` build green · `livelink.samples` vite build green. Not yet run on a device — that is
Phase 5, and it is blocked on Phases 0–3.

---

## Phase 5 — Device validation, and the gaps to expect

The wem polyfill is **not** a feature-equal replacement for Variant Launch. Check each of these on a
real device against the TestFlight clip.

**Items 3, 4 and 5 are already addressed on `feature/iwer-2`.** They stay on the list because the
spike (Phase 1b) has to confirm the fixes hold against livelink specifically, not merely that commits
claiming them exist. If the spike lands on `main` instead, they are open risks again in full.

1. **`dom-overlay` is not implemented.** `session.domOverlayState` will be undefined, so
   `XRLivelink.has_dom_overlay` is false and `#reportDomOverlayState`
   ([XRLivelink.ts:777](livelink.webxr/sources/XRLivelink.ts:777)) will log its warning. Expected and
   benign here — the transparent-WKWebView architecture means the DOM is visible anyway. Decide
   whether to teach that warning about this case rather than leave a misleading log.
2. **Fake alpha / transparency.** `LXRSurface.initialize` sets `enable_fake_alpha = is_ar` and
   `LXRContext`'s shader premultiplies. For the camera to actually show through, the WebGL context
   must be created with `alpha: true` **and** `html`/`body` must be transparent during the session —
   the sample's Tailwind background will otherwise paint over the camera. Likely a small CSS fix.
3. **Hit-test / placement.** _(Fixed on `feature/iwer-2`: IWER ships `XRHitTestSource` /
   `requestHitTestSource`, and the branch carries a "Get pmndrs hit test working" commit. `main`'s
   Mozilla polyfill has no hit-test at all.)_ Verify `LXRHitTest.ts` / `LXRPlacement.ts` against it
   before promising `LXRPlacement` on iOS. On `main`, either wire the polyfill to the native
   `hitTest` message handler (upstreamable) or document iOS as no-hit-test.
4. **Per-frame base64 camera transfer.** `ARWebCoordinator` pushes JPEG-encoded, base64 frames into
   `window.NativeARData.video_data` via `evaluateJavaScript`. Next to livelink's own video stream that
   is a serious perf risk. _(Fixed on `feature/iwer-2`, which gates it on
   `allFeatures.contains("camera-access")` — livelink never requests that feature, so the cost
   disappears. On `main` it is unconditional: disable it in the fork, livelink does not need
   page-side camera pixels.)_ Confirm with the `PerformancePanel` that the frame rate matches an
   Android session of the same scene.
5. **Reference spaces and floor height.** `LXRSession.initialize` tries `local-floor` then falls back
   to `local` ([LXRSession.ts:143](livelink.webxr/sources/LXRSession.ts:143)). Confirm which is
   actually granted, since it sets the origin height. _(`feature/iwer-2` calls `setWorldOrigin` with
   `columns.3.y = -1.6` to align ARKit's device-height origin with WebXR's floor expectation. Check
   it does not **double-apply** against the sample's `originTransform`, which already offsets by
   `[0, 2, 5]`.)_
6. **App Clip size budget** — 15 MB uncompressed on iOS 16+. Check the build report; ARKit + WKWebView
   should fit comfortably, but confirm rather than assume.
7. **Latency compensation / overscan / resolution scale** — the CHANGELOG records these breaking
   specifically on the Variant Launch clip once before. Re-test all three.

Debugging tools, in order of preference: the rented Mac + Safari Web Inspector (Develop → device →
the clip's WKWebView, needs the `isInspectable` patch); otherwise `ios-webkit-debug-proxy` from
Windows; and as a last resort inject `eruda` into the sample page behind a query flag.

---

## Phase 6 — App Store release (gated on Phase 5 passing)

Only this unlocks the Safari path. Before submitting:

- Host the privacy policy (upstream ships a `privacy_policy.md` to adapt).
- Write the camera usage string as something reviewer-legible — the current
  `NSCameraUsageDescription` is generic.
- Configure the **default App Clip experience** in App Store Connect: URL prefix
  `https://xr.3dverse.com/`, plus card title, subtitle, header image, action verb.
- Remove the local/TestFlight experiences from the test device before testing the real one.
- **Review risk:** guideline 4.2, generic-browser-wrapper. Mitigate by shipping it as the 3dverse XR
  viewer with real default content at `START_URL`, and by hiding the URL bar in the clip (Phase 1).
  Precedent exists — upstream's own HelloXR is on the App Store (ID 6757726359).
- Changes to the default experience require a new App Store submission, so get the card right.

Once released, drop the VLaunch adapter from the sample's default path (keep the class, it costs
nothing) and let the Variant SDK key expire.

---

## Verification

- **Phase 2 gate:** Codemagic build green, `.ipa` in artifacts, build visible in TestFlight, both
  `com.3dverse.xr` and `com.3dverse.xr.Clip` profiles fetched without manual portal work.
- **Phase 3 gate:** `curl -sI https://xr.3dverse.com/.well-known/apple-app-site-association` returns
  200, `content-type: application/json`, and no redirect; body contains the Team-ID-prefixed clip id.
- **Phase 4 gate:** on desktop Chrome the sample behaves exactly as today (button enabled, session
  starts) — the launcher must be inert off-iOS. On iOS Safari, the button's redirect URL is the
  `?to=`-encoded sample URL. Both launchers selectable by env var.
- **Phase 5 gate (the real one):** from the TestFlight app, tap the invocation URL → clip opens →
  sample loads → "Enter AR" enabled → AR session starts → the 3dverse stream renders over the live
  camera with correct transparency → DOM UI (joysticks, scale selector, exit button) is visible and
  responds → `PerformancePanel` shows an acceptable frame rate → "Exit AR" returns cleanly.
- **Phase 6 gate:** on a clean device, opening `https://xr.3dverse.com/?to=…` in Safari shows the App
  Clip card without TestFlight installed.
- Run `npm run build` / the repo's lint+typecheck over `livelink.webxr` and `livelink.samples` for the
  Phase 4 changes; new launcher code follows the braces-on-every-branch rule.

---

## Risks

- **Apple Developer org enrollment** (D-U-N-S) is the longest-lead, least-controllable item. Start it
  first; everything from Phase 2 on is blocked behind it.
- **App Review rejection under 4.2** is the main Phase 6 risk, and it blocks the Safari path entirely.
  Phases 1–5 are still worth doing if it happens — TestFlight distribution and the sample refactor
  survive a rejection.
- **Base-branch choice is unresolved.** `main` ships an abandoned 2019 polyfill with no hit-test;
  `feature/iwer-2` fixes that and three other Phase 5 risks but is unmerged, unreviewed,
  single-author WIP idle since 2026-06-13. Phase 1b decides it on evidence. If upstream answers 1a
  with "not landing", basing on it means owning a hard fork — which reopens the "thin fork" decision.
- **DOM UI clickability in AR is the open unknown** (Phase 5 items 1–2). `dom-overlay` is
  unimplemented on both branches, so the DOM is composited but may not receive touches; the branch
  has commits circling exactly this, unread until Phase 1b. If it cannot be made to work, the
  sample's joysticks and buttons have to move to `XRLivelink.overlay` — a real chunk of work.
- **Chrome on iOS is out of reach**, permanently, for both this and Variant Launch. Plan the sample's
  copy accordingly.
