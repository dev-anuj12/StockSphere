/**
 * Generates RFC 4180 compliant CSV string from an array of flat objects.
 */
export function jsonToCsv(data, columns) {
  if (!data || data.length === 0) {
    return columns.map(c => `"${c.label}"`).join(',') + '\r\n';
  }

  const header = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rows = data.map(item => {
    return columns
      .map(c => {
        let val = item[c.key];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'number') return val;
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  return [header, ...rows].join('\r\n');
}
