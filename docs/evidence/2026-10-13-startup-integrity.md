# Local startup and current artifact acceptance — 2026-10-13

Windows 11 x64. Desktop and backend remain active; mobile remains excluded.

`pnpm check` passed strict typecheck, lint/contracts, **50 tests across 8 files**, and production web build. Six new actual SQLite initialization cases prove byte preservation after rejecting future versions, bad checksums, missing audit objects, unexpected schema objects and unversioned history. A fault after executing first-schema DDL rolls back all objects/version; retry initializes cleanly, and existing workspace bytes remain unchanged on subsequent initialization.

The affected browser OPFS persistence/reload/writer-exclusion flow passed. The rebuilt Windows NSIS package passed the expanded SQLite/IPC/export/restore/restart acceptance flow in **35.4 seconds**. Restore UI activation, original-token confirmation recovery and corrupt-journal blocking remain covered. Authenticode reports **NotSigned**.

```text
8f043d011f86a1fc92a08b21d7b16a115d395e854609f0c6001e63e5bebf171a  Fasteners Factory ERP Setup 0.1.0.exe
c90456bfb71e9936cf49cfa08080dfd4ac3464d71b5c5eaf04e472bc3e029f06  Fasteners Factory ERP Setup 0.1.0.exe.blockmap
```

These replace the preceding slice's checksum as the identity of the latest local development build. Backend sources are unchanged since their **58 authority + 15 concurrency assertions and 8 Auth/HTTP checks** passed; see [that evidence](2026-10-13-team-concurrency.md). Complete portable restore, raw retained-file recovery UI, schema upgrades, binary rollback, clean-machine installation, signing and factory/production acceptance remain pending. No push/publication or sibling changes occurred.
