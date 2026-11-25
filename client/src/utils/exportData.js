/**
 * Client-side data export utilities for CSV, JSON, and XML formats.
 */

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
 * @param {Array<Record<string, any>>} rows
 * @param {Array<{ key: string, label?: string, accessor?: (row: any) => any }>} [columns]
 * @returns {string}
 */
export const buildCSV = (rows, columns) => {
  const list = Array.isArray(rows) ? rows : [];
  let resolvedColumns = columns;

  if (!Array.isArray(resolvedColumns) || resolvedColumns.length === 0) {
    const keys = new Set();
    for (const row of list) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        Object.keys(row).forEach((k) => keys.add(k));
      }
    }
    resolvedColumns = Array.from(keys).map((key) => ({ key, label: key }));
  }

  const headerLine = resolvedColumns
    .map((col) => formatCsvValue(col.label ?? col.key))
    .join(",");

  const dataLines = list.map((row) =>
    resolvedColumns
      .map((col) => formatCsvValue(resolveColumnValue(row, col)))
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

export const exportToCSV = (rows, columns, filename = "export") => {
  const csv = buildCSV(rows, columns);
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
 * @param {"csv"|"json"|"xml"} format
 * @param {{
 *   data: any,
 *   columns?: Array<{ key: string, label?: string, accessor?: (row: any) => any }>,
 *   filename?: string,
 *   rootName?: string,
 *   itemName?: string,
 *   prepareExport?: (rawData: any, format: string) => { rows?: any[], columns?: any[], structuredData?: any }
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
    prepareExport,
  } = {}
) => {
  const prepared =
    typeof prepareExport === "function" ? prepareExport(data, format) || {} : {};

  const activeColumns = prepared.columns ?? columns;
  const activeRows =
    prepared.rows ??
    (Array.isArray(data) ? data : data && typeof data === "object" ? [data] : []);

  if (format === "csv") {
    exportToCSV(activeRows, activeColumns, filename);
    return;
  }

  let structuredData;
  if (prepared.structuredData !== undefined) {
    structuredData = prepared.structuredData;
  } else if (Array.isArray(data)) {
    structuredData =
      Array.isArray(activeColumns) && activeColumns.length > 0
        ? mapRowsToColumns(data, activeColumns)
        : data;
  } else {
    structuredData = data;
  }

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
