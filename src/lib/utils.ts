import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function downloadCsv(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn("No data to download.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers
        .map(fieldName => {
          let field = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];
          if (typeof field === 'string' && field.includes(',')) {
            field = `"${field}"`;
          }
          return field;
        })
        .join(',')
    )
  ];
  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
