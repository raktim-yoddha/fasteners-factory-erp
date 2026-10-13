# TASK-0003 — Native Android client

## Scope and ownership

Native implementation owns `apps/mobile`, `packages/sqlite-mobile`, `packages/ui-native`, mobile validation tooling and native tests. Share domain/controllers; use React Native primitives rather than a WebView.

## Interfaces and behavior

Implement `Repository` through native Expo SQLite with serialized exclusive transactions. Expo Router presents Home, Work, Scan, Approvals and More. Team uses the same cloud repository; solo needs no cloud account/configuration. Managed files, SecureStore and camera access belong in native adapters.

## Acceptance

Run typecheck and export/build checks, then install an Android development/release APK and exercise offline workspace creation, restart persistence, transaction rollback/idempotency, concurrent command serialization, denied camera/manual entry, keyboard/back handling and session/company-switch isolation. No Expo Go or Node SQLite result substitutes for installed Android evidence.

## Evidence and remaining gates

Native build and device results: pending. Signing secrets, physical scanner/printer behavior, store-ready AAB and production release remain separate evidence.
