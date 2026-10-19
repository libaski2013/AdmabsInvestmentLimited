# ADMABS fuel operator guide

## First-time administrator setup

1. Open **Fuel Station**. Choose **+ Station** and select the existing fuel outlet. Review and finish old fuel shifts before confirming cutover. Use `Africa/Accra` for Ghana stations using existing ADMABS schedules.
2. Under **Tanks and Stock**, add real tanks and their fuel types/capacities. Add each pump's nozzles and correct tank link. Configure meter decimal precision and, only if supported, the rollover modulus.
3. A supervisor uses **Meter Readings → Baseline / reset / replacement** to enter a verified first reading with a reason. No reading is generated automatically.
4. Enter the reviewed opening tank stock under **Stock movement → Reviewed opening stock**. A physical dip is evidence; it does not establish or overwrite calculated stock by itself.
5. Under **Integration Settings**, enter the actual effective price. At later price changes, collect boundary readings for every affected open nozzle period.
6. Give staff the required fuel privileges through the existing Staff Directory. Recording sales, entering/approving readings, receiving payments, configuring equipment, adjusting accounts, overriding credit and reversing records are distinct privileges. Branch and outlet assignments still apply.

## Attendant shift

1. Select the correct station. Check **Meter Readings** and open one period per active nozzle. Enter the actual opening reading, which must equal the approved previous closing, and choose the correct operating mode. Opening differences need a supervisor correction.
2. **Individual mode:** record every fuel purchase under **Fuel Sales**. **Meter summary mode:** record all company credit/prepaid issues and other company issues; the system derives remaining walk-in litres at close. Do not also enter individual walk-in receipts in summary mode.
3. For a company purchase, select/search the company first. Check **Balance Due**, **Advance Credit**, overdue debt and available credit. Select an authorised vehicle/driver when required and enter the voucher/PO reference.
4. Enter actual litres, cash/MoMo/card paid now and any advance credit used. An unpaid remainder becomes company credit. The server applies the effective segment price and validates the limit. Use a unique receipt/source reference and dispensing event reference. A later controller/import entry for the same event must use the same dispensing event reference.
5. Record test/calibration and other non-sale dispensing separately under **Shift Reconciliation**. A supervisor must approve it. Fuel physically returned to the tank gets a separate linked return movement after dispensing stock has been posted.
6. Use a supervised **Handover** to transfer an open shared nozzle period to the next assigned attendant, with an actual handover reading and a reason. Individual transactions retain their recording attendant.
7. At close, enter the actual closing meter and the actual cash, MoMo and card totals collected from this period's current sales. Enter zero explicitly for a method with no collections. Do not include payments of older debts in these declarations.
8. Review litres and money variances, then submit. A supervisor approves the reconciliation; an authorised poster posts it. Complete all active nozzle periods. The next opening uses the approved closing and remains blocked until the prior period is posted.

## Company accounts and payments

- Create companies in **Company Accounts**, including terms, permitted fuel types/stations, credit limit, vehicle/driver requirements and authorisation policy. New fuel accounts start at zero.
- **Vehicles and Drivers** holds the authorised identities and optional daily vehicle litres/spending limits. Account suspension blocks new purchases while allowing debt settlement.
- Use **Payments → Payments Received** for debt collections and advance deposits. Choose oldest-due allocation, a specific invoice, or on-account/advance. Split a payment across multiple invoices through subsequent manual allocations. Allocation history remains visible.
- Unapplied receipts are Advance Credit. Prepaid purchases use that credit. A payment does not create fuel revenue a second time.
- **Statements and Invoices** shows Fuel Purchases, Payments Received, Credit Notes, Debit Adjustments, Balance Due and Advance Credit. Review ageing and print/PDF or export the account.
- An existing linked customer balance is separate. Do not recreate it as fuel opening debt. Opening/debit adjustments require finance review and a supporting reference.

## Corrections

- Before posting, an authorised supervisor can correct a closing reading with **Correct**. The previous value remains in the audit history; enter the corrected closing and submit again.
- A meter reset or replacement is not a negative sale. Finish the old period and record a supervised meter event before the next opening.
- A descending closing reading is rejected unless a supervisor confirms an actual configured rollover with a reason.
- Use **Reverse** for financial errors. Select **entry error** only if the recorded dispensing did not occur; it corrects the erroneous stock deduction. For actual fuel physically returned, use a separate linked tank return. Financial-only cancellation does not put fuel back in a tank.
- Allocated payments and credit notes must be resolved before reversing the affected sale. A receipt cannot be reversed while its advance has been consumed by unreversed prepaid purchases.
- Posted readings and financial records cannot be silently edited or deleted. Period financial reversal preserves physical stock/meter history, applies only to the last period on that nozzle and does not reverse the individual sales. Ask finance to use reviewed adjustments when later history exists.

## Daily management checks

Review **Reports** for nozzle/shift sales, company/vehicle consumption, exposure and ageing, outstanding invoices, payment allocations, collection shortages, meter differences, physical tank variance and overrides/reversals. Use actual delivery/transfer documents for stock movements. Do not use a physical dip to replace book stock without an approved adjustment.

**Hardware:** all routine work above is manual now. Controller connections remain disabled until the actual manufacturer, model, controller and API have been verified and a reviewed adapter has been added. A configured connection is not proof of live dispenser integration.
