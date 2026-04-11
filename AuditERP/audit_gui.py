from __future__ import annotations

import csv
import io
import json
import queue
import re
import subprocess
import threading
import traceback
from datetime import datetime
from pathlib import Path

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk


SCHEMA_RE = re.compile(r"^[A-Z][A-Z0-9_$#]*$")
PATTERN_RE = re.compile(r"^[A-Z0-9_$#%]+$")
TABLE_RE = re.compile(r"^[A-Z][A-Z0-9_$#]*$")
PRELOADED_TABLES_FILE = Path(__file__).with_name("business_tables_91.txt")
FORBIDDEN_WHERE_TOKENS = {
    "insert",
    "update",
    "delete",
    "merge",
    "drop",
    "alter",
    "create",
    "truncate",
    "commit",
    "rollback",
    "begin",
    "declare",
    "grant",
    "revoke",
}


def parse_schemas(raw: str) -> list[str]:
    if not raw.strip():
        return []
    schemas = []
    for part in raw.split(","):
        value = part.strip().upper()
        if not value:
            continue
        if not SCHEMA_RE.match(value):
            raise ValueError(f"Esquema inválido: {value}")
        schemas.append(value)
    return sorted(set(schemas))


def parse_patterns(raw: str) -> list[str]:
    defaults = ["FACTURA%", "PEDIDO%"]
    if not raw.strip():
        return defaults
    patterns = []
    for part in raw.split(","):
        value = part.strip().upper()
        if not value:
            continue
        if not PATTERN_RE.match(value):
            raise ValueError(f"Patrón inválido: {value}")
        patterns.append(value)
    return sorted(set(patterns)) or defaults


def parse_table_names(raw: str) -> list[str]:
    if not raw.strip():
        return []
    names = []
    for part in raw.split(","):
        value = part.strip().upper()
        if not value:
            continue
        if not TABLE_RE.match(value):
            raise ValueError(f"Tabla invalida: {value}")
        names.append(value)
    return sorted(set(names))


def normalize_table_names(values: list[str]) -> list[str]:
    names = []
    for raw in values:
        value = (raw or "").strip().upper()
        if not value:
            continue
        if not TABLE_RE.match(value):
            raise ValueError(f"Tabla invalida: {value}")
        names.append(value)
    return sorted(set(names))


def build_in_condition(column: str, values: list[str], chunk_size: int = 900) -> str:
    if not values:
        return "1=1"
    chunks = []
    for i in range(0, len(values), chunk_size):
        group = values[i : i + chunk_size]
        chunks.append(f"{column} in ({sql_in(group)})")
    return "(" + " or ".join(chunks) + ")"


def load_preloaded_tables(path: Path = PRELOADED_TABLES_FILE) -> list[str]:
    if not path.exists():
        return []
    values: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        values.append(line)
    return normalize_table_names(values)


def choose_default_business_table(tables: list[str]) -> str:
    if not tables:
        return ""
    preferred = [
        "VEN_VENTAS",
        "COM_TMPCOMPRAS",
        "COM_DETORDCP",
        "VEN_DETAFACT",
        "SRI_LOGFACTU",
    ]
    existing = set(tables)
    for name in preferred:
        if name in existing:
            return name
    return tables[0]


def sanitize_where_clause(raw: str) -> str:
    clause = raw.strip()
    if not clause:
        return ""
    if ";" in clause:
        raise ValueError("El filtro WHERE no puede incluir ';'.")
    low = clause.lower()
    for token in FORBIDDEN_WHERE_TOKENS:
        if re.search(rf"\b{token}\b", low):
            raise ValueError(f"Token no permitido en WHERE: {token}")
    return clause


def choose_display_columns(columns: list[str], numbers_only: bool) -> tuple[list[str], str]:
    cols = [c.upper() for c in columns]
    num_cols = [c for c in cols if any(k in c for k in ("NUM", "NRO", "PED", "ORD", "FACT", "DOC", "ID"))]
    date_cols = [c for c in cols if any(k in c for k in ("FECH", "DATE", "TIMESTAMP", "FEC"))]
    state_cols = [c for c in cols if any(k in c for k in ("EST", "STAT", "TIP", "ANUL"))]
    amount_cols = [c for c in cols if any(k in c for k in ("TOTAL", "VALOR", "MONTO", "IMPORTE", "SUBTOT"))]
    party_cols = [c for c in cols if any(k in c for k in ("CLIENT", "PROVE", "NOMBRE", "RUC", "CEDULA"))]

    selected: list[str] = []
    groups = [num_cols, date_cols]
    if not numbers_only:
        groups.extend([state_cols, amount_cols, party_cols])
    for g in groups:
        for c in g[:3]:
            if c not in selected:
                selected.append(c)
    if not selected:
        selected = cols[:8] if not numbers_only else cols[:3]

    order_parts = []
    if date_cols:
        order_parts.append(f"{date_cols[0]} desc nulls last")
    if num_cols and num_cols[0] not in date_cols:
        order_parts.append(f"{num_cols[0]} desc nulls last")
    if not order_parts and cols:
        order_parts.append(f"{cols[0]} desc")
    order_by = ", ".join(order_parts) if order_parts else "1"
    return selected, order_by


def qualify_order_by(order_by: str, table_alias: str = "c") -> str:
    parts = []
    for raw in order_by.split(","):
        item = raw.strip()
        if not item:
            continue
        m = re.match(r"^([A-Z][A-Z0-9_$#]*)(.*)$", item)
        if m:
            parts.append(f"{table_alias}.{m.group(1)}{m.group(2)}")
        else:
            parts.append(item)
    return ", ".join(parts) if parts else "1"


def choose_natural_label_columns(columns: list[str]) -> list[str]:
    cols = [c.upper() for c in columns]
    high = [
        "NOMBRE",
        "NOMBR",
        "DESCRIP",
        "DETALLE",
        "RAZON",
        "CLIENT",
        "PROVE",
        "APELL",
        "EMAIL",
        "ESTADO",
        "TIPO",
    ]
    medium = ["CODIGO", "COD", "NUM", "RUC", "CED", "SIGLA"]

    selected: list[str] = []
    for token in high:
        for c in cols:
            if token in c and c not in selected:
                selected.append(c)
    if len(selected) < 2:
        for token in medium:
            for c in cols:
                if token in c and c not in selected:
                    selected.append(c)
                    if len(selected) >= 2:
                        break
            if len(selected) >= 2:
                break
    if not selected and cols:
        selected = cols[:1]
    return selected[:2]


def humanize_col(name: str) -> str:
    return name.replace("_", " ").strip().capitalize()


def sql_in(values: list[str]) -> str:
    return ", ".join([f"'{v}'" for v in values])


def like_clause(col: str, patterns: list[str]) -> str:
    return " or ".join([f"{col} like '{p}'" for p in patterns])


def mask_conn(conn: str) -> str:
    if "/" not in conn:
        return conn
    user, rest = conn.split("/", 1)
    if "@" not in rest:
        return f"{user}/***"
    _, target = rest.split("@", 1)
    return f"{user}/***@{target}"


def write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        if headers:
            w.writeheader()
        w.writerows(rows)


class SqlPlus:
    def __init__(self, exe: str, timeout: int = 600) -> None:
        self.exe = exe
        self.timeout = timeout

    def query(self, conn: str, sql: str) -> tuple[list[str], list[dict[str, str]], list[str], str]:
        script = (
            "set pagesize 0 feedback off verify off heading on echo off termout off\n"
            "set trimspool on linesize 32767\n"
            "set markup csv on quote on\n"
            f"{sql.strip().rstrip(';')};\n"
            "exit\n"
        )
        cp = subprocess.run(
            [self.exe, "-S", conn],
            input=script,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=self.timeout,
            check=False,
        )
        output = f"{cp.stdout}\n{cp.stderr}".strip()
        warnings = []
        csv_lines = []
        started = False
        for raw in output.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line == "ERROR:" or line.startswith("ORA-") or line.startswith("SP2-"):
                warnings.append(line)
                if started:
                    break
                continue
            if not started and line.startswith('"') and line.endswith('"'):
                started = True
                csv_lines.append(line)
                continue
            if started:
                csv_lines.append(line)

        if not csv_lines:
            non_benign = [
                w
                for w in warnings
                if w != "ERROR:"
                and not w.startswith("ORA-04045")
                and not w.startswith("ORA-01031")
            ]
            if non_benign:
                raise RuntimeError("sqlplus no devolvió CSV utilizable.\n" + output)
            return [], [], warnings, output

        reader = csv.DictReader(io.StringIO("\n".join(csv_lines)))
        headers = reader.fieldnames or []
        rows = []
        for r in reader:
            row = {}
            for k, v in r.items():
                if k is None:
                    continue
                if isinstance(v, list):
                    row[k] = ",".join([str(x).strip() for x in v])
                else:
                    row[k] = (v or "").strip()
            rows.append(row)
        return headers, rows, warnings, output


class Auditor:
    def __init__(self, sqlplus: SqlPlus, conn: str, log) -> None:
        self.sqlplus = sqlplus
        self.conn = conn
        self.log = log

    def test(self) -> tuple[dict[str, str], list[str]]:
        _, rows, warnings, _ = self.sqlplus.query(
            self.conn,
            """
            select
                sys_context('USERENV','DB_NAME') as db_name,
                sys_context('USERENV','CON_NAME') as con_name,
                sys_context('USERENV','SERVICE_NAME') as service_name,
                user as current_user
            from dual
            """,
        )
        return (rows[0] if rows else {}), warnings

    def run(
        self,
        output_base: str,
        schema_filter: str,
        pattern_filter: str,
        include_counts: bool,
        cancel: threading.Event,
        explicit_tables: list[str] | None = None,
    ) -> dict:
        out = Path(output_base).resolve() / f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        out.mkdir(parents=True, exist_ok=True)
        warnings: set[str] = set()
        files: list[str] = []

        def stop() -> None:
            if cancel.is_set():
                raise RuntimeError("Proceso cancelado por el usuario.")

        def run_save(name: str, filename: str, sql: str) -> tuple[list[str], list[dict[str, str]]]:
            stop()
            self.log(f"Ejecutando: {name}")
            headers, rows, warns, _ = self.sqlplus.query(self.conn, sql)
            warnings.update(warns)
            write_csv(out / filename, headers, rows)
            files.append(filename)
            self.log(f"{name}: {len(rows)} fila(s)")
            return headers, rows

        _, ctx_rows = run_save(
            "Contexto DB",
            "01_db_context.csv",
            """
            select
                sys_context('USERENV','DB_NAME') as db_name,
                sys_context('USERENV','CON_NAME') as con_name,
                sys_context('USERENV','SERVICE_NAME') as service_name,
                user as current_user,
                to_char(systimestamp,'YYYY-MM-DD HH24:MI:SS.FF3 TZH:TZM') as db_time
            from dual
            """,
        )

        _, user_rows = run_save(
            "Usuarios no Oracle maintained",
            "02_non_oracle_users.csv",
            """
            select username, account_status, to_char(created,'YYYY-MM-DD HH24:MI:SS') as created
            from dba_users
            where oracle_maintained='N'
            order by username
            """,
        )

        schemas = parse_schemas(schema_filter)
        if not schemas:
            schemas = sorted({r.get("USERNAME", "").upper() for r in user_rows if r.get("USERNAME")})
        if not schemas:
            cu = (ctx_rows[0].get("CURRENT_USER", "SYSTEM") if ctx_rows else "SYSTEM").upper()
            schemas = [cu]
        self.log("Esquemas objetivo: " + ", ".join(schemas))
        write_csv(out / "03_target_schemas.csv", ["SCHEMA_NAME"], [{"SCHEMA_NAME": s} for s in schemas])
        files.append("03_target_schemas.csv")

        target_tables = normalize_table_names(explicit_tables or [])
        if target_tables:
            self.log(f"Filtro de tablas explicitas: {len(target_tables)}")
            write_csv(
                out / "03_target_tables.csv",
                ["TABLE_NAME"],
                [{"TABLE_NAME": t} for t in target_tables],
            )
            files.append("03_target_tables.csv")

        owners = sql_in(schemas)
        if target_tables and not pattern_filter.strip():
            patterns = ["%"]
        else:
            patterns = parse_patterns(pattern_filter)
        pwhere = like_clause("upper(table_name)", patterns)
        table_where = build_in_condition("table_name", target_tables)
        table_where_c = build_in_condition("c.table_name", target_tables)
        table_where_r = build_in_condition("r.table_name", target_tables)

        _, tables_rows = run_save(
            "Tablas",
            "04_tables.csv",
            f"""
            select owner, table_name, tablespace_name, num_rows,
                   to_char(last_analyzed,'YYYY-MM-DD HH24:MI:SS') as last_analyzed
            from dba_tables
            where owner in ({owners})
              and {table_where}
            order by owner, table_name
            """,
        )

        _, columns_rows = run_save(
            "Columnas",
            "05_columns.csv",
            f"""
            select owner, table_name, column_id, column_name, data_type, data_length,
                   data_precision, data_scale, nullable
            from dba_tab_columns
            where owner in ({owners})
              and {table_where}
            order by owner, table_name, column_id
            """,
        )

        _, pk_rows = run_save(
            "Llaves primarias",
            "06_pk_columns.csv",
            f"""
            select c.owner, c.table_name, c.constraint_name, cc.position, cc.column_name
            from dba_constraints c
            join dba_cons_columns cc on cc.owner=c.owner and cc.constraint_name=c.constraint_name
            where c.constraint_type='P'
              and c.owner in ({owners})
              and {table_where_c}
            order by c.owner, c.table_name, c.constraint_name, cc.position
            """,
        )

        _, fk_rows = run_save(
            "Mapa FK",
            "07_fk_map.csv",
            f"""
            select c.owner as child_owner, c.table_name as child_table, c.constraint_name as fk_name,
                   cc.position, cc.column_name as child_column,
                   r.owner as parent_owner, r.table_name as parent_table, rc.column_name as parent_column,
                   c.delete_rule, c.status
            from dba_constraints c
            join dba_cons_columns cc on cc.owner=c.owner and cc.constraint_name=c.constraint_name
            join dba_constraints r on r.owner=c.r_owner and r.constraint_name=c.r_constraint_name
            join dba_cons_columns rc on rc.owner=r.owner and rc.constraint_name=r.constraint_name and rc.position=cc.position
            where c.constraint_type='R'
              and (
                   (c.owner in ({owners}) and {table_where_c})
                or (r.owner in ({owners}) and {table_where_r})
              )
            order by c.owner, c.table_name, c.constraint_name, cc.position
            """,
        )

        _, invalid_rows = run_save(
            "Objetos inválidos",
            "08_invalid_objects.csv",
            f"""
            select owner, object_type, object_name, status,
                   to_char(created,'YYYY-MM-DD HH24:MI:SS') as created,
                   to_char(last_ddl_time,'YYYY-MM-DD HH24:MI:SS') as last_ddl_time
            from dba_objects
            where status<>'VALID' and owner in ({owners})
            order by owner, object_type, object_name
            """,
        )

        _, err_rows = run_save(
            "Errores compilación",
            "09_dba_errors.csv",
            f"""
            select owner, name, type, line, position, text
            from dba_errors
            where owner in ({owners})
            order by owner, name, sequence
            """,
        )

        fp_title = "Tablas objetivo por patrón" if target_tables else "Tablas Factura/Pedido"
        fp_file = "10_target_pattern_tables.csv" if target_tables else "10_factura_pedido_tables.csv"
        _, fp_rows = run_save(
            fp_title,
            fp_file,
            f"""
            select owner, table_name
            from dba_tables
            where owner in ({owners})
              and ({pwhere})
              and {table_where}
            order by owner, table_name
            """,
        )

        fp_fk_title = "FK tablas objetivo por patrón" if target_tables else "FK Factura/Pedido"
        fp_fk_file = "11_target_pattern_fk.csv" if target_tables else "11_factura_pedido_fk.csv"
        _, fp_fk_rows = run_save(
            fp_fk_title,
            fp_fk_file,
            f"""
            select c.owner as child_owner, c.table_name as child_table, c.constraint_name as fk_name,
                   cc.position, cc.column_name as child_column,
                   r.owner as parent_owner, r.table_name as parent_table, rc.column_name as parent_column
            from dba_constraints c
            join dba_cons_columns cc on cc.owner=c.owner and cc.constraint_name=c.constraint_name
            join dba_constraints r on r.owner=c.r_owner and r.constraint_name=c.r_constraint_name
            join dba_cons_columns rc on rc.owner=r.owner and rc.constraint_name=r.constraint_name and rc.position=cc.position
            where c.constraint_type='R'
              and (
                   (c.owner in ({owners}) and ({like_clause('upper(c.table_name)', patterns)}) and {table_where_c})
                or (r.owner in ({owners}) and ({like_clause('upper(r.table_name)', patterns)}) and {table_where_r})
              )
            order by c.owner, c.table_name, c.constraint_name, cc.position
            """,
        )

        count_rows = []
        count_source = fp_rows
        count_file = "12_factura_pedido_row_counts.csv"
        if target_tables:
            count_source = tables_rows
            count_file = "12_target_table_row_counts.csv"

        if include_counts and count_source:
            for i, row in enumerate(count_source, start=1):
                stop()
                owner = row["OWNER"].upper()
                table = row["TABLE_NAME"].upper()
                if not SCHEMA_RE.match(owner) or not SCHEMA_RE.match(table):
                    continue
                self.log(f"[{i}/{len(count_source)}] COUNT(*) {owner}.{table}")
                h, r, warns, _ = self.sqlplus.query(
                    self.conn, f"select count(*) as row_count from {owner}.{table}"
                )
                _ = h
                warnings.update(warns)
                count_rows.append({"OWNER": owner, "TABLE_NAME": table, "ROW_COUNT": r[0]["ROW_COUNT"] if r else ""})
            write_csv(out / count_file, ["OWNER", "TABLE_NAME", "ROW_COUNT"], count_rows)
            files.append(count_file)

        summary = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "output_dir": str(out),
            "connection": mask_conn(self.conn),
            "schemas": schemas,
            "patterns": patterns,
            "target_tables": target_tables,
            "counts": {
                "tables": len(tables_rows),
                "columns": len(columns_rows),
                "pk_columns": len(pk_rows),
                "fk_map": len(fk_rows),
                "invalid_objects": len(invalid_rows),
                "dba_errors": len(err_rows),
                "target_tables_loaded": len(target_tables),
                "factura_pedido_tables": len(fp_rows),
                "factura_pedido_fk": len(fp_fk_rows),
                "row_counts": len(count_rows),
            },
            "warnings": sorted(warnings),
            "files": files,
        }
        (out / "audit_summary.json").write_text(
            json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        md = [
            "# Reporte de Auditoría Oracle",
            f"- Fecha: `{summary['generated_at']}`",
            f"- Conexión: `{summary['connection']}`",
            f"- Esquemas: `{', '.join(schemas)}`",
            f"- Salida: `{out}`",
            "",
            "## Conteos",
        ]
        for k, v in summary["counts"].items():
            md.append(f"- {k}: **{v}**")
        md.append("")
        md.append("## Advertencias")
        if summary["warnings"]:
            for w in summary["warnings"]:
                md.append(f"- `{w}`")
        else:
            md.append("- Sin advertencias")
        (out / "audit_report.md").write_text("\n".join(md), encoding="utf-8")
        return summary


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("AuditERP - Auditoría Oracle")
        self.geometry("1050x680")
        self.minsize(900, 580)

        try:
            self.preloaded_tables = load_preloaded_tables()
        except Exception:
            self.preloaded_tables = []
        self.use_preloaded_var = tk.BooleanVar(value=bool(self.preloaded_tables))

        self.conn_var = tk.StringVar(value="SYSTEM/FamDb@XE")
        self.sqlplus_var = tk.StringVar(value="sqlplus")
        self.schemas_var = tk.StringVar(value="SYSTEM")
        self.patterns_var = tk.StringVar(value="%")
        self.output_var = tk.StringVar(value=str((Path.cwd() / "reports").resolve()))
        self.counts_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Listo.")

        default_table = choose_default_business_table(self.preloaded_tables)
        self.query_owner_var = tk.StringVar(value="SYSTEM")
        self.query_table_var = tk.StringVar(value=default_table)
        self.query_limit_var = tk.StringVar(value="30")
        self.query_where_var = tk.StringVar(value="")
        self.last_query_headers: list[str] = []
        self.last_query_rows: list[dict[str, str]] = []
        self.last_query_sql = ""
        self.last_query_title = ""

        self.queue: queue.Queue[tuple] = queue.Queue()
        self.worker: threading.Thread | None = None
        self.cancel_event = threading.Event()

        self._ui()
        self.after(120, self._poll)

    def _ui(self) -> None:
        root = ttk.Frame(self, padding=12)
        root.pack(fill="both", expand=True)

        lf1 = ttk.LabelFrame(root, text="Conexión")
        lf1.pack(fill="x")
        ttk.Label(lf1, text="Cadena SQL*Plus").grid(row=0, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lf1, textvariable=self.conn_var, width=76).grid(row=0, column=1, padx=8, pady=6, sticky="ew")
        ttk.Label(lf1, text="Ejecutable").grid(row=1, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lf1, textvariable=self.sqlplus_var, width=20).grid(row=1, column=1, padx=8, pady=6, sticky="w")
        self.btn_test = ttk.Button(lf1, text="Probar conexión", command=self.test_conn)
        self.btn_test.grid(row=0, column=2, rowspan=2, padx=8, pady=6, sticky="ns")
        lf1.columnconfigure(1, weight=1)

        lf2 = ttk.LabelFrame(root, text="Auditoría")
        lf2.pack(fill="x", pady=(8, 0))
        ttk.Label(lf2, text="Esquemas (coma)").grid(row=0, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lf2, textvariable=self.schemas_var).grid(row=0, column=1, padx=8, pady=6, sticky="ew")
        ttk.Label(lf2, text="Patrones tablas").grid(row=1, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lf2, textvariable=self.patterns_var).grid(row=1, column=1, padx=8, pady=6, sticky="ew")
        ttk.Label(lf2, text="Salida").grid(row=2, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lf2, textvariable=self.output_var).grid(row=2, column=1, padx=8, pady=6, sticky="ew")
        ttk.Button(lf2, text="Examinar", command=self.pick_out).grid(row=2, column=2, padx=8, pady=6)
        ttk.Checkbutton(lf2, text="Incluir COUNT(*) tablas objetivo", variable=self.counts_var).grid(
            row=3, column=1, padx=8, pady=6, sticky="w"
        )
        ttk.Checkbutton(
            lf2,
            text=f"Usar tablas negocio precargadas ({len(self.preloaded_tables)})",
            variable=self.use_preloaded_var,
        ).grid(row=4, column=1, padx=8, pady=6, sticky="w")
        ttk.Button(lf2, text="Ver lista", command=self.show_preloaded_tables).grid(
            row=4, column=2, padx=8, pady=6
        )
        lf2.columnconfigure(1, weight=1)

        lfq = ttk.LabelFrame(root, text="Consultas negocio (registros)")
        lfq.pack(fill="x", pady=(8, 0))
        ttk.Label(lfq, text="Esquema").grid(row=0, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lfq, textvariable=self.query_owner_var, width=14).grid(
            row=0, column=1, padx=8, pady=6, sticky="w"
        )
        ttk.Label(lfq, text="Tabla").grid(row=0, column=2, padx=8, pady=6, sticky="w")
        self.cmb_query_table = ttk.Combobox(
            lfq,
            textvariable=self.query_table_var,
            values=self.preloaded_tables,
            width=36,
        )
        self.cmb_query_table.grid(row=0, column=3, padx=8, pady=6, sticky="w")
        ttk.Label(lfq, text="Limite").grid(row=0, column=4, padx=8, pady=6, sticky="w")
        ttk.Entry(lfq, textvariable=self.query_limit_var, width=8).grid(
            row=0, column=5, padx=8, pady=6, sticky="w"
        )

        ttk.Label(lfq, text="Filtro WHERE (opcional)").grid(row=1, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lfq, textvariable=self.query_where_var).grid(
            row=1, column=1, columnspan=5, padx=8, pady=6, sticky="ew"
        )
        lfq.columnconfigure(3, weight=1)

        query_actions = ttk.Frame(lfq)
        query_actions.grid(row=2, column=0, columnspan=6, padx=8, pady=(0, 6), sticky="w")
        self.btn_query_latest = ttk.Button(
            query_actions,
            text="Ultimos registros",
            command=self.query_latest_records,
        )
        self.btn_query_latest.pack(side="left")
        self.btn_query_numbers = ttk.Button(
            query_actions,
            text="Ultimos numeros pedidos",
            command=self.query_latest_numbers,
        )
        self.btn_query_numbers.pack(side="left", padx=(8, 0))
        self.btn_query_natural = ttk.Button(
            query_actions,
            text="Vista natural",
            command=self.query_natural_records,
        )
        self.btn_query_natural.pack(side="left", padx=(8, 0))
        self.btn_query_export = ttk.Button(
            query_actions,
            text="Exportar resultado",
            command=self.export_last_query,
            state="disabled",
        )
        self.btn_query_export.pack(side="left", padx=(8, 0))

        self.query_result = scrolledtext.ScrolledText(lfq, wrap="none", height=10)
        self.query_result.grid(row=3, column=0, columnspan=6, padx=8, pady=(0, 8), sticky="nsew")
        self.query_result.configure(state="disabled")
        lfq.rowconfigure(3, weight=1)

        actions = ttk.Frame(root)
        actions.pack(fill="x", pady=(8, 0))
        self.btn_run = ttk.Button(actions, text="Iniciar auditoría", command=self.run_audit)
        self.btn_run.pack(side="left")
        self.btn_cancel = ttk.Button(actions, text="Cancelar", command=self.cancel, state="disabled")
        self.btn_cancel.pack(side="left", padx=(8, 0))
        self.pb = ttk.Progressbar(actions, mode="indeterminate", length=240)
        self.pb.pack(side="right")

        ttk.Label(root, textvariable=self.status_var).pack(fill="x", pady=(6, 0))
        lf3 = ttk.LabelFrame(root, text="Bitácora")
        lf3.pack(fill="both", expand=True, pady=(8, 0))
        self.log = scrolledtext.ScrolledText(lf3, wrap="word")
        self.log.pack(fill="both", expand=True, padx=8, pady=8)
        self.log.configure(state="disabled")

    def pick_out(self) -> None:
        d = filedialog.askdirectory(initialdir=self.output_var.get() or str(Path.cwd()))
        if d:
            self.output_var.set(d)

    def show_preloaded_tables(self) -> None:
        if not self.preloaded_tables:
            messagebox.showwarning("Tablas precargadas", "No existe business_tables_91.txt")
            return
        win = tk.Toplevel(self)
        win.title(f"Tablas precargadas ({len(self.preloaded_tables)})")
        win.geometry("520x640")
        txt = scrolledtext.ScrolledText(win, wrap="none")
        txt.pack(fill="both", expand=True, padx=8, pady=8)
        txt.insert("end", "\n".join(self.preloaded_tables))
        txt.configure(state="disabled")

    def _validate_query_inputs(self) -> tuple[str, str, int, str]:
        owner = self.query_owner_var.get().strip().upper()
        table = self.query_table_var.get().strip().upper()
        if not TABLE_RE.match(owner):
            raise ValueError(f"Esquema invalido: {owner}")
        if not TABLE_RE.match(table):
            raise ValueError(f"Tabla invalida: {table}")

        try:
            limit = int(self.query_limit_var.get().strip())
        except Exception:
            raise ValueError("Limite invalido. Debe ser numero entero.")
        if limit < 1 or limit > 5000:
            raise ValueError("Limite fuera de rango (1..5000).")

        where_clause = sanitize_where_clause(self.query_where_var.get())
        return owner, table, limit, where_clause

    def _build_latest_query(
        self,
        sqlplus: SqlPlus,
        conn: str,
        owner: str,
        table: str,
        limit: int,
        where_clause: str,
        numbers_only: bool,
    ) -> tuple[str, list[str]]:
        _, col_rows, _, _ = sqlplus.query(
            conn,
            f"""
            select column_name
            from dba_tab_columns
            where owner='{owner}' and table_name='{table}'
            order by column_id
            """,
        )
        columns = [r.get("COLUMN_NAME", "").upper() for r in col_rows if r.get("COLUMN_NAME")]
        if not columns:
            raise RuntimeError(f"No se encontraron columnas para {owner}.{table}")

        selected, order_by = choose_display_columns(columns, numbers_only=numbers_only)
        where_sql = f" where {where_clause}" if where_clause else ""
        sql = (
            f"select {', '.join(selected)} "
            f"from {owner}.{table}"
            f"{where_sql} "
            f"order by {order_by} "
            f"fetch first {limit} rows only"
        )
        return sql, selected

    def _make_alias(self, prefix: str, column: str, used: set[str]) -> str:
        base = re.sub(r"[^A-Z0-9_]", "_", column.upper()).strip("_") or "VALOR"
        alias = f"{prefix}_{base[:20]}"
        if len(alias) > 28:
            alias = alias[:28]
        n = 1
        while alias in used:
            suffix = f"_{n}"
            alias = f"{prefix}_{base[:20-len(suffix)]}{suffix}"
            if len(alias) > 28:
                alias = alias[:28]
            n += 1
        used.add(alias)
        return alias

    def _build_natural_query(
        self,
        sqlplus: SqlPlus,
        conn: str,
        owner: str,
        table: str,
        limit: int,
        where_clause: str,
    ) -> tuple[str, list[str]]:
        _, col_rows, _, _ = sqlplus.query(
            conn,
            f"""
            select column_name
            from dba_tab_columns
            where owner='{owner}' and table_name='{table}'
            order by column_id
            """,
        )
        child_columns = [r.get("COLUMN_NAME", "").upper() for r in col_rows if r.get("COLUMN_NAME")]
        if not child_columns:
            raise RuntimeError(f"No se encontraron columnas para {owner}.{table}")

        selected, order_by = choose_display_columns(child_columns, numbers_only=False)
        order_by = qualify_order_by(order_by, table_alias="c")
        select_expr = [f"c.{c} as {c}" for c in selected]
        used_alias = set(selected)

        _, fk_rows, _, _ = sqlplus.query(
            conn,
            f"""
            select
                c.constraint_name,
                cc.position,
                cc.column_name as child_column,
                r.owner as parent_owner,
                r.table_name as parent_table,
                rc.column_name as parent_column
            from dba_constraints c
            join dba_cons_columns cc
              on cc.owner = c.owner and cc.constraint_name = c.constraint_name
            join dba_constraints r
              on r.owner = c.r_owner and r.constraint_name = c.r_constraint_name
            join dba_cons_columns rc
              on rc.owner = r.owner and rc.constraint_name = r.constraint_name and rc.position = cc.position
            where c.constraint_type = 'R'
              and c.owner = '{owner}'
              and c.table_name = '{table}'
            order by c.constraint_name, cc.position
            """,
        )

        grouped: dict[tuple[str, str, str], list[tuple[int, str, str]]] = {}
        for r in fk_rows:
            key = (
                (r.get("CONSTRAINT_NAME") or "").upper(),
                (r.get("PARENT_OWNER") or "").upper(),
                (r.get("PARENT_TABLE") or "").upper(),
            )
            pos = int((r.get("POSITION") or "0").strip() or "0")
            grouped.setdefault(key, []).append(
                (
                    pos,
                    (r.get("CHILD_COLUMN") or "").upper(),
                    (r.get("PARENT_COLUMN") or "").upper(),
                )
            )

        joins: list[str] = []
        parent_cols_cache: dict[tuple[str, str], list[str]] = {}
        join_count = 0

        for (_fk, parent_owner, parent_table), cols in grouped.items():
            if join_count >= 8:
                break
            if not TABLE_RE.match(parent_owner) or not TABLE_RE.match(parent_table):
                continue
            if not all(TABLE_RE.match(c) and TABLE_RE.match(p) for _, c, p in cols):
                continue

            pkey = (parent_owner, parent_table)
            if pkey not in parent_cols_cache:
                _, pcols_rows, _, _ = sqlplus.query(
                    conn,
                    f"""
                    select column_name
                    from dba_tab_columns
                    where owner='{parent_owner}' and table_name='{parent_table}'
                    order by column_id
                    """,
                )
                parent_cols_cache[pkey] = [
                    r.get("COLUMN_NAME", "").upper() for r in pcols_rows if r.get("COLUMN_NAME")
                ]
            parent_cols = parent_cols_cache[pkey]
            label_cols = choose_natural_label_columns(parent_cols)
            if not label_cols:
                continue

            alias = f"p{join_count + 1}"
            sorted_cols = sorted(cols, key=lambda x: x[0])
            join_pred = " and ".join([f"{alias}.{pcol} = c.{ccol}" for _, ccol, pcol in sorted_cols])
            joins.append(f"left join {parent_owner}.{parent_table} {alias} on {join_pred}")

            for lc in label_cols:
                out_alias = self._make_alias(f"REF{join_count + 1}", lc, used_alias)
                select_expr.append(f"{alias}.{lc} as {out_alias}")
            join_count += 1

        where_sql = f" where {where_clause}" if where_clause else ""
        sql = (
            f"select {', '.join(select_expr)} "
            f"from {owner}.{table} c "
            f"{' '.join(joins)}"
            f"{where_sql} "
            f"order by {order_by} "
            f"fetch first {limit} rows only"
        )
        headers = [expr.split(" as ")[-1].strip() for expr in select_expr]
        return sql, headers

    def _rows_to_csv_text(self, headers: list[str], rows: list[dict[str, str]], max_rows: int = 200) -> str:
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=headers)
        if headers:
            writer.writeheader()
        for row in rows[:max_rows]:
            writer.writerow({h: row.get(h, "") for h in headers})
        if len(rows) > max_rows:
            out.write(f"# ... {len(rows) - max_rows} fila(s) adicionales no mostradas\\n")
        return out.getvalue()

    def _rows_to_natural_text(self, headers: list[str], rows: list[dict[str, str]], max_rows: int = 40) -> str:
        if not rows:
            return "Sin registros."

        def score(h: str) -> int:
            col = h.upper()
            points = 0
            if col.startswith("REF"):
                points -= 15
            if any(k in col for k in ("NUM", "NRO", "PED", "ORD", "FACT", "DOC")):
                points += 40
            if any(k in col for k in ("FECH", "DATE", "TIMESTAMP")):
                points += 35
            if any(k in col for k in ("TOTAL", "VALOR", "MONTO", "IMPORTE")):
                points += 30
            if any(k in col for k in ("NOMBRE", "DESCRIP", "CLIENT", "PROVE", "RAZON")):
                points += 25
            return points

        ordered_headers = sorted(headers, key=lambda h: score(h), reverse=True)
        lines = []
        for idx, row in enumerate(rows[:max_rows], start=1):
            parts = []
            for h in ordered_headers:
                value = (row.get(h) or "").strip()
                if not value:
                    continue
                parts.append(f"{humanize_col(h)}: {value}")
                if len(parts) >= 6:
                    break
            if not parts:
                parts = ["Sin valores visibles"]
            lines.append(f"{idx}. " + " | ".join(parts))
        if len(rows) > max_rows:
            lines.append(f"... {len(rows) - max_rows} fila(s) adicionales no mostradas")
        return "\n".join(lines)

    def _set_query_result_text(self, text: str) -> None:
        self.query_result.configure(state="normal")
        self.query_result.delete("1.0", "end")
        self.query_result.insert("end", text)
        self.query_result.configure(state="disabled")

    def query_latest_records(self) -> None:
        self._start_business_query(numbers_only=False, natural_mode=False)

    def query_latest_numbers(self) -> None:
        self._start_business_query(numbers_only=True, natural_mode=False)

    def query_natural_records(self) -> None:
        self._start_business_query(numbers_only=False, natural_mode=True)

    def _start_business_query(self, numbers_only: bool, natural_mode: bool) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showwarning("Proceso en curso", "Espera a que termine el proceso actual.")
            return
        try:
            owner, table, limit, where_clause = self._validate_query_inputs()
        except Exception as exc:
            messagebox.showerror("Validacion", str(exc))
            return

        if natural_mode:
            mode_name = "vista natural"
        else:
            mode_name = "ultimos numeros" if numbers_only else "ultimos registros"
        self.set_busy(True)
        self.status_var.set(f"Consultando {mode_name}...")
        self._set_query_result_text("")
        self.append_log(f"Consulta {mode_name}: {owner}.{table} limite={limit}")

        def w() -> None:
            try:
                sqlplus = SqlPlus(self.sqlplus_var.get().strip())
                conn = self.conn_var.get().strip()
                if natural_mode:
                    sql, selected_cols = self._build_natural_query(
                        sqlplus=sqlplus,
                        conn=conn,
                        owner=owner,
                        table=table,
                        limit=limit,
                        where_clause=where_clause,
                    )
                else:
                    sql, selected_cols = self._build_latest_query(
                        sqlplus=sqlplus,
                        conn=conn,
                        owner=owner,
                        table=table,
                        limit=limit,
                        where_clause=where_clause,
                        numbers_only=numbers_only,
                    )
                headers, rows, warns, _ = sqlplus.query(conn, sql)
                payload = {
                    "title": f"{mode_name} - {owner}.{table}",
                    "sql": sql,
                    "selected_cols": selected_cols,
                    "headers": headers,
                    "rows": rows,
                    "warnings": warns,
                    "natural_mode": natural_mode,
                }
                self.queue.put(("query_ok", payload))
            except Exception as exc:
                self.queue.put(("err", str(exc), traceback.format_exc()))

        self.worker = threading.Thread(target=w, daemon=True)
        self.worker.start()

    def export_last_query(self) -> None:
        if not self.last_query_headers:
            messagebox.showwarning("Exportar", "No hay resultado de consulta para exportar.")
            return
        suggested = f"consulta_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        path = filedialog.asksaveasfilename(
            title="Guardar resultado de consulta",
            defaultextension=".csv",
            filetypes=[("CSV", "*.csv"), ("Todos", "*.*")],
            initialfile=suggested,
        )
        if not path:
            return
        with Path(path).open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=self.last_query_headers)
            w.writeheader()
            w.writerows(self.last_query_rows)
        self.append_log(f"Resultado de consulta exportado: {path}")

    def append_log(self, text: str) -> None:
        t = datetime.now().strftime("%H:%M:%S")
        self.log.configure(state="normal")
        self.log.insert("end", f"[{t}] {text}\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def set_busy(self, busy: bool) -> None:
        self.btn_run.configure(state="disabled" if busy else "normal")
        self.btn_test.configure(state="disabled" if busy else "normal")
        self.btn_cancel.configure(state="normal" if busy else "disabled")
        if hasattr(self, "btn_query_latest"):
            self.btn_query_latest.configure(state="disabled" if busy else "normal")
        if hasattr(self, "btn_query_numbers"):
            self.btn_query_numbers.configure(state="disabled" if busy else "normal")
        if hasattr(self, "btn_query_natural"):
            self.btn_query_natural.configure(state="disabled" if busy else "normal")
        if hasattr(self, "btn_query_export"):
            allow_export = (not busy) and bool(self.last_query_headers)
            self.btn_query_export.configure(state="normal" if allow_export else "disabled")
        if busy:
            self.pb.start(8)
        else:
            self.pb.stop()

    def test_conn(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        self.set_busy(True)
        self.status_var.set("Probando conexión...")
        self.cancel_event.clear()

        def w() -> None:
            try:
                aud = Auditor(SqlPlus(self.sqlplus_var.get().strip()), self.conn_var.get().strip(), self.qlog)
                ctx, warns = aud.test()
                self.queue.put(("test_ok", ctx, warns))
            except Exception as e:
                self.queue.put(("err", str(e), traceback.format_exc()))

        self.worker = threading.Thread(target=w, daemon=True)
        self.worker.start()

    def run_audit(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        try:
            parse_schemas(self.schemas_var.get())
            parse_patterns(self.patterns_var.get())
        except ValueError as e:
            messagebox.showerror("Validación", str(e))
            return

        explicit_tables = self.preloaded_tables if self.use_preloaded_var.get() else []
        if self.use_preloaded_var.get() and not explicit_tables:
            messagebox.showerror(
                "Validación",
                "No hay tablas precargadas. Verifica business_tables_91.txt.",
            )
            return

        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        self.append_log("Inicio de auditoría.")
        if explicit_tables:
            self.append_log(f"Modo tablas precargadas: {len(explicit_tables)} tablas.")
        self.status_var.set("Ejecutando auditoría...")
        self.set_busy(True)
        self.cancel_event.clear()

        def w() -> None:
            try:
                aud = Auditor(SqlPlus(self.sqlplus_var.get().strip()), self.conn_var.get().strip(), self.qlog)
                summary = aud.run(
                    self.output_var.get().strip(),
                    self.schemas_var.get().strip(),
                    self.patterns_var.get().strip(),
                    self.counts_var.get(),
                    self.cancel_event,
                    explicit_tables=explicit_tables,
                )
                self.queue.put(("ok", summary))
            except Exception as e:
                self.queue.put(("err", str(e), traceback.format_exc()))

        self.worker = threading.Thread(target=w, daemon=True)
        self.worker.start()

    def cancel(self) -> None:
        self.cancel_event.set()
        self.status_var.set("Cancelando...")
        self.append_log("Cancelación solicitada. Se aplicará al terminar la consulta actual.")

    def qlog(self, msg: str) -> None:
        self.queue.put(("log", msg))

    def _poll(self) -> None:
        while True:
            try:
                e = self.queue.get_nowait()
            except queue.Empty:
                break

            if e[0] == "log":
                self.append_log(str(e[1]))
            elif e[0] == "test_ok":
                self.set_busy(False)
                self.status_var.set("Conexión validada.")
                ctx, warns = e[1], e[2]
                self.append_log(f"Conexión OK: DB={ctx.get('DB_NAME','')} CON={ctx.get('CON_NAME','')} SERVICE={ctx.get('SERVICE_NAME','')}")
                messagebox.showinfo(
                    "Conexión",
                    f"DB: {ctx.get('DB_NAME','')}\nCON_NAME: {ctx.get('CON_NAME','')}\nSERVICE: {ctx.get('SERVICE_NAME','')}\n\n"
                    f"Advertencias: {len(warns)}",
                )
            elif e[0] == "query_ok":
                self.set_busy(False)
                payload = e[1]
                title = payload.get("title", "consulta")
                headers = payload.get("headers", [])
                rows = payload.get("rows", [])
                sql = payload.get("sql", "")
                warns = payload.get("warnings", [])
                natural_mode = bool(payload.get("natural_mode"))

                self.last_query_headers = headers
                self.last_query_rows = rows
                self.last_query_sql = sql
                self.last_query_title = title
                self.btn_query_export.configure(state="normal" if headers else "disabled")

                txt = []
                txt.append(f"# {title}")
                txt.append(f"# SQL: {sql}")
                txt.append(f"# filas: {len(rows)}")
                if warns:
                    txt.append(f"# advertencias: {len(warns)}")
                txt.append("")
                if natural_mode:
                    txt.append("## Vista natural")
                    txt.append(self._rows_to_natural_text(headers, rows))
                    txt.append("")
                    txt.append("## Tabla (CSV)")
                txt.append(self._rows_to_csv_text(headers, rows))
                self._set_query_result_text("\n".join(txt))

                self.append_log(f"Consulta completada: {title} ({len(rows)} filas).")
                self.status_var.set("Consulta de registros completada.")
            elif e[0] == "ok":
                self.set_busy(False)
                self.status_var.set("Auditoría completada.")
                summary = e[1]
                self.append_log(f"Auditoría terminada. Salida: {summary.get('output_dir')}")
                messagebox.showinfo(
                    "Auditoría finalizada",
                    f"Salida: {summary.get('output_dir')}\nRevisa audit_report.md y audit_summary.json",
                )
            elif e[0] == "err":
                self.set_busy(False)
                self.status_var.set("Error.")
                self.append_log("ERROR: " + str(e[1]))
                self.append_log(str(e[2]))
                messagebox.showerror("Error", str(e[1]))

        self.after(120, self._poll)


if __name__ == "__main__":
    App().mainloop()
