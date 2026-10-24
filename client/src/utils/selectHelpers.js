import axios from "axios";
import { ENDPOINTS } from "../config/api";

/**
 * Format a Customer object into a SearchableSelect option.
 */
export const formatCustomerOption = (c) => {
  if (!c) return { value: "", label: "" };

  const name =
    c.firstName || c.lastName
      ? `${c.firstName || ""} ${c.lastName || ""}`.trim()
      : c.billing?.company || "Unnamed Customer";

  const subtextParts = [];
  if (c.email) subtextParts.push(c.email);
  if (c.billing?.phone || c.phone) subtextParts.push(c.billing?.phone || c.phone);
  if (c.billing?.company && name !== c.billing.company) {
    subtextParts.push(c.billing.company);
  }

  return {
    value: c._id,
    label: name,
    subtext: subtextParts.length > 0 ? subtextParts.join(" • ") : null,
    customer: c,
  };
};

/**
 * Format a Vendor object into a SearchableSelect option.
 */
export const formatVendorOption = (v) => {
  if (!v) return { value: "", label: "" };

  const subtextParts = [];
  if (v.contactPerson) subtextParts.push(v.contactPerson);
  if (v.email) subtextParts.push(v.email);
  if (v.phone) subtextParts.push(v.phone);

  return {
    value: v._id,
    label: v.name || "Unnamed Vendor",
    subtext: subtextParts.length > 0 ? subtextParts.join(" • ") : null,
    vendor: v,
  };
};

/**
 * Search vendors on the server (loads 10 records by default).
 */
export const searchVendorsApi = async (token, query = "", limit = 10) => {
  try {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const params = new URLSearchParams({
      limit: String(limit),
      paginate: "true",
    });

    if (query && query.trim()) {
      params.append("search", query.trim());
    }

    const { data } = await axios.get(
      `${ENDPOINTS.VENDORS}?${params.toString()}`,
      config
    );

    const list = Array.isArray(data) ? data : data.data || [];
    return list.map(formatVendorOption);
  } catch (error) {
    console.error("Error searching vendors:", error);
    return [];
  }
};

/**
 * Fetch a single vendor by ID.
 */
export const fetchVendorByIdApi = async (token, id) => {
  if (!id) return null;
  try {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const { data } = await axios.get(ENDPOINTS.VENDOR_BY_ID(id), config);
    return formatVendorOption(data);
  } catch (error) {
    console.error("Error fetching vendor by id:", error);
    return null;
  }
};

/**
 * Search customers on the server (loads 10 records by default).
 */
export const searchCustomersApi = async (token, query = "", limit = 10) => {
  try {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const params = new URLSearchParams({
      limit: String(limit),
      paginate: "true",
    });

    if (query && query.trim()) {
      params.append("search", query.trim());
    }

    const { data } = await axios.get(
      `${ENDPOINTS.CUSTOMERS}?${params.toString()}`,
      config
    );

    const list = Array.isArray(data) ? data : data.data || [];
    return list.map(formatCustomerOption);
  } catch (error) {
    console.error("Error searching customers:", error);
    return [];
  }
};

/**
 * Fetch a single customer by ID.
 */
export const fetchCustomerByIdApi = async (token, id) => {
  if (!id || id === "0000-0000-0001") {
    if (id === "0000-0000-0001") {
      return {
        value: "0000-0000-0001",
        label: "Walk-in Customer",
        subtext: "Default counter customer",
      };
    }
    return null;
  }
  try {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const { data } = await axios.get(ENDPOINTS.CUSTOMER_BY_ID(id), config);
    return formatCustomerOption(data);
  } catch (error) {
    console.error("Error fetching customer by id:", error);
    return null;
  }
};
