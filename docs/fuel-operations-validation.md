# Fuel Operations validation results

## Station setup and training controls

The setup fix adds CEO/GM equipment and account configuration privileges, authenticated additive schema preparation, and CEO/Super Admin managed training records. The 35-test backend suite and desktop/mobile builds pass locally. New tests exercise preparation after dropping a required production index, role restrictions, twenty training purchases, idempotency, test/real isolation, exclusion from business financial totals/general ledger, dependency-blocked cleanup and preservation of real records. Browser checks include preparation recovery and the demo confirmation form. Live training data still requires the authorised user to select Create 20 demo purchases; deployment never seeds automatically.


## 5 November 2026 update

Recovered the unpublished station-loan, company-credit overview and supermarket-withdrawal changes. All 33 backend domain/integration tests passed on a disposable TEST_ONLY MongoDB replica set. Desktop and mobile production builds passed. The loan test covers permission denial for an unassigned station, partial/full repayment, excess repayment rejection, idempotency and atomic tank stock updates. Supermarket withdrawal rejects old-client writes while retaining historical stock.

The first backend attempt timed out during database setup while downloading MongoDB; the cached retry passed all 33 tests. Browser validation remains blocked here: system Chromium cannot create its process socket (Operation not permitted). No production database, migration or deployment was accessed. Apply the additive fuel migration for the new loan/transfer collections before production use.


Review environment: 18 October 2026. Repository base: `43321673bfc63c3a48a2417071f5d06409d9e716`.

| Check | Result |
| --- | --- |
| Domain and transactional integration suite | **31 passed, 0 failed, 0 skipped** |
| MongoDB test topology | Disposable MongoDB 7.0.14, one-node WiredTiger replica set, TEST_ONLY database |
| Desktop production build | Passed |
| Mobile/Android web asset build | Passed with a non-production API URL |
| Browser checks at 1440 × 1000 | Passed: all fuel tabs, company exposure, purchase/opening forms, real PDF download, no page errors or page overflow |
| Browser checks at 390 × 844 | Passed: same checks; mobile and desktop form screenshots visually inspected |
| Additive migration dry run + two apply runs | Passed on the isolated test database; existing customer balance unchanged; no transactions or opening balances invented |
| Missing production migration/index guard | Passed: writes return 503 when the required idempotency index is absent |
| Existing retail checkout and dashboard | Passed: fuel cutover guard, non-fuel checkout, existing cost calculation and legacy customer balance preserved |
| Production database / deployment | Not accessed or changed |
| Live dispenser/controller | Disabled; no manufacturer adapter claimed |
| Signed Android APK | Not built/released; Android source and web assets updated |

The 31 tests cover decimal parsing/rounding, rollover validation, timezone/business dates, summary residuals, individual-mode variance and debt ageing; normal summary and individual posting; prepaid/credit/walk-in splits; partial/manual/oldest allocation; simultaneous cross-station credit; price boundaries; meter overlap/reset/replacement; calibration and linked returns; idempotent requests/event references; unexplained-litre blocking; correction history and period reversal; current database permissions and branch restrictions; reviewed debt and payment reversal; physical dip isolation; disabled equipment authentication; entry-error and prepaid reversals; overdue overrides; reports and journal revenue; inbox duplication and out-of-order quarantine; additive/repeated migration; existing dashboard/retail accounting; production migration gating; vehicle/driver authorisation and daily limits; generic POS cutover protection; and in-flight legacy write drain.

All fixture names explicitly identify TEST_ONLY records. Integration tests construct their own database URI and do not use a configured production URI. Browser tests intercept every fuel API request. Screenshots are inspection-only and are not shipped as operational data or product assets.

Build tooling reports existing large-bundle advisories and the repository's Node engine declaration differs from the available local Node 24 runtime (existing Android CI uses Node 22). Both builds pass. Browser QA used Chromium Headless Shell 134 through the test harness's `FUEL_UI_BROWSER_PATH` option because the environment's default browser package download did not complete; CI uses its installed Playwright browser. These checks do not replace a staging acceptance test on the deployment runtime.

Before production release, review the actual MongoDB topology and restored backup, real equipment mapping/readings/openings, legacy debt treatment, permissions, journal account mapping, financial/tax policy, physical shift reconciliation and representative load. Fuel cost/margin and automatic historical debt transfer are intentionally not fabricated. Large-history pagination and a verified manufacturer adapter remain further work as described in the release instructions.
