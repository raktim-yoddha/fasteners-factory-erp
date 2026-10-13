# Build, Packaging and Deployment

## Desktop

Run `pnpm build:desktop` to compile Vite presentation plus independent main, preload and database bundles. Preload cannot inherit Node-only bootstrap code. Run `pnpm --filter @fasteners/desktop package` for the Windows x64 NSIS artifact under `apps/desktop/release`.

The installer bundles local assets and native dependencies. Keep app data separate from installation files and preserve it on uninstall. Test the unpacked/installed artifact with its actual native module; development Node success is not installed proof. Unsigned local builds are development artifacts. Supply signing and authenticated versioned update configuration outside source before public release. Do not activate an updater while an authority command is unresolved.

## Local shared backend

Use `pnpm db:start` for the isolated project, then `pnpm test:db` and `pnpm db:types`. Local verification mail is captured at port 55324. Copy only the publishable URL/key into `.env`; rebuild web/Electron configuration explicitly. Do not put server keys in VITE or EXPO_PUBLIC variables or distributed Electron bundles.

Applied migrations are immutable. Create subsequent migrations through CLI identities and verify changes against the local authority before rollout. Production environments require independent Auth callback/SMTP/MFA/TLS configuration and owner-approved migration procedures. There is no remote reset, paid-project creation or production deployment script hidden in a build command.

## Browser/supporting website

`pnpm build:web` creates a static bundle, landing page, manifest and service-worker assets. The host must apply COOP/COEP/CSP headers compatible with the chosen SQLite VFS and Supabase requests. Changing origin creates a different local storage authority. PWA activation/reload must not interrupt unresolved commands; controlled registration/update UX is an acceptance gate.

## Recovery and operations

Keep recoverable local copies before upgrades. Encrypted database export does not include the pending immutable attachment subsystem. Safe restore activation and reviewed solo-to-team opening import are not generic sync. Hosted database backup must separately cover Storage bytes; perform isolated restore drills with membership/RLS/ledger/file reconciliation.

Native Android packaging is deferred. No Android/iOS/macOS/Linux release, statutory compliance or factory pilot is claimed from current Windows/browser SAMPLE tests.

## Development artifact acceptance

Use `pnpm e2e:desktop:packaged` after packaging to run acceptance against `release/win-unpacked/Fasteners Factory ERP.exe`. Both development and packaged binaries accept isolated test storage only under an OS temporary `factory-desktop-test-*\user-data` directory; normal launch retains ordinary user-data storage. Acceptance runs hidden and never replaces a user's database.

The Windows executable has passed persistence, renderer/IPC isolation, encrypted database export (with a deterministic test dialog destination), and restart retry without duplicate commit. `pnpm release:checksums` writes `release/SHA256SUMS.txt`. Authenticode inspection reports NotSigned. NSIS installation/uninstallation on a clean Windows machine, signing, updater activation and production restore remain pending. The current icon is Electron's default; final branded release assets remain pending.

The project now has an independent Git root and the supplied GitHub repository as `origin`. Its `.github/workflows` directory is at that repository root. Hosted execution remains pending until source is explicitly pushed and GitHub runs the workflow; no parent Git configuration or workflow file was changed. Local commits are required after each completed, validated change under the engineering contract.
