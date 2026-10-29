import React from "react";

const Table = ({ children, className = "" }) => {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200 bg-white ${className}`}>
      <table className="min-w-full divide-y divide-slate-200">{children}</table>
    </div>
  );
};

const TableHeader = ({ children, className = "" }) => {
  return <thead className={`bg-slate-50 ${className}`}>{children}</thead>;
};

const TableBody = ({ children, className = "" }) => {
  return <tbody className={`divide-y divide-slate-100 bg-white ${className}`}>{children}</tbody>;
};

const TableRow = ({ children, className = "" }) => {
  return <tr className={`transition hover:bg-slate-50 ${className}`}>{children}</tr>;
};

const TableHead = ({ children, className = "" }) => {
  return (
    <th className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-4 ${className}`}>
      {children}
    </th>
  );
};

const TableCell = ({ children, className = "" }) => {
  return <td className={`px-3 py-3 text-sm text-slate-700 sm:px-4 ${className}`}>{children}</td>;
};

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
export default Table;
