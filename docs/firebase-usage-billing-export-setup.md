# Firebase Usage billing export setup

The Firebase Usage page reads exact expenditure from the Standard Cloud Billing export. It never runs automatically: opening the page, changing dates, and changing refresh checkboxes make no API request. Only **Load selected** or **Refresh selected** starts work, and the server calls only the checked data sources.

## One-time Google Cloud setup

1. Sign in with an account that can administer the Cloud Billing account linked to `trinity-family-schools`.
2. In BigQuery, create a dataset such as `billing_export` in the `US` multi-region. Do not enable table expiration.
3. In **Cloud Billing > Billing export > BigQuery export**, enable **Standard usage cost** export and select that dataset.
4. Grant the service account stored in `FIREBASE_ADMIN_CLIENT_EMAIL`:
   - **BigQuery Job User** on the query project.
   - **BigQuery Data Viewer** on the billing export dataset.
5. The application automatically discovers the generated `gcp_billing_export_v1_...` table in
   `FIREBASE_ADMIN_PROJECT_ID.billing_export` through the BigQuery metadata API. If a different
   project, dataset, or exact table should be used, add these server-side deployment variables:

   ```text
   FIREBASE_BILLING_BIGQUERY_PROJECT_ID=trinity-family-schools
   FIREBASE_BILLING_BIGQUERY_TABLE=trinity-family-schools.billing_export.gcp_billing_export_v1_BILLING_ACCOUNT_ID
   FIREBASE_BILLING_BIGQUERY_MAX_BYTES=104857600
   ```

   Replace `BILLING_ACCOUNT_ID` with the suffix Google assigns to the Standard export table. Keep
   the complete value in `project.dataset.table` format.

6. Redeploy the application, select **Exact expenditure**, and press **Load selected** on the Firebase Usage page.

Billing export begins collecting data after it is enabled; older costs are not guaranteed to be backfilled.

## Cost safeguards

- Four independent checkboxes control collection counts and size estimates, operation history, storage totals, and exact expenditure. Collection sampling is off by default because it is the only choice that adds substantial Firestore reads.
- Every manual request uses one Firestore document read to confirm that the caller is still an active administrator. It performs no Firestore writes.
- SQL always filters `_PARTITIONTIME` and the selected usage interval.
- Each manual query has a 100 MiB maximum-bytes-billed ceiling by default. BigQuery rejects a larger scan instead of running it.
- BigQuery query caching is enabled.
- Automatic table discovery uses the metadata API and is cached in memory for one hour; it does
  not scan table data or incur query bytes.
- The application caches an identical range for five minutes, but never initiates a refresh itself.
- Collection-size estimation reads no more than 250 sampled documents and reuses the result for six hours when the server instance remains warm.
- The UI labels collection sizes as estimates and keeps the exact database-plus-index total separate.
