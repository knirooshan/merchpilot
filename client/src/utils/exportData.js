/**
 * Client-side data export utilities for CSV, JSON, and XML formats.
 */

export const DEFAULT_STRIP_KEYS = new Set([
  "__v",
  "password",
  "setupPasskey",
  "token",
  "refreshToken",
  "secret",
]);

const getDateSuffix = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Build a sanitized download filename with today's date suffix.
 * @param {string} baseName
 * @param {string} ext
 * @returns {string}
 */
export const buildExportFilename = (baseName = "export", ext = "csv") => {
  const cleanBase =
    String(baseName || "export")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "export";
  const cleanExt = String(ext || "csv").replace(/^\.+/, "").toLowerCase();
  return `${cleanBase}_${getDateSuffix()}.${cleanExt}`;
};

/**
 * Recursively sanitize export payloads by preserving all available fields
 * while removing sensitive credentials, Mongoose internals, and base64 image blobs.
 * @param {unknown} value
 * @param {{ stripKeys?: Set<string> }} [options]
 * @returns {unknown}
 */
export const sanitizeExportData = (
  value,
  { stripKeys = DEFAULT_STRIP_KEYS } = {}
) => {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  if (typeof value === "string") {
    return value.startsWith("data:image/") ? undefined : value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeExportData(item, { stripKeys }))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "function" || v === undefined) continue;
      if (stripKeys.has(k)) continue;
      if (typeof v === "string" && v.startsWith("data:image/")) continue;

      const sanitized = sanitizeExportData(v, { stripKeys });
      if (sanitized !== undefined) {
        out[k] = sanitized;
      }
    }
    return out;
  }

  return value;
};

/**
 * Flatten a nested plain object into dot-notation key/value pairs for CSV output.
 * Primitive arrays are joined with "; " and object arrays are serialized as JSON.
 * @param {Record<string, any>} obj
 * @param {string} [prefix]
 * @param {Record<string, any>} [target]
 * @returns {Record<string, any>}
 */
export const flattenObjectForCsv = (obj, prefix = "", target = {}) => {
  if (obj === null || obj === undefined) {
    if (prefix) target[prefix] = "";
    return target;
  }

  if (obj instanceof Date) {
    target[prefix] = Number.isNaN(obj.getTime()) ? "" : obj.toISOString();
    return target;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      target[prefix] = "";
    } else if (
      obj.some(
        (item) =>
          item !== null && typeof item === "object" && !(item instanceof Date)
      )
    ) {
      target[prefix] = JSON.stringify(obj);
    } else {
      target[prefix] = obj
        .map((item) => (item === null || item === undefined ? "" : String(item)))
        .filter(Boolean)
        .join("; ");
    }
    return target;
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      if (prefix) target[prefix] = "";
      return target;
    }
    for (const [key, val] of entries) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenObjectForCsv(val, nextKey, target);
    }
    return target;
  }

  target[prefix] = obj;
  return target;
};

/**
 * Convert a dot/camelCase/snake_case field key into a readable CSV header label.
 * @param {string} key
 * @returns {string}
 */
export const formatHeaderLabel = (key) => {
  return String(key || "")
    .split(".")
    .map((segment) => {
      if (segment === "_id" || segment === "id") return "ID";
      return segment
        .replace(/^_+/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    })
    .filter(Boolean)
    .join(" - ");
};

/**
 * Normalize a value for CSV output and apply RFC 4180 escaping.
 * @param {unknown} value
 * @returns {string}
 */
export const formatCsvValue = (value) => {
  if (value === null || value === undefined) return "";

  let str;
  if (value instanceof Date) {
    str = Number.isNaN(value.getTime()) ? "" : value.toISOString();
  } else if (Array.isArray(value)) {
    str = value
      .map((item) => {
        if (item === null || item === undefined) return "";
        if (typeof item === "object") return JSON.stringify(item);
        return String(item);
      })
      .filter(Boolean)
      .join("; ");
  } else if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Resolve cell value from a row using a column definition.
 * @param {Record<string, any>} row
 * @param {{ key: string, label?: string, accessor?: (row: any) => any }} column
 * @returns {unknown}
 */
const resolveColumnValue = (row, column) => {
  if (typeof column.accessor === "function") {
    return column.accessor(row);
  }
  return row?.[column.key];
};

/**
 * Map an array of objects to clean normalized objects using column definitions.
 * @param {Array<Record<string, any>>} rows
 * @param {Array<{ key: string, label?: string, accessor?: (row: any) => any }>} columns
 * @returns {Array<Record<string, any>>}
 */
export const mapRowsToColumns = (rows, columns) => {
  if (!Array.isArray(rows)) return [];
  if (!Array.isArray(columns) || columns.length === 0) return rows;

  return rows.map((row) => {
    const out = {};
    for (const col of columns) {
      out[col.key] = resolveColumnValue(row, col) ?? "";
    }
    return out;
  });
};

/**
 * Build an RFC 4180 CSV string with UTF-8 BOM for Excel compatibility.
 * When includeAllFields is true (default), includes explicit columns first and appends
 * all remaining flattened fields from each row without duplicating keys.
 * @param {Array<Record<string, any>>} rows
 * @param {Array<{ key: string, label?: string, accessor?: (row: any) => any }>} [columns]
 * @param {{ includeAllFields?: boolean }} [options]
 * @returns {string}
 */
export const buildCSV = (
  rows,
  columns,
  { includeAllFields = true } = {}
) => {
  const list = Array.isArray(rows) ? rows : [];
  const sanitizedList = list.map((row) => sanitizeExportData(row));

  if (!includeAllFields) {
    let resolvedColumns = columns;
    if (!Array.isArray(resolvedColumns) || resolvedColumns.length === 0) {
      const keys = new Set();
      for (const row of sanitizedList) {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          Object.keys(row).forEach((k) => keys.add(k));
        }
      }
      resolvedColumns = Array.from(keys).map((key) => ({
        key,
        label: formatHeaderLabel(key),
      }));
    }

    const headerLine = resolvedColumns
      .map((col) => formatCsvValue(col.label ?? col.key))
      .join(",");

    const dataLines = sanitizedList.map((row) =>
      resolvedColumns
        .map((col) => formatCsvValue(resolveColumnValue(row, col)))
        .join(",")
    );

    return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}`;
  }

  const flatRows = sanitizedList.map((row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? flattenObjectForCsv(row)
      : { value: row }
  );

  const explicitCols = Array.isArray(columns) ? columns : [];
  const resolvedColumns = [...explicitCols];
  const seenKeys = new Set(explicitCols.map((col) => col.key));

  for (const flatRow of flatRows) {
    for (const key of Object.keys(flatRow)) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        resolvedColumns.push({
          key,
          label: formatHeaderLabel(key),
          __fromFlat: true,
        });
      }
    }
  }

  const headerLine = resolvedColumns
    .map((col) => formatCsvValue(col.label ?? formatHeaderLabel(col.key)))
    .join(",");

  const dataLines = sanitizedList.map((row, idx) =>
    resolvedColumns
      .map((col) => {
        if (col.__fromFlat) {
          return formatCsvValue(flatRows[idx]?.[col.key]);
        }
        const val =
          typeof col.accessor === "function"
            ? col.accessor(row)
            : row?.[col.key] !== undefined
              ? row[col.key]
              : flatRows[idx]?.[col.key];
        return formatCsvValue(val);
      })
      .join(",")
  );

  return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}`;
};

/**
 * Escape XML special characters.
 * @param {unknown} value
 * @returns {string}
 */
export const escapeXml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Sanitize a string into a valid XML 1.0 element name.
 * @param {string} name
 * @returns {string}
 */
export const sanitizeXmlTag = (name) => {
  let tag = String(name ?? "").trim();
  if (!tag) return "item";
  tag = tag.replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (!/^[a-zA-Z_]/.test(tag)) {
    tag = `_${tag}`;
  }
  return tag;
};

const serializeXmlNode = (tagName, value, itemName, indentLevel) => {
  const tag = sanitizeXmlTag(tagName);
  const indent = "  ".repeat(indentLevel);

  if (value === null || value === undefined) {
    return `${indent}<${tag} />`;
  }

  if (value instanceof Date) {
    const iso = Number.isNaN(value.getTime()) ? "" : value.toISOString();
    return `${indent}<${tag}>${escapeXml(iso)}</${tag}>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${indent}<${tag} />`;
    }
    const childTag = sanitizeXmlTag(itemName);
    const children = value
      .map((entry) =>
        serializeXmlNode(childTag, entry, "item", indentLevel + 1)
      )
      .join("\n");
    return `${indent}<${tag}>\n${children}\n${indent}</${tag}>`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, v]) => typeof v !== "function" && v !== undefined
    );
    if (entries.length === 0) {
      return `${indent}<${tag} />`;
    }
    const children = entries
      .map(([k, v]) => serializeXmlNode(k, v, "item", indentLevel + 1))
      .join("\n");
    return `${indent}<${tag}>\n${children}\n${indent}</${tag}>`;
  }

  return `${indent}<${tag}>${escapeXml(value)}</${tag}>`;
};

/**
 * Build a formatted UTF-8 XML document string from arrays or objects.
 * @param {unknown} data
 * @param {{ rootName?: string, itemName?: string }} [options]
 * @returns {string}
 */
export const buildXML = (
  data,
  { rootName = "records", itemName = "record" } = {}
) => {
  const rootTag = sanitizeXmlTag(rootName);
  const body = serializeXmlNode(rootTag, data, itemName, 0);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
};

/**
 * Trigger a browser file download from string content.
 * @param {string} content
 * @param {string} mimeType
 * @param {string} filename
 */
export const downloadFile = (content, mimeType, filename) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const exportToCSV = (
  rows,
  columns,
  filename = "export",
  options = {}
) => {
  const csv = buildCSV(rows, columns, options);
  downloadFile(
    csv,
    "text/csv;charset=utf-8;",
    buildExportFilename(filename, "csv")
  );
};

export const exportToJSON = (data, filename = "export") => {
  const json = JSON.stringify(data, null, 2);
  downloadFile(
    json,
    "application/json;charset=utf-8;",
    buildExportFilename(filename, "json")
  );
};

export const exportToXML = (
  data,
  { rootName = "records", itemName = "record", filename = "export" } = {}
) => {
  const xml = buildXML(data, { rootName, itemName });
  downloadFile(
    xml,
    "application/xml;charset=utf-8;",
    buildExportFilename(filename, "xml")
  );
};

/**
 * Unified export dispatcher supporting CSV, JSON, and XML.
 * Preserves all available fields across formats (sanitizing internal/sensitive keys).
 * @param {"csv"|"json"|"xml"} format
 * @param {{
 *   data: any,
 *   columns?: Array<{ key: string, label?: string, accessor?: (row: any) => any }>,
 *   filename?: string,
 *   rootName?: string,
 *   itemName?: string,
 *   includeAllFields?: boolean,
 *   prepareExport?: (rawData: any, format: string) => { rows?: any[], columns?: any[], structuredData?: any, includeAllFields?: boolean }
 * }} options
 */
export const exportData = (
  format,
  {
    data,
    columns,
    filename = "export",
    rootName = "records",
    itemName = "record",
    includeAllFields = true,
    prepareExport,
  } = {}
) => {
  const prepared =
    typeof prepareExport === "function" ? prepareExport(data, format) || {} : {};

  const activeColumns = prepared.columns ?? columns;
  const activeIncludeAll = prepared.includeAllFields ?? includeAllFields;
  const activeRows =
    prepared.rows ??
    (Array.isArray(data) ? data : data && typeof data === "object" ? [data] : []);

  if (format === "csv") {
    exportToCSV(activeRows, activeColumns, filename, {
      includeAllFields: activeIncludeAll,
    });
    return;
  }

  const rawStructured =
    prepared.structuredData !== undefined ? prepared.structuredData : data;
  const structuredData = sanitizeExportData(rawStructured);

  if (format === "json") {
    exportToJSON(structuredData, filename);
    return;
  }

  if (format === "xml") {
    exportToXML(structuredData, { rootName, itemName, filename });
    return;
  }

  throw new Error(`Unsupported export format: ${format}`);
};
