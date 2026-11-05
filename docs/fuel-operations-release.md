# Fuel Operations v2 — review release

This change extends ADMABS with real Fastify endpoints, MongoDB collections, transactional posting and one responsive React interface shared by the desktop site, mobile web and Android source project. It is prepared for review, not deployed to production.

## What was inspected

- Existing React desktop/mobile shells, API clients, custom permission editor and Android workflow.
- Fastify authentication, role/outlet/branch scoping, fuel, customers/payments, accounting, dashboard, analytics and employee performance routes.
- MongoDB/Mongoose schemas for tanks, pumps/nozzles, fuel shifts, dips, deliveries, customers, payments, sales, journals, outlets and workforce schedules.
- `railway.json`, database connection setup, application bootstrap and automatic legacy migration/preparation code.

No production database URI was supplied or used. Production contents, backup recovery, database topology, equipment and live account balances therefore still require review in the target environment. All transaction tests use a disposable, explicitly named TEST_ONLY database.

## Architecture and data protection

New fuel operations live at `/api/fuel/operations`. Existing customers can be linked by identity. Their balances are displayed separately and are not overwritten, copied or collected through the fuel ledger. A linked customer with an existing legacy balance cannot receive an automatic opening fuel debt entry. Any transfer of that debt needs an invoice-by-invoice reconciliation and accounting reclassification review.

The additive migration creates only versioned fuel collections and indexes. It creates no business rows, prices, readings or balances, and never drops indexes. Genuine openings are entered and audited by authorised operators. Old tanks, pumps, shifts, dips and deliveries remain intact. Station cutover requires all legacy open/submitted/queried shifts at the selected outlet to be resolved. After cutover, legacy fuel mutation endpoints reject writes for that outlet, including older clients. Legacy read endpoints remain available.

Branch/outlet assignments and custom grants are reloaded from the user record for every new fuel request. Grants in an old JWT cannot restore removed permissions. Station access checks require both assigned branch and, when present, assigned outlet. Company-level exposure is visible when assessing a permitted company at an assigned station; underlying invoice detail remains location scoped unless company-wide reporting is granted.

All financial changes, credit checks, stock movements, allocations, journals and audit writes run in one MongoDB transaction. Company writes serialise concurrent credit use across stations; station writes serialise readings, price boundaries and posting. A partial unique index permits only one unfinished period for each nozzle. Unique idempotency keys and immutable dispensing event references prevent duplicate submissions. Reusing a request key with different content is rejected.

## Posting and arithmetic

| Quantity | Storage | Input precision |
| --- | --- | --- |
| Fuel quantity / meter | Integer millilitres | Up to 3 litre decimals; meter-specific precision enforced |
| Unit price | Integer units of 1/10,000 GHS | Up to 4 decimals |
| Financial amount | Integer pesewas | Up to 2 decimals |

BigInt multiplication rounds half up once for each sale and each residual meter segment. Meters must remain below the configured rollover modulus. A rollover is accepted only for a descending reading, with supervisor permission and a reason. Reset, replacement and opening correction are separate supervised events after the prior period finishes.

Effective prices are immutable and timestamped by the server. A price change requires an actual boundary reading for every affected active nozzle period. Each period retains its original equipment mapping, fuel, mode, prices and segment boundaries. There is no retroactive repricing. The first release applies new prices immediately; it does not schedule future price activation.

- **Individual mode:** every sale recognises revenue and deducts stock immediately. Period posting deducts only metered dispensing not already deducted, including approved non-sale movements.
- **Summary mode:** company issues recognise their revenue individually. Posting derives only residual walk-in litres/value and deducts the total metered stock once. No invented individual walk-in receipts, vehicles or timestamps are created.
- Receipt allocations reduce receivables; they do not create sales revenue. Unapplied receipts remain an advance liability. Prepaid purchases consume both the company advance balance and the underlying receipt's unapplied balance.
- Calibration/non-sale dispensing requires approval. Physical tank returns have separate, quantity-capped movements linked to the approved dispensing or an actual fuel sale. Dips record physical-versus-book variance without overwriting stock.
- Posting requires Draft → Submitted → Approved → Posted. Money variances require a reason. Unexplained litres and unapproved movements block posting.
- An entry-error sale reversal explicitly corrects its bookkeeping stock deduction. A financial-only reversal preserves physical dispensing. A physical return always needs a separate linked tank return. Receipt reversals retain and reverse allocation history.
- Period reversal reverses its own financial journals, preserves meter and physical stock history, and does not reverse its individual sales. It is restricted to the last period on that nozzle. The reversed period cannot be reposted. Later history must be corrected through reviewed adjustments rather than rewriting past meters.

Journal accounts reuse existing ADMABS conventions: 1000 payment clearing, 1100 receivables, 4100 fuel sales; fuel advances use 2105, credit notes 4105, collection shortages 6190 and overages 4190. Reviewed opening/debit adjustments use 3990 clearing and need finance review. No fuel acquisition cost or cost-of-sales policy is invented. Company dashboard revenue includes fuel journal recognition and reversals exactly once; profit remains based on the existing retail costing model and is explicitly labelled as excluding fuel margin. Fuel receivables remain separate from legacy customer balances.

## Migration and staged rollout

1. Review this branch and CI results. Confirm the selected station's real equipment, fuel names, timezone, permissions, financial account mapping and cutover date. Take and restore-test a database backup using the organisation's normal process.
2. Point `MONGODB_URI` at a staging restore. MongoDB must be a replica set or mongos deployment. The existing standalone local fallback is unsuitable for transactional fuel posting. Do not change production topology through this migration.
3. Install/build and run the read-only migration review from the repository root:

   ```bash
   npm ci
   npm --prefix server ci
   npm run build
   npm --prefix server run migrate:fuel
   ```

4. Inspect the output. It reports transaction support, legacy record counts, unfinished legacy shifts and proposed new indexes. It does not expose customer data or balances.
5. Apply only after reviewing the target database:

   ```bash
   npm --prefix server run migrate:fuel:apply
   ```

   Repeat runs are additive. `syncIndexes`, drops, seeds and historical balance rewrites are never used. Restart the backend after migration. Under `NODE_ENV=production`, the new routes fail closed for writes if required collections/indexes are missing.
6. Start the review environment with its existing secure JWT configuration. Existing startup preparation and legacy migration mechanisms remain unchanged: review `RUN_LEGACY_MIGRATION` and the existing live-preparation configuration before starting a staging restore. This release does not assume they are safe to rerun on a new target.
7. Complete a station pilot: configure the real station, tanks, nozzles, readings and price; enter reviewed tank openings; then run a genuine shift in the chosen mode. Configure company policies and grants before credit use. Do not copy TEST_ONLY fixtures into a real database.
8. Reconcile the first shifts, receipts, journal entries and tank movements with physical records. Review the production deployment separately. No automatic merge or Railway deployment is part of this release.

The current Railway build/start commands remain valid. New backend dependencies are not required. The Android workflow installs root dependencies because the shared fuel interface imports the existing root PDF implementation. The Android source is updated; a signed APK has not been produced or released here. Existing installed APKs must be replaced before using stations that have cut over, because legacy writes are intentionally blocked there.

### Rollback

Before any v2 activity, application rollback can leave additive collections/indexes intact. After real v2 activity or station cutover, keep the legacy-write lock and preserve all fuel records and journals. Do not delete station records to reopen legacy entry, drop collections, or restore an old database over later activity. Roll forward with audited corrections. A coordinated application/database rollback requires reconciliation and an approved recovery plan outside this migration.

## Validation

Run:

```bash
npm --prefix server run test:fuel
npm run build
VITE_API_URL=https://example.invalid/api npm --prefix mobile-app run build
npx playwright install --with-deps chromium
npm run test:fuel:ui
```

The MongoDB test harness starts its own one-node WiredTiger replica set and ignores any production URI. TEST_ONLY fixtures cover both operating modes; mixed credit, prepaid and walk-in issues; partial/manual/oldest allocations; concurrent cross-station credit; segmented prices; rollover, reset and replacement; non-sale approval and returns; duplicate requests; controller authentication, inbox duplication and out-of-order quarantine; corrections/reversals; live permission changes; scoped access; stock and revenue deduplication; and physical dip separation. The UI harness intercepts every fuel API request and checks desktop/mobile navigation, forms and exposure without contacting production.

See `fuel-operations-validation.md` for results and practical limits.

## Equipment boundary and current limits

Manual operation, reviewed imports and the transactional accounting module work without physical dispenser integration. The adapter contract, equipment authentication, disabled connection records, immutable inbox references, mapping, retry processing and failure monitoring are provided. There is no shipped manufacturer protocol, no dispenser start/stop capability and no UI switch to enable unverified hardware. An authenticated request to an unverified/disabled connection returns 423. Out-of-order events are retained for supervised resolution; the first adapter accepts posting only into the appropriate current open meter/price segment.

A verified adapter must define a stable event identity shared with any manual/import record for the same dispensing event. Software cannot identify an unknown physical event solely by matching approximate litres and time. Operators must reconcile pending equipment events before manual fallback. Live enablement requires separate equipment/API verification and a reviewed adapter implementation.

Recent screens have explicit limits (100 periods, 200 sales/movements; 500 companies; report exports up to 5,000 records). Report timestamps and integer units are documented; stock, payment and audit exports are the most recent station records, while sale/period filters use business dates. Large historical extraction needs pagination before these limits are exceeded. The reports do not claim an arbitrary-date historical account snapshot; statements show current balances and complete current permitted account history.

The release does not calculate fuel COGS/margin, impose an unverified tax regime, transfer legacy debt automatically or claim hardware integration. Production acceptance still needs restored-data migration review, physical station reconciliation, representative load testing and operator sign-off. These are release-review items, not completed production validations.

### Legacy write drain during cutover

Cutover and in-flight legacy fuel writes share an atomic guard on the existing outlet. Cutover refuses a nonzero in-flight count; old fuel/POS requests cannot acquire a new lease once cutover commits. The read-only migration report identifies nonzero counts. If an old worker crashes, the conservative count may remain nonzero: stop all old workers, verify all requests and their records have been reconciled, and have an authorised database administrator review/reset that counter before retrying cutover. No timeout silently releases a potentially active financial write.
