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


def choose_display_columns(
    columns: list[str], numbers_only: bool
) -> tuple[list[str], str]:
    cols = [c.upper() for c in columns]
    num_cols = [
        c
        for c in cols
        if any(k in c for k in ("NUM", "NRO", "PED", "ORD", "FACT", "DOC", "ID"))
    ]
    date_cols = [
        c for c in cols if any(k in c for k in ("FECH", "DATE", "TIMESTAMP", "FEC"))
    ]
    state_cols = [
        c for c in cols if any(k in c for k in ("EST", "STAT", "TIP", "ANUL"))
    ]
    amount_cols = [
        c
        for c in cols
        if any(k in c for k in ("TOTAL", "VALOR", "MONTO", "IMPORTE", "SUBTOT"))
    ]
    party_cols = [
        c
        for c in cols
        if any(k in c for k in ("CLIENT", "PROVE", "NOMBRE", "RUC", "CEDULA"))
    ]

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


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def clean_ruc(value):
    txt = clean_text(value).upper()
    return txt


def is_valid_ecuador_ruc(ruc):
    txt = clean_text(ruc)
    if not txt:
        return False
    if len(txt) != 13:
        return False
    if not txt.isdigit():
        return False
    if txt.startswith("0"):
        return False
    return True


def is_valid_cedula(cedula):
    txt = clean_text(cedula)
    if not txt:
        return False
    if len(txt) != 10:
        return False
    if not txt.isdigit():
        return False
    return True


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


BUSINESS_TABLES = {
    "VENTAS": [
        "VEN_VENTAS",
        "VEN_DETAPROD",
        "VEN_DETAFACT",
        "VEN_DETAFLET",
        "VEN_DETARTPR",
        "VEN_BODEDATO",
    ],
    "COMPRAS": ["COM_TMPCOMPRAS", "COM_DETORDCP", "COM_DETACOMP"],
    "INVENTARIO": [
        "ALM_DETAMOVI",
        "ALM_DETALOTE",
        "AUX_KARDEX",
        "AUX_INVENTARIO",
        "AUX_INVFISICO",
    ],
    "CLIENTES": ["AUX_CLIENTE", "AUX_VENTASFAMP", "AUX_SALDO_CLIENTE", "CLI_DIRECCION"],
    "PRECIOS": ["VEN_PRECDESC", "DWH_VENTAS"],
    "PROVEEDORES": ["COM_DETASOLI"],
}


def audit_business_table(sqlplus: SqlPlus, conn: str, owner: str, table: str) -> dict:
    result = {
        "table": f"{owner}.{table}",
        "exists": False,
        "row_count": 0,
        "columns": 0,
        "null_stats": [],
        "orphans": [],
        "quality_issues": [],
        "data_samples": [],
    }

    h, rows, warns, _ = sqlplus.query(
        conn,
        f"select count(*) as cnt from {owner}.{table}",
    )
    if rows:
        result["exists"] = True
        result["row_count"] = int(rows[0].get("CNT", "0") or "0")

    h, col_rows, _, _ = sqlplus.query(
        conn,
        f"select column_name, data_type, nullable from dba_tab_columns where owner='{owner}' and table_name='{table}' order by column_id",
    )
    result["columns"] = len(col_rows)

    if not result["exists"] or result["row_count"] == 0:
        return result

    for col in col_rows[:20]:
        cname = col.get("COLUMN_NAME", "")
        ctype = col.get("DATA_TYPE", "")
        nullable = col.get("NULLABLE", "Y")
        if not cname:
            continue

        h2, null_rows, _, _ = sqlplus.query(
            conn,
            f"select count(*) as null_cnt from {owner}.{table} where {cname} is null",
        )
        null_count = int(null_rows[0].get("NULL_CNT", "0") or "0") if null_rows else 0
        null_pct = (
            (null_count * 100.0 / result["row_count"]) if result["row_count"] > 0 else 0
        )

        result["null_stats"].append(
            {
                "column": cname,
                "type": ctype,
                "nullable": nullable,
                "null_count": null_count,
                "null_pct": round(null_pct, 2),
            }
        )

    h, sample_rows, _, _ = sqlplus.query(
        conn,
        f"select * from {owner}.{table} fetch first 5 rows only",
    )
    result["data_samples"] = sample_rows[:5]

    return result


def audit_client_rucs(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "total": 0,
        "valid_ruc": 0,
        "valid_cedula": 0,
        "invalid_format": 0,
        "null_ruc": 0,
        "duplicates": 0,
        "quality_issues": [],
    }

    tables = ["AUX_CLIENTE", "AUX_VENTASFAMP", "AUX_SALDO_CLIENTE"]
    all_rucs = {}

    for table in tables:
        h, rows, _, _ = sqlplus.query(
            conn,
            f"select trim(ruc) as ruc from {owner}.{table} where ruc is not null",
        )
        for row in rows:
            ruc = clean_ruc(row.get("RUC"))
            if not ruc:
                continue
            if ruc in all_rucs:
                result["duplicates"] += 1
            all_rucs[ruc] = all_rucs.get(ruc, 0) + 1

    result["total"] = len(all_rucs)

    for ruc, cnt in all_rucs.items():
        if is_valid_ecuador_ruc(ruc):
            result["valid_ruc"] += 1
        elif is_valid_cedula(ruc):
            result["valid_cedula"] += 1
        elif ruc in ["-", "ORA_-", "ERROR:"]:
            result["invalid_format"] += 1
        else:
            result["invalid_format"] += 1
            result["quality_issues"].append(
                {"type": "INVALID_RUC", "value": ruc, "count": cnt}
            )

    result["duplicates"] = sum(1 for c in all_rucs.values() if c > 1)

    return result


def audit_product_codes(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "total": 0,
        "with_name": 0,
        "without_name": 0,
        "duplicates": 0,
        "samples": [],
    }

    h, rows, _, _ = sqlplus.query(
        conn,
        f"select trim(artl_articulo) as code, nombre from {owner}.AUX_INVENTARIO where artl_articulo is not null",
    )

    codes = {}
    for row in rows:
        code = clean_text(row.get("CODE"))
        nombre = clean_text(row.get("NOMBRE"))
        if not code:
            continue
        if code in codes:
            result["duplicates"] += 1
        codes[code] = nombre

    result["total"] = len(codes)
    result["with_name"] = sum(1 for n in codes.values() if n)
    result["without_name"] = sum(1 for n in codes.values() if not n)
    result["samples"] = list(codes.items())[:20]

    return result


def audit_sale_prices(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "total": 0,
        "with_price": 0,
        "zero_price": 0,
        "price_range": {},
        "samples": [],
    }

    sources = [
        (
            "VEN_PRECDESC",
            "select trim(artl_articulo) as code, precvent as price from system.ven_precdesc where precvent > 0",
        ),
        (
            "DWH_VENTAS",
            "select trim(artl_articulo) as code, precunit as price from system.dwh_ventas where precunit > 0",
        ),
        (
            "AUX_KARDEX",
            "select trim(artl_articulo) as code, precunit as price from system.aux_kardex where precunit > 0",
        ),
    ]

    all_prices = {}
    for src_name, sql in sources:
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            for row in rows:
                code = clean_text(row.get("CODE"))
                price = clean_text(row.get("PRICE"))
                if not code:
                    continue
                try:
                    price_val = float(price or "0")
                    if price_val > 0:
                        if (
                            code not in all_prices
                            or price_val > all_prices[code]["price"]
                        ):
                            all_prices[code] = {"price": price_val, "source": src_name}
                except:
                    pass
        except:
            pass

    result["total"] = len(all_prices)
    result["with_price"] = sum(1 for p in all_prices.values() if p["price"] > 0)

    prices = [p["price"] for p in all_prices.values()]
    if prices:
        result["price_range"] = {
            "min": min(prices),
            "max": max(prices),
            "avg": round(sum(prices) / len(prices), 2),
        }

    result["samples"] = list(all_prices.items())[:20]

    return result


def audit_cost_prices(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "total": 0,
        "with_cost": 0,
        "zero_cost": 0,
        "cost_range": {},
        "samples": [],
    }

    sources = [
        (
            "DWH_VENTAS",
            "select trim(artl_articulo) as code, costunit as cost from system.dwh_ventas where costunit > 0",
        ),
        (
            "AUX_KARDEX",
            "select trim(artl_articulo) as code, costunit as cost from system.aux_kardex where costunit > 0",
        ),
        (
            "VEN_DETAPROD",
            "select trim(artl_articulo) as code, costunit as cost from system.ven_detaprod where costunit > 0",
        ),
    ]

    all_costs = {}
    for src_name, sql in sources:
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            for row in rows:
                code = clean_text(row.get("CODE"))
                cost = clean_text(row.get("COST"))
                if not code:
                    continue
                try:
                    cost_val = float(cost or "0")
                    if cost_val > 0:
                        if code not in all_costs or cost_val > all_costs[code]["cost"]:
                            all_costs[code] = {"cost": cost_val, "source": src_name}
                except:
                    pass
        except:
            pass

    result["total"] = len(all_costs)
    result["with_cost"] = sum(1 for c in all_costs.values() if c["cost"] > 0)

    costs = [c["cost"] for c in all_costs.values()]
    if costs:
        result["cost_range"] = {
            "min": min(costs),
            "max": max(costs),
            "avg": round(sum(costs) / len(costs), 2),
        }

    result["samples"] = list(all_costs.items())[:20]

    return result


def audit_saldo_clientes(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "total_clients": 0,
        "with_saldo": 0,
        "total_saldo": 0,
        "saldo_range": {},
        "samples": [],
    }

    h, rows, _, _ = sqlplus.query(
        conn,
        f"select trim(ruc) as ruc, nvl(saldo, 0) as saldo from {owner}.AUX_SALDO_CLIENTE where ruc is not null and nvl(saldo, 0) <> 0",
    )

    saldos = {}
    for row in rows:
        ruc = clean_ruc(row.get("RUC"))
        saldo = clean_text(row.get("SALDO"))
        if not ruc:
            continue
        try:
            saldo_val = float(saldo or "0")
            saldos[ruc] = saldo_val
        except:
            pass

    result["total_clients"] = len(saldos)
    result["with_saldo"] = sum(1 for s in saldos.values() if s > 0)

    saldos_values = list(saldos.values())
    if saldos_values:
        result["total_saldo"] = sum(saldos_values)
        result["saldo_range"] = {
            "min": min(saldos_values),
            "max": max(saldos_values),
            "avg": round(sum(saldos_values) / len(saldos_values), 2),
        }

    result["samples"] = sorted(saldos.items(), key=lambda x: x[1], reverse=True)[:20]

    return result


def audit_orphan_records(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {"total_orphans": 0, "orphans_by_table": []}

    orphan_checks = [
        (
            "VEN_DETAPROD -> VEN_VENTAS",
            "select count(*) as cnt from system.ven_detaprod d where not exists (select 1 from system.ven_ventas v where v.ofcn_compania = d.vnta_compania and v.ofcn_oficina = d.vnta_oficina and v.tpcm_tipocomp = d.vnta_tipocomp and v.serie = d.vnta_serie and v.numero = d.vnta_numero)",
        ),
        (
            "VEN_DETAFACT -> VEN_VENTAS",
            "select count(*) as cnt from system.ven_detafact f where not exists (select 1 from system.ven_ventas v where v.ofcn_compania = f.vnta_compania and v.ofcn_oficina = f.vnta_oficina and v.tpcm_tipocomp = f.vnta_tipocomp and v.serie = f.vnta_serie and v.numero = f.vnta_numero)",
        ),
        (
            "AUX_VENTASFAMP -> AUX_CLIENTE (RUC)",
            "select count(*) as cnt from system.aux_ventasfamp v where not exists (select 1 from system.aux_cliente c where c.ruc = v.ruc) and v.ruc is not null",
        ),
        (
            "VEN_VENTAS -> CLI_DIRECCION",
            "select count(*) as cnt from system.ven_ventas v where not exists (select 1 from system.cli_direccion c where c.clte_idcliente = v.grps_idcliente) and v.grps_idcliente is not null",
        ),
        (
            "VEN_DETAPROD -> AUX_INVENTARIO",
            "select count(*) as cnt from system.ven_detaprod where artl_articulo is not null and not exists (select 1 from system.aux_inventario i where i.artl_articulo = system.ven_detaprod.artl_articulo)",
        ),
        (
            "ALM_DETALOTE -> AUX_INVENTARIO",
            "select count(*) as cnt from system.alm_detallote where artl_articulo is not null and not exists (select 1 from system.aux_inventario i where i.artl_articulo = system.alm_detallote.artl_articulo)",
        ),
    ]

    for check_name, sql in orphan_checks:
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            cnt = int(rows[0].get("CNT", "0") or "0") if rows else 0
            if cnt > 0:
                result["total_orphans"] += cnt
                result["orphans_by_table"].append({"check": check_name, "count": cnt})
        except:
            pass

    return result


def audit_all_related_tables(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "entities": {
            "clientes": {"tables": [], "total_records": 0, "data_quality": {}},
            "productos": {"tables": [], "total_records": 0, "data_quality": {}},
            "ventas": {"tables": [], "total_records": 0, "data_quality": {}},
            "inventario": {"tables": [], "total_records": 0, "data_quality": {}},
            "proveedores": {"tables": [], "total_records": 0, "data_quality": {}},
            "telefonos": {"tables": [], "total_records": 0, "data_quality": {}},
        },
        "all_tables": [],
    }

    table_groups = {
        "clientes": [
            "AUX_CLIENTE",
            "AUX_VENTASFAMP",
            "AUX_SALDO_CLIENTE",
            "CLI_DIRECCION",
            "CLI_RCCLCORR",
            "VEN_GRUPOS",
        ],
        "productos": [
            "AUX_INVENTARIO",
            "VEN_PRECDESC",
            "DWH_VENTAS",
            "AUX_KARDEX",
            "AUX_KARDEXJUL",
            "VEN_BODEDATO",
            "AUX_INVFISICO",
        ],
        "ventas": [
            "VEN_VENTAS",
            "VEN_DETAPROD",
            "VEN_DETAFACT",
            "VEN_DETAFLET",
            "VEN_DETARTPR",
            "VEN_BODEDATO",
        ],
        "inventario": ["ALM_DETALOTE", "ALM_DETAMOVI", "ALM_DETAPLAN", "ALM_PROYPROD"],
        "proveedores": [
            "GEN_TMPPROVEEDOR",
            "COM_TMPCOMPRAS",
            "COM_DETASOLI",
            "COM_DETACOMP",
        ],
        "telefonos": ["GEN_TELEFONO"],
    }

    all_tables_found = []

    for entity, tables in table_groups.items():
        for table in tables:
            try:
                h, rows, _, _ = sqlplus.query(
                    conn,
                    f"select count(*) as cnt from {owner}.{table}",
                )
                cnt = int(rows[0].get("CNT", "0") or "0") if rows else 0
                if cnt is None:
                    cnt = 0
                if cnt > 0:
                    result["entities"][entity]["tables"].append(
                        {
                            "table": table,
                            "records": cnt,
                        }
                    )
                    result["entities"][entity]["total_records"] += cnt
                    all_tables_found.append((table, cnt, entity))
                    result["all_tables"].append(
                        {
                            "table": table,
                            "entity": entity,
                            "records": cnt,
                        }
                    )
            except:
                pass

    return result


def audit_clientes_deep(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "by_table": {},
        "ruc_coverage": {},
        "contact_coverage": {},
        "total_unique_clients": 0,
    }

    table_queries = {
        "AUX_CLIENTE": "select trim(ruc) as ruc, trim(nombre) as nombre, trim(email) as email, trim(nvl(telefclien, telclie1)) as telefono from system.aux_cliente where ruc is not null",
        "AUX_VENTASFAMP": "select trim(ruc) as ruc, trim(razonsocial) as nombre, trim(email) as email from system.aux_ventasfamp where ruc is not null",
        "AUX_SALDO_CLIENTE": "select trim(ruc) as ruc, trim(cliente) as nombre, nvl(saldo, 0) as saldo from system.aux_saldo_cliente where ruc is not null",
        "CLI_DIRECCION": "select trim(to_char(clte_idcliente)) as idcliente, trim(email) as email, trim(direccion) as direccion from system.cli_direccion where clte_idcliente is not null",
        "CLI_RCCLCORR": "select trim(to_char(rcdp_idcliente)) as idcliente, trim(email) as email, trim(principal) as principal from system.cli_rcclcorr where rcdp_idcliente is not null and email is not null",
        "VEN_GRUPOS": "select trim(to_char(clte_idcliente)) as idcliente, trim(grupo) as grupo from system.ven_grupos where clte_idcliente is not null",
    }

    all_rucs = set()
    all_ids = set()

    for table, sql in table_queries.items():
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            ruc_count = 0
            id_count = 0
            with_name = 0
            with_email = 0
            with_phone = 0

            for row in rows:
                if "ruc" in row:
                    ruc = clean_ruc(row.get("RUC"))
                    if ruc and ruc not in ["-", "ERROR:", "ORA_-"]:
                        all_rucs.add(ruc)
                        ruc_count += 1

                if "idcliente" in row:
                    cid = clean_text(row.get("IDCLIENTE"))
                    if cid:
                        all_ids.add(cid)
                        id_count += 1

                nombre = clean_text(row.get("NOMBRE"))
                if nombre:
                    with_name += 1

                email = clean_text(row.get("EMAIL"))
                if email:
                    with_email += 1

                telefono = clean_text(row.get("TELEFONO"))
                if telefono:
                    with_phone += 1

            if ruc_count > 0 or id_count > 0:
                result["by_table"][table] = {
                    "rucs": ruc_count,
                    "ids": id_count,
                    "with_name": with_name,
                    "with_email": with_email,
                    "with_phone": with_phone,
                }
        except:
            pass

    result["total_unique_clients"] = len(all_rucs) + len(all_ids)
    result["ruc_coverage"] = {"unique_rucs": len(all_rucs)}
    result["contact_coverage"] = {"unique_ids": len(all_ids)}

    return result


def audit_productos_deep(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "by_table": {},
        "code_coverage": {},
        "price_coverage": {},
        "total_unique_products": 0,
    }

    table_queries = {
        "AUX_INVENTARIO": "select trim(artl_articulo) as codigo, trim(nombre) as nombre from system.aux_inventario where artl_articulo is not null",
        "VEN_PRECDESC": "select trim(artl_articulo) as codigo, nvl(precvent, 0) as precio from system.ven_precdesc where artl_articulo is not null",
        "DWH_VENTAS": "select trim(artl_articulo) as codigo, nvl(precunit, 0) as precio, nvl(costunit, 0) as costo from system.dwh_ventas where artl_articulo is not null",
        "AUX_KARDEX": "select trim(artl_articulo) as codigo, nvl(precunit, 0) as precio, nvl(costunit, 0) as costo from system.aux_kardex where artl_articulo is not null",
        "AUX_KARDEXJUL": "select trim(artl_articulo) as codigo, nvl(precunit, 0) as precio, nvl(costunit, 0) as costo from system.aux_kardexjul where artl_articulo is not null",
        "VEN_BODEDATO": "select trim(artl_articulo) as codigo, nvl(precunit, 0) as precio, nvl(costunit, 0) as costo from system.ven_bodedato where artl_articulo is not null",
        "AUX_INVFISICO": "select trim(artl_articulo) as codigo, nvl(costo, 0) as costo from system.aux_invfisico where artl_articulo is not null",
    }

    all_codes = set()

    for table, sql in table_queries.items():
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            code_count = 0
            with_name = 0
            with_price = 0
            with_cost = 0

            for row in rows:
                codigo = clean_text(row.get("CODIGO"))
                if codigo:
                    all_codes.add(codigo)
                    code_count += 1

                nombre = clean_text(row.get("NOMBRE"))
                if nombre:
                    with_name += 1

                precio = clean_text(row.get("PRECIO"))
                if precio:
                    try:
                        if float(precio) > 0:
                            with_price += 1
                    except:
                        pass

                costo = clean_text(row.get("COSTO"))
                if costo:
                    try:
                        if float(costo) > 0:
                            with_cost += 1
                    except:
                        pass

            if code_count > 0:
                result["by_table"][table] = {
                    "codes": code_count,
                    "with_name": with_name,
                    "with_price": with_price,
                    "with_cost": with_cost,
                }
        except:
            pass

    result["total_unique_products"] = len(all_codes)
    result["code_coverage"] = {"unique_codes": len(all_codes)}

    return result


def audit_ventas_deep(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "by_table": {},
        "transactions": {},
        "total_unique_orders": 0,
    }

    table_queries = {
        "VEN_VENTAS": "select trim(serie) as serie, trim(numero) as numero, nvl(total, 0) as total, trim(estado) as estado from system.ven_ventas where numero is not null",
        "VEN_DETAPROD": "select trim(to_char(vnta_compania)) ascia, trim(to_char(vnta_oficina)) as ofi, trim(vnta_serie) as serie, trim(vnta_numero) as numero, trim(artl_articulo) as codigo, nvl(cantidad, 0) as cantidad from system.ven_detaprod where vnta_numero is not null",
        "VEN_DETAFACT": "select trim(to_char(vnta_compania)) ascia, trim(to_char(vnta_oficina)) as ofi, trim(vnta_serie) as serie, trim(vnta_numero) as numero, trim(artl_articulo) as codigo, nvl(cantidad, 0) as cantidad from system.ven_detafact where vnta_numero is not null",
    }

    all_orders = set()

    for table, sql in table_queries.items():
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            row_count = 0
            with_total = 0
            unique_orders = 0

            for row in rows:
                row_count += 1

                serie = clean_text(row.get("SERIE"))
                numero = clean_text(row.get("NUMERO"))
                if serie and numero:
                    all_orders.add(f"{serie}-{numero}")
                    unique_orders += 1

                total = clean_text(row.get("TOTAL"))
                if total:
                    try:
                        if float(total) > 0:
                            with_total += 1
                    except:
                        pass

            if row_count > 0:
                result["by_table"][table] = {
                    "rows": row_count,
                    "unique_orders": unique_orders,
                    "with_total": with_total,
                }
        except:
            pass

    result["total_unique_orders"] = len(all_orders)

    return result


def audit_inventario_deep(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "by_table": {},
        "lotes": {},
        "movimientos": {},
    }

    table_queries = {
        "ALM_DETALOTE": "select trim(numlote) as lote, trim(artl_articulo) as codigo, nvl(cantidad, 0) as cantidad, nvl(cantidad2, 0) as cantidad2 from system.alm_detallote where numlote is not null",
        "ALM_DETAMOVI": "select trim(numlote) as lote, trim(artl_articulo) as codigo, nvl(cantidad, 0) as cantidad, trim(tipomov) as tipo from system.alm_detamovi where numlote is not null",
    }

    all_lotes = set()

    for table, sql in table_queries.items():
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            row_count = 0
            with_qty = 0

            for row in rows:
                row_count += 1

                lote = clean_text(row.get("LOTE"))
                if lote:
                    all_lotes.add(lote)

                qty = clean_text(row.get("CANTIDAD"))
                if qty:
                    try:
                        if float(qty) > 0:
                            with_qty += 1
                    except:
                        pass

            if row_count > 0:
                result["by_table"][table] = {
                    "rows": row_count,
                    "unique_lotes": len(all_lotes),
                    "with_quantity": with_qty,
                }
        except:
            pass

    return result


def audit_proveedores_deep(sqlplus: SqlPlus, conn: str, owner: str) -> dict:
    result = {
        "by_table": {},
        "total_unique_providers": 0,
    }

    table_queries = {
        "GEN_TMPPROVEEDOR": "select trim(ruc) as ruc, trim(razonsocial) as nombre from system.gen_tmpproveedor where ruc is not null",
        "COM_TMPCOMPRAS": "select trim(prov_codigo) as codigo, trim(prov_razon) as nombre, nvl(total, 0) as total from system.com_tmpcompras where prov_codigo is not null",
        "COM_DETASOLI": "select trim(prov_codigo) as codigo, trim(prov_razon) as nombre, nvl(cantidad, 0) as cantidad from system.com_detasoli where prov_codigo is not null",
    }

    all_providers = set()

    for table, sql in table_queries.items():
        try:
            h, rows, _, _ = sqlplus.query(conn, sql)
            row_count = 0
            with_name = 0

            for row in rows:
                row_count += 1

                ruc = clean_ruc(row.get("RUC"))
                codigo = clean_text(row.get("CODIGO"))
                if ruc:
                    all_providers.add(ruc)
                if codigo:
                    all_providers.add(codigo)

                nombre = clean_text(row.get("NOMBRE"))
                if nombre:
                    with_name += 1

            if row_count > 0:
                result["by_table"][table] = {
                    "rows": row_count,
                    "with_name": with_name,
                }
        except:
            pass

    result["total_unique_providers"] = len(all_providers)

    return result


class SqlPlus:
    def __init__(self, exe: str, timeout: int = 600) -> None:
        self.exe = exe
        self.timeout = timeout

    def query(
        self, conn: str, sql: str
    ) -> tuple[list[str], list[dict[str, str]], list[str], str]:
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
        out = (
            Path(output_base).resolve()
            / f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        out.mkdir(parents=True, exist_ok=True)
        warnings: set[str] = set()
        files: list[str] = []

        def stop() -> None:
            if cancel.is_set():
                raise RuntimeError("Proceso cancelado por el usuario.")

        def run_save(
            name: str, filename: str, sql: str
        ) -> tuple[list[str], list[dict[str, str]]]:
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
            schemas = sorted(
                {r.get("USERNAME", "").upper() for r in user_rows if r.get("USERNAME")}
            )
        if not schemas:
            cu = (
                ctx_rows[0].get("CURRENT_USER", "SYSTEM") if ctx_rows else "SYSTEM"
            ).upper()
            schemas = [cu]
        self.log("Esquemas objetivo: " + ", ".join(schemas))
        write_csv(
            out / "03_target_schemas.csv",
            ["SCHEMA_NAME"],
            [{"SCHEMA_NAME": s} for s in schemas],
        )
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

        fp_title = (
            "Tablas objetivo por patrón" if target_tables else "Tablas Factura/Pedido"
        )
        fp_file = (
            "10_target_pattern_tables.csv"
            if target_tables
            else "10_factura_pedido_tables.csv"
        )
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

        fp_fk_title = (
            "FK tablas objetivo por patrón" if target_tables else "FK Factura/Pedido"
        )
        fp_fk_file = (
            "11_target_pattern_fk.csv" if target_tables else "11_factura_pedido_fk.csv"
        )
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
                   (c.owner in ({owners}) and ({like_clause("upper(c.table_name)", patterns)}) and {table_where_c})
                or (r.owner in ({owners}) and ({like_clause("upper(r.table_name)", patterns)}) and {table_where_r})
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
                count_rows.append(
                    {
                        "OWNER": owner,
                        "TABLE_NAME": table,
                        "ROW_COUNT": r[0]["ROW_COUNT"] if r else "",
                    }
                )
            write_csv(
                out / count_file, ["OWNER", "TABLE_NAME", "ROW_COUNT"], count_rows
            )
            files.append(count_file)

        self.log("Ejecutando auditorías de negocio...")
        business_audit = {
            "clients": {},
            "products": {},
            "sale_prices": {},
            "cost_prices": {},
            "saldos": {},
            "orphans": {},
            "all_related_tables": {},
            "deep_clientes": {},
            "deep_productos": {},
            "deep_ventas": {},
            "deep_inventario": {},
            "deep_proveedores": {},
        }

        self.log("Auditando clientes RUC/Cédula...")
        try:
            business_audit["clients"] = audit_client_rucs(
                self.sqlplus, self.conn, owners.replace("'", "")
            )
        except Exception as e:
            self.log(f"Error en auditoría clientes: {e}")

        self.log("Auditando productos...")
        try:
            business_audit["products"] = audit_product_codes(
                self.sqlplus, self.conn, owners.replace("'", "")
            )
        except Exception as e:
            self.log(f"Error en auditoría productos: {e}")

        self.log("Auditando precios de venta...")
        try:
            business_audit["sale_prices"] = audit_sale_prices(
                self.sqlplus, self.conn, owners.replace("'", "")
            )
        except Exception as e:
            self.log(f"Error en auditoría precios: {e}")

        self.log("Auditando costos...")
        try:
            business_audit["cost_prices"] = audit_cost_prices(
                self.sqlplus, self.conn, owners.replace("'", "")
            )
        except Exception as e:
            self.log(f"Error en auditoría costos: {e}")

        self.log("Auditando saldos clientes...")
        try:
            business_audit["saldos"] = audit_saldo_clientes(
                self.sqlplus, self.conn, owners.replace("'", "")
            )
        except Exception as e:
            self.log(f"Error en auditoría saldos: {e}")

        self.log("Auditando referencias rotas...")
        try:
            business_audit["orphans"] = audit_orphan_records(
                self.sqlplus, self.conn, owners.replace("'", "")
            )
        except Exception as e:
            self.log(f"Error en auditoría orphans: {e}")

        owner_clean = owners.replace("'", "")

        self.log("Auditando TODAS las tablas relacionadas...")
        try:
            business_audit["all_related_tables"] = audit_all_related_tables(
                self.sqlplus, self.conn, owner_clean
            )
        except Exception as e:
            self.log(f"Error en auditoría tablas relacionadas: {e}")

        self.log("Auditoría profunda de CLIENTES (6 tablas)...")
        try:
            business_audit["deep_clientes"] = audit_clientes_deep(
                self.sqlplus, self.conn, owner_clean
            )
        except Exception as e:
            self.log(f"Error en auditoría deep clientes: {e}")

        self.log("Auditoría profunda de PRODUCTOS (7 tablas)...")
        try:
            business_audit["deep_productos"] = audit_productos_deep(
                self.sqlplus, self.conn, owner_clean
            )
        except Exception as e:
            self.log(f"Error en auditoría deep productos: {e}")

        self.log("Auditoría profunda de VENTAS (3 tablas)...")
        try:
            business_audit["deep_ventas"] = audit_ventas_deep(
                self.sqlplus, self.conn, owner_clean
            )
        except Exception as e:
            self.log(f"Error en auditoría deep ventas: {e}")

        self.log("Auditoría profunda de INVENTARIO (2 tablas)...")
        try:
            business_audit["deep_inventario"] = audit_inventario_deep(
                self.sqlplus, self.conn, owner_clean
            )
        except Exception as e:
            self.log(f"Error en auditoría deep inventario: {e}")

        self.log("Auditoría profunda de PROVEEDORES (3 tablas)...")
        try:
            business_audit["deep_proveedores"] = audit_proveedores_deep(
                self.sqlplus, self.conn, owner_clean
            )
        except Exception as e:
            self.log(f"Error en auditoría deep proveedores: {e}")

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
            "business_audit": business_audit,
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
            "## Conteos de Estructura",
        ]
        for k, v in summary["counts"].items():
            md.append(f"- {k}: **{v}**")

        md.append("")
        md.append("## Auditoría de Datos de Negocio")

        ca = business_audit.get("clients", {})
        if ca:
            md.append("### Clientes/Proveedores")
            md.append(f"- Total RUCs: **{ca.get('total', 0)}**")
            md.append(f"- RUCs válidos Ecuador: **{ca.get('valid_ruc', 0)}**")
            md.append(f"- Cédulas válidas: **{ca.get('valid_cedula', 0)}**")
            md.append(f"- Formatos inválidos: **{ca.get('invalid_format', 0)}**")
            md.append(f"- Duplicados: **{ca.get('duplicates', 0)}**")

        pa = business_audit.get("products", {})
        if pa:
            md.append("### Productos")
            md.append(f"- Total códigos: **{pa.get('total', 0)}**")
            md.append(f"- Con nombre: **{pa.get('with_name', 0)}**")
            md.append(f"- Sin nombre: **{pa.get('without_name', 0)}**")
            md.append(f"- Duplicados: **{pa.get('duplicates', 0)}**")

        spa = business_audit.get("sale_prices", {})
        if spa:
            md.append("### Precios de Venta")
            md.append(f"- Total productos: **{spa.get('total', 0)}**")
            md.append(f"- Con precio: **{spa.get('with_price', 0)}**")
            pr = spa.get("price_range", {})
            if pr:
                md.append(
                    f"- Rango precios: ${pr.get('min', 0):.2f} - ${pr.get('max', 0):.2f} (prom: ${pr.get('avg', 0):.2f})"
                )

        cpa = business_audit.get("cost_prices", {})
        if cpa:
            md.append("### Costos")
            md.append(f"- Total productos: **{cpa.get('total', 0)}**")
            md.append(f"- Con costo: **{cpa.get('with_cost', 0)}**")
            cr = cpa.get("cost_range", {})
            if cr:
                md.append(
                    f"- Rango costos: ${cr.get('min', 0):.2f} - ${cr.get('max', 0):.2f} (prom: ${cr.get('avg', 0):.2f})"
                )

        sa = business_audit.get("saldos", {})
        if sa:
            md.append("### Saldos por Cobrar")
            md.append(f"- Clientes con saldo: **{sa.get('with_saldo', 0)}**")
            md.append(f"- Total saldo: **${sa.get('total_saldo', 0):.2f}**")
            sr = sa.get("saldo_range", {})
            if sr:
                md.append(
                    f"- Rango saldos: ${sr.get('min', 0):.2f} - ${sr.get('max', 0):.2f} (prom: ${sr.get('avg', 0):.2f})"
                )

        oa = business_audit.get("orphans", {})
        if oa:
            md.append("### Referencias Rotas (Huérfanas)")
            md.append(f"- Total registros huérfanos: **{oa.get('total_orphans', 0)}**")
            for orphan in oa.get("orphans_by_table", []):
                md.append(f"- {orphan.get('check', '')}: **{orphan.get('count', 0)}**")

        md.append("")
        md.append("## Auditoría Profunda por Entidad")

        art = business_audit.get("all_related_tables", {})
        if art:
            md.append("### Todas las Tablas Relacionadas")
            all_tables = art.get("all_tables", [])
            total_records = 0
            for t in all_tables:
                total_records += t.get("records", 0)
                md.append(
                    f"- {t.get('table', '')} ({t.get('entity', '')}): **{t.get('records', 0)}** regs"
                )
            md.append(f"- **Total registros en todas las tablas: {total_records}**")

        dc = business_audit.get("deep_clientes", {})
        if dc:
            md.append("### Clientes - Auditoría Profunda (6 tablas)")
            md.append(
                f"- Clientes únicos totales: **{dc.get('total_unique_clients', 0)}**"
            )
            by_table = dc.get("by_table", {})
            for table, stats in by_table.items():
                md.append(
                    f"- {table}: {stats.get('rucs', 0)} RUCs, {stats.get('ids', 0)} IDs, {stats.get('with_name', 0)} c/nombre, {stats.get('with_email', 0)} c/email"
                )

        dp = business_audit.get("deep_productos", {})
        if dp:
            md.append("### Productos - Auditoría Profunda (7 tablas)")
            md.append(
                f"- Productos únicos totales: **{dp.get('total_unique_products', 0)}**"
            )
            by_table = dp.get("by_table", {})
            for table, stats in by_table.items():
                md.append(
                    f"- {table}: {stats.get('codes', 0)} códigos, {stats.get('with_name', 0)} c/nombre, {stats.get('with_price', 0)} c/precio, {stats.get('with_cost', 0)} c/costo"
                )

        dv = business_audit.get("deep_ventas", {})
        if dv:
            md.append("### Ventas - Auditoría Profunda (3 tablas)")
            md.append(
                f"- Órdenes únicas totales: **{dv.get('total_unique_orders', 0)}**"
            )
            by_table = dv.get("by_table", {})
            for table, stats in by_table.items():
                md.append(
                    f"- {table}: {stats.get('rows', 0)} filas, {stats.get('unique_orders', 0)} unique orders"
                )

        di = business_audit.get("deep_inventario", {})
        if di:
            md.append("### Inventario - Auditoría Profunda (2 tablas)")
            by_table = di.get("by_table", {})
            for table, stats in by_table.items():
                md.append(
                    f"- {table}: {stats.get('rows', 0)} filas, {stats.get('unique_lotes', 0)} unique lotes"
                )

        dpr = business_audit.get("deep_proveedores", {})
        if dpr:
            md.append("### Proveedores - Auditoría Profunda (3 tablas)")
            md.append(
                f"- Proveedores únicos totales: **{dpr.get('total_unique_providers', 0)}**"
            )
            by_table = dpr.get("by_table", {})
            for table, stats in by_table.items():
                md.append(
                    f"- {table}: {stats.get('rows', 0)} filas, {stats.get('with_name', 0)} c/nombre"
                )

        md.append("")
        md.append("## Resumen de Migración")
        migratable = 0
        non_migratable = 0

        total_clients = 0
        total_products = 0
        total_orders = 0
        total_providers = 0
        orphan_records = 0

        if dc:
            total_clients = dc.get("total_unique_clients", 0)
            migratable += total_clients
        if dp:
            total_products = dp.get("total_unique_products", 0)
            migratable += total_products
        if dv:
            total_orders = dv.get("total_unique_orders", 0)
        if dpr:
            total_providers = dpr.get("total_unique_providers", 0)
            migratable += total_providers
        if oa:
            orphan_records = oa.get("total_orphans", 0)
            non_migratable += orphan_records

        if ca:
            non_migratable += ca.get("invalid_format", 0)

        md.append("### Datos por Entidad")
        md.append(f"- Clientes migrables: **{total_clients}**")
        md.append(f"- Productos migrables: **{total_products}**")
        md.append(f"- Órdenes/Pedidos: **{total_orders}**")
        md.append(f"- Proveedores migrables: **{total_providers}**")
        md.append(f"- Total registros únicos migrables: **{migratable}**")

        md.append("")
        md.append("### Datos con Problemas")
        md.append(
            f"- RUCs/Cédulas inválidos: **{ca.get('invalid_format', 0) if ca else 0}**"
        )
        md.append(f"- Referencias huérfanas: **{orphan_records}**")

        md.append("")
        md.append("### Cobertura de Migración")
        if dp:
            codes_with_price = sum(
                t.get("with_price", 0) for t in dp.get("by_table", {}).values()
            )
            codes_with_cost = sum(
                t.get("with_cost", 0) for t in dp.get("by_table", {}).values()
            )
            total_codes = dp.get("total_unique_products", 1)
            price_pct = (codes_with_price * 100 / total_codes) if total_codes > 0 else 0
            cost_pct = (codes_with_cost * 100 / total_codes) if total_codes > 0 else 0
            md.append(
                f"- Productos con precio: {codes_with_price}/{total_codes} ({price_pct:.1f}%)"
            )
            md.append(
                f"- Productos con costo: {codes_with_cost}/{total_codes} ({cost_pct:.1f}%)"
            )

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
        ttk.Label(lf1, text="Cadena SQL*Plus").grid(
            row=0, column=0, padx=8, pady=6, sticky="w"
        )
        ttk.Entry(lf1, textvariable=self.conn_var, width=76).grid(
            row=0, column=1, padx=8, pady=6, sticky="ew"
        )
        ttk.Label(lf1, text="Ejecutable").grid(
            row=1, column=0, padx=8, pady=6, sticky="w"
        )
        ttk.Entry(lf1, textvariable=self.sqlplus_var, width=20).grid(
            row=1, column=1, padx=8, pady=6, sticky="w"
        )
        self.btn_test = ttk.Button(lf1, text="Probar conexión", command=self.test_conn)
        self.btn_test.grid(row=0, column=2, rowspan=2, padx=8, pady=6, sticky="ns")
        lf1.columnconfigure(1, weight=1)

        lf2 = ttk.LabelFrame(root, text="Auditoría")
        lf2.pack(fill="x", pady=(8, 0))
        ttk.Label(lf2, text="Esquemas (coma)").grid(
            row=0, column=0, padx=8, pady=6, sticky="w"
        )
        ttk.Entry(lf2, textvariable=self.schemas_var).grid(
            row=0, column=1, padx=8, pady=6, sticky="ew"
        )
        ttk.Label(lf2, text="Patrones tablas").grid(
            row=1, column=0, padx=8, pady=6, sticky="w"
        )
        ttk.Entry(lf2, textvariable=self.patterns_var).grid(
            row=1, column=1, padx=8, pady=6, sticky="ew"
        )
        ttk.Label(lf2, text="Salida").grid(row=2, column=0, padx=8, pady=6, sticky="w")
        ttk.Entry(lf2, textvariable=self.output_var).grid(
            row=2, column=1, padx=8, pady=6, sticky="ew"
        )
        ttk.Button(lf2, text="Examinar", command=self.pick_out).grid(
            row=2, column=2, padx=8, pady=6
        )
        ttk.Checkbutton(
            lf2, text="Incluir COUNT(*) tablas objetivo", variable=self.counts_var
        ).grid(row=3, column=1, padx=8, pady=6, sticky="w")
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

        ttk.Label(lfq, text="Filtro WHERE (opcional)").grid(
            row=1, column=0, padx=8, pady=6, sticky="w"
        )
        ttk.Entry(lfq, textvariable=self.query_where_var).grid(
            row=1, column=1, columnspan=5, padx=8, pady=6, sticky="ew"
        )
        lfq.columnconfigure(3, weight=1)

        query_actions = ttk.Frame(lfq)
        query_actions.grid(
            row=2, column=0, columnspan=6, padx=8, pady=(0, 6), sticky="w"
        )
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
        self.query_result.grid(
            row=3, column=0, columnspan=6, padx=8, pady=(0, 8), sticky="nsew"
        )
        self.query_result.configure(state="disabled")
        lfq.rowconfigure(3, weight=1)

        actions = ttk.Frame(root)
        actions.pack(fill="x", pady=(8, 0))
        self.btn_run = ttk.Button(
            actions, text="Iniciar auditoría", command=self.run_audit
        )
        self.btn_run.pack(side="left")
        self.btn_cancel = ttk.Button(
            actions, text="Cancelar", command=self.cancel, state="disabled"
        )
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
            messagebox.showwarning(
                "Tablas precargadas", "No existe business_tables_91.txt"
            )
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
        columns = [
            r.get("COLUMN_NAME", "").upper() for r in col_rows if r.get("COLUMN_NAME")
        ]
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
            alias = f"{prefix}_{base[: 20 - len(suffix)]}{suffix}"
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
        child_columns = [
            r.get("COLUMN_NAME", "").upper() for r in col_rows if r.get("COLUMN_NAME")
        ]
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
                    r.get("COLUMN_NAME", "").upper()
                    for r in pcols_rows
                    if r.get("COLUMN_NAME")
                ]
            parent_cols = parent_cols_cache[pkey]
            label_cols = choose_natural_label_columns(parent_cols)
            if not label_cols:
                continue

            alias = f"p{join_count + 1}"
            sorted_cols = sorted(cols, key=lambda x: x[0])
            join_pred = " and ".join(
                [f"{alias}.{pcol} = c.{ccol}" for _, ccol, pcol in sorted_cols]
            )
            joins.append(
                f"left join {parent_owner}.{parent_table} {alias} on {join_pred}"
            )

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

    def _rows_to_csv_text(
        self, headers: list[str], rows: list[dict[str, str]], max_rows: int = 200
    ) -> str:
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=headers)
        if headers:
            writer.writeheader()
        for row in rows[:max_rows]:
            writer.writerow({h: row.get(h, "") for h in headers})
        if len(rows) > max_rows:
            out.write(
                f"# ... {len(rows) - max_rows} fila(s) adicionales no mostradas\\n"
            )
        return out.getvalue()

    def _rows_to_natural_text(
        self, headers: list[str], rows: list[dict[str, str]], max_rows: int = 40
    ) -> str:
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
            messagebox.showwarning(
                "Proceso en curso", "Espera a que termine el proceso actual."
            )
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
            messagebox.showwarning(
                "Exportar", "No hay resultado de consulta para exportar."
            )
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
            self.btn_query_export.configure(
                state="normal" if allow_export else "disabled"
            )
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
                aud = Auditor(
                    SqlPlus(self.sqlplus_var.get().strip()),
                    self.conn_var.get().strip(),
                    self.qlog,
                )
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
                aud = Auditor(
                    SqlPlus(self.sqlplus_var.get().strip()),
                    self.conn_var.get().strip(),
                    self.qlog,
                )
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
        self.append_log(
            "Cancelación solicitada. Se aplicará al terminar la consulta actual."
        )

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
                self.append_log(
                    f"Conexión OK: DB={ctx.get('DB_NAME', '')} CON={ctx.get('CON_NAME', '')} SERVICE={ctx.get('SERVICE_NAME', '')}"
                )
                messagebox.showinfo(
                    "Conexión",
                    f"DB: {ctx.get('DB_NAME', '')}\nCON_NAME: {ctx.get('CON_NAME', '')}\nSERVICE: {ctx.get('SERVICE_NAME', '')}\n\n"
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
                self.btn_query_export.configure(
                    state="normal" if headers else "disabled"
                )

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
                self.append_log(
                    f"Auditoría terminada. Salida: {summary.get('output_dir')}"
                )
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
