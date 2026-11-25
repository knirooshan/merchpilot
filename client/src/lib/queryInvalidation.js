/**
 * Centralized TanStack Query invalidation helpers.
 * Ensures mutations invalidate both their primary resource queries and any
 * cross-page or aggregate/derived queries (dashboard, reports, activity logs, etc.).
 */

/**
 * Deduplicate query keys and invalidate all matching queries in parallel.
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {Array<Array<unknown>>} keys
 */
export function invalidateKeys(queryClient, keys) {
  if (!queryClient || !Array.isArray(keys) || keys.length === 0) {
    return Promise.resolve();
  }

  const seen = new Set();
  const uniqueKeys = [];
  for (const key of keys) {
    const serialized = JSON.stringify(key);
    if (!seen.has(serialized)) {
      seen.add(serialized);
      uniqueKeys.push(key);
    }
  }

  return Promise.all(
    uniqueKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/** Invalidate queries affected by creating, updating, emailing, writing off, or deleting an invoice. */
export function invalidateOnInvoiceMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["invoices"],
    ["invoice"],
    ["outstandingInvoices"],
    ["payments"],
    ["deliveryQueue"],
    ["deliverySearch"],
    ["delivery"],
    ["customerSummary"],
    ["dashboardStats"],
    ["dashboardChart"],
    ["dashboardActivities"],
    ["reportsSales"],
    ["reportsProfitLoss"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by recording, updating, or deleting a payment. */
export function invalidateOnPaymentMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["payments"],
    ["invoices"],
    ["invoice"],
    ["outstandingInvoices"],
    ["customerSummary"],
    ["dashboardStats"],
    ["dashboardChart"],
    ["dashboardActivities"],
    ["reportsSales"],
    ["reportsProfitLoss"],
    ["activityLogs"],
  ]);
}

/**
 * Invalidate queries affected by POS checkout, order sync, or order refund.
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {{ includeSyncEntities?: boolean }} [options]
 */
export function invalidateOnOrderMutation(
  queryClient,
  { includeSyncEntities = false } = {},
) {
  const keys = [
    ["orders"],
    ["invoices"],
    ["invoice"],
    ["payments"],
    ["outstandingInvoices"],
    ["deliveryQueue"],
    ["deliverySearch"],
    ["delivery"],
    ["customerSummary"],
    ["dashboardStats"],
    ["dashboardChart"],
    ["dashboardActivities"],
    ["reportsSales"],
    ["reportsProfitLoss"],
    ["activityLogs"],
  ];

  if (includeSyncEntities) {
    keys.push(["products"], ["customers"]);
  }

  return invalidateKeys(queryClient, keys);
}

/** Invalidate queries affected by delivery status or tracking updates. */
export function invalidateOnDeliveryMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["deliveryQueue"],
    ["deliverySearch"],
    ["delivery"],
    ["invoices"],
    ["invoice"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by creating, updating, emailing, or deleting a quotation. */
export function invalidateOnQuotationMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["quotations"],
    ["quotation"],
    ["customerSummary"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by creating, updating, or deleting an expense. */
export function invalidateOnExpenseMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["expenses"],
    ["vendorSummary"],
    ["dashboardStats"],
    ["dashboardChart"],
    ["dashboardActivities"],
    ["reportsProfitLoss"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by creating, updating, or deleting a customer. */
export function invalidateOnCustomerMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["customers"],
    ["customerSummary"],
    ["invoices"],
    ["invoice"],
    ["quotations"],
    ["quotation"],
    ["orders"],
    ["outstandingInvoices"],
    ["dashboardStats"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by creating, updating, or deleting a vendor. */
export function invalidateOnVendorMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["vendors"],
    ["vendorSummary"],
    ["expenses"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by creating, updating, syncing, or deleting products. */
export function invalidateOnProductMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["products"],
    ["dashboardStats"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by uploading or deleting media items. */
export function invalidateOnMediaMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["media"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by creating, updating, or deleting users. */
export function invalidateOnUserMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["users"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by updating store settings. */
export function invalidateOnSettingsMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["settings"],
    ["logoBase64"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by tenant management actions. */
export function invalidateOnTenantMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["tenants"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}

/** Invalidate queries affected by updating system/admin settings. */
export function invalidateOnAdminSettingsMutation(queryClient) {
  return invalidateKeys(queryClient, [
    ["adminSettings"],
    ["dashboardActivities"],
    ["activityLogs"],
  ]);
}
