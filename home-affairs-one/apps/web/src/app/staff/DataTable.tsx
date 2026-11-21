import type { ReactNode } from 'react';
import styles from './console.module.css';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Marks the column that names the row (a reference), so it is announced with each cell. */
  rowHeader?: boolean;
}

export interface DataTableProps<T> {
  /** Says what the table lists. Always shown. */
  caption: ReactNode;
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
}

/**
 * A real table on wide screens. Below 60rem the same rows are laid out as
 * stacked cards, each value beside its column heading (`console.module.css`),
 * so nothing needs sideways scrolling on a phone.
 */
export function DataTable<T>({ caption, columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) =>
                column.rowHeader ? (
                  <th key={column.header} scope="row" data-label={column.header}>
                    <div className={styles.cell}>{column.cell(row)}</div>
                  </th>
                ) : (
                  <td key={column.header} data-label={column.header}>
                    <div className={styles.cell}>{column.cell(row)}</div>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
