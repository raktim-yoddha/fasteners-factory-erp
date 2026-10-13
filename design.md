# Design Scope and Presentation System

## Principles

The product is an operational application, with persistent authority, real save confirmation and clear next actions. Use a restrained industrial design: neutral surfaces, deep green primary actions, amber holds, red errors, and semantic text/icons/reasons. Color alone never communicates status. Typography uses local system fonts so first offline launch needs no remote font service.

The public landing at `/` explains the workflow and solo/team boundaries without querying tenant data. ERP routes are under `/app`; Electron uses hash routes inside the packaged custom-protocol origin. Mobile is deferred and does not affect active DOM design decisions.

## Reusable presentation

`ui-web` owns shared Button variants, Badge, Panel, Field, native Dialog, Table, EmptyState, PageHeading, Stat, capability-aware ActionButton, record forms and workflow screens. The same DOM presentation is composed in browser and Electron. Native draft components are separate and are not DOM wrappers.

Forms are derived from shared record field definitions rather than duplicated per platform. Input uses decimal text and exact reference choices. Draft editing and approved revision immutability are visibly different. Modals use the browser's modal dialog behavior for focus containment, Escape and accessibility semantics. Errors are associated with current operations and never display raw SQL or secrets.

## Navigation and screen inventory

| Surface                  | Design and behavior                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Mode selection           | Solo/device and Team/server choices with authority consequences                                                           |
| Workspace/company picker | Separate names/UUIDs, empty setup, opt-in SAMPLE, current memberships                                                     |
| Authentication           | Registration, verification, sign-in/recovery, invitation acceptance, MFA challenge                                        |
| Overview                 | Real order/lot/hold/work counts, linked blockers and recent audit                                                         |
| Masters                  | Customer, supplier and item tabs; reusable scoped lists and forms                                                         |
| Engineering              | Drawing reference/route draft and immutable approval; full versioned file/BOM views pending                               |
| Sales                    | RFQ, quotation and accepted-order tabs; pinned references, discrepancies and exact price calculations                     |
| Procurement              | PO approval and bounded partial receipts; allocation/requisition breadth pending                                          |
| Stock                    | Separate stores/reserved/available/WIP/vendor balances, exact scan input and guarded movement dialogs                     |
| Production/equipment     | Work and readiness records; full job/capacity/output presentation pending acceptance                                      |
| Quality/vendor work      | Holds/NCR and custody records; approved multi-characteristic/rework screens pending                                       |
| Packing/dispatch         | Reservation scan verification, package readiness, physical dispatch and bounded returns                                   |
| Reports/audit            | Bounded scoped read windows and explicit as-of time; cursor pagination/authorized exports pending                         |
| Company settings         | Current membership, multiple roles, explicit grants, plant scopes, review/MFA policy and accepted ownership transfer      |
| Local recovery           | Encrypted export; desktop all-workspace preview and explicit separate-database activation; portable files/cutover pending |

Unavailable actions are disabled with a reason. Role-aware controls improve discoverability; SQL/process enforcement remains decisive. General search currently filters the loaded scoped window and is labeled accordingly.

## Interaction, responsive behavior and accessibility

- Desktop layout uses a scrollable module sidebar, breadcrumb, search, workspace/plant selection, authority/save strip, dense tables and contextual details.
- Status distinguishes idle, submitting, committed, rejected and unknown. Unknown requests preserve the original key and block conflicting actions or authority switches.
- Use semantic labels, visible focus, keyboard controls, accessible button names and alert/status regions. Mobile-width browser controls target at least 44 logical pixels; horizontal tables remain contained.
- Light/dark preference uses semantic surface/ink/border tokens. Respect reduced motion. Avoid decorative animation and layout shifts.
- Print current approved/draft context honestly, with SAMPLE marking for fictional data. Actual label dimensions, printers and scanner readability require device acceptance.

## Deferred mobile scope

The original native design uses Home, Work, Scan, Approvals and More, with keyboard-safe stepped forms, tablet adaptation and denied-camera/manual entry. Those drafts are preserved, excluded and unverified. They are not part of current delivery acceptance.

## Delivered desktop continuation

Plant selection is available to every authorized team member through the persistent shell, independently of access-administration permission. Shared account-security and snapshot-password components are reused across account/company views. Snapshot passphrases use labeled password inputs and matching confirmation; Electron never relies on an unsupported browser prompt. Printed SAMPLE records retain a visible fictional-data mark.

A restored unresolved command displays Confirmation unknown and offers Retry original request. It blocks scope changes and new business writes. Offline team actions are disabled with a reason and cached reads remain visibly offline. Pending manufacturing completion and CSV export show unavailable states rather than a successful-looking action.

Desktop recovery reuses Dialog, Field, Table and Button. Review labels the all-workspace scope, date, exact counts and retained previous database. Unknown restore opens on local-mode entry and blocks other local writes/select actions until original-token confirmation. Passwords are cleared after review and never stored in the journal. Empty snapshots are explicitly identified.

## Company setup confirmation

Shared desktop/browser onboarding reuses the standard Field and Button components for company, initial plant/warehouse, currency and timezone. It retains original setup details before submitting. An unresolved request replaces the editable creation form with its original details and a Retry original company setup action. It blocks replacement submission and the current picker’s mode/workspace navigation. Sign out preserves the account journal; another account never renders those details. Account and backend switching do not transfer a pending request.

Storage corruption or failure disables creation with a visible reason and a recheck action. A competing window receives an explicit writer-busy reason. A confirmed commit displays its company identifier separately from company-list refresh failure; refresh can be retried without creating another company. Known commits whose journal cleanup failed are labeled local cleanup pending. After restart, that retained request must be confirmed again. Auth/deep-link/device-loss and broader administration acceptance remain pending.
