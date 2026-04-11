import csv
import io
import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

import psycopg2
from psycopg2.extras import Json


ORACLE_CONN = "SYSTEM/FamDb@XE"
ORACLE_EXE = "sqlplus"

POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "user": "postgres",
    "password": "FamDb",
    "dbname": "OdooFAM",
}

BENIGN_ORACLE_WARNINGS = (
    "ERROR:",
    "ORA-01031",
    "ORA-04045",
)

SUSPICIOUS_ERROR_PREFIXES = (
    "ERROR:",
    "ORA-01031:",
    "ORA-04045:",
)

EMAIL_RE = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)
PLACEHOLDER_VALUES = {"", "-", "--", "N/A", "NA", "N", "S", "SN", "S/N", "NULL", "."}

FUNCTIONAL_PREFIXES = (
    "ALM",
    "AUX",
    "CLI",
    "COB",
    "CNT",
    "COM",
    "GEN",
    "PAG",
    "PRT",
    "RHH",
    "SEG",
    "SRI",
    "VEN",
)

REQUIRED_ODOO_MODULES = {
    "sales_core": [
        "contacts",
        "sale_management",
        "sale_stock",
        "stock",
    ],
    "purchase_core": [
        "purchase",
        "purchase_stock",
    ],
    "accounting_core": [
        "account",
        "stock_account",
        "l10n_ec",
    ],
    "inventory_traceability": [
        "stock",
        "l10n_ec_stock",
    ],
    "negotiations_budgeting": [
        "crm",
        "sale_crm",
    ],
    "collaborators_hr": [
        "hr",
        "hr_attendance",
    ],
    # May not be available in every edition/distribution.
    "payroll_target": [
        "hr_contract",
        "hr_payroll",
        "l10n_ec_hr_payroll",
    ],
}


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def clean_code(value):
    txt = clean_text(value).upper()
    return txt


def is_placeholder(value):
    txt = clean_text(value).upper()
    if txt in PLACEHOLDER_VALUES:
        return True
    if txt.startswith("SIN "):
        return True
    return False


def safe_text(value):
    txt = clean_text(value)
    return "" if is_placeholder(txt) else txt


def slugify_code(value):
    code = clean_code(value)
    if not code:
        return ""
    slug = re.sub(r"[^A-Z0-9]+", "_", code).strip("_")
    return slug


def parse_decimal(value):
    txt = clean_text(value)
    if not txt:
        return Decimal("0")
    txt = txt.replace(" ", "")
    if "," in txt and "." in txt:
        if txt.rfind(",") > txt.rfind("."):
            txt = txt.replace(".", "").replace(",", ".")
        else:
            txt = txt.replace(",", "")
    elif "," in txt:
        txt = txt.replace(",", ".")
    try:
        return Decimal(txt)
    except (InvalidOperation, ValueError):
        return Decimal("0")


def parse_datetime(value):
    txt = clean_text(value)
    if not txt:
        return datetime.now()
    patterns = (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    )
    for fmt in patterns:
        try:
            return datetime.strptime(txt, fmt)
        except ValueError:
            continue
    return datetime.now()


def parse_datetime_nullable(value):
    txt = clean_text(value)
    if not txt:
        return None
    patterns = (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    )
    for fmt in patterns:
        try:
            return datetime.strptime(txt, fmt)
        except ValueError:
            continue
    return None


def decode_oracle_output(raw):
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        # Windows sqlplus in this environment returns CP1252 bytes.
        return raw.decode("cp1252", errors="replace")


def normalize_email(value):
    email = clean_text(value).lower()
    if not email:
        return ""
    if email in {"n", "na", "n/a", "-", "--", "s"}:
        return ""
    if not EMAIL_RE.match(email):
        return ""
    return email


def normalize_phone(value):
    txt = clean_text(value)
    if not txt:
        return ""
    if txt in {"-", "--", "n", "N", "S", "s", "0"}:
        return ""

    numbers = re.findall(r"\d{6,15}", txt)
    unique = []
    for n in numbers:
        if n not in unique:
            unique.append(n)
    if not unique:
        return ""
    return " / ".join(unique[:2])


def load_overused_client_emails(min_clients=20):
    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_ID,
            TRIM(EMAIL) AS EMAIL
        FROM SYSTEM.CLI_DIRECCION
        WHERE CLTE_IDCLIENTE IS NOT NULL
          AND EMAIL IS NOT NULL
          AND TRIM(EMAIL) IS NOT NULL
        """
    )
    if warnings:
        print(f"Overused email source warnings: {len(warnings)}")

    clients_by_email = defaultdict(set)
    for row in rows:
        email = normalize_email(row.get("EMAIL"))
        client_id = clean_text(row.get("CLIENT_ID"))
        if not email or not client_id:
            continue
        clients_by_email[email].add(client_id)

    return {email for email, clients in clients_by_email.items() if len(clients) >= min_clients}


def clear_suspicious_partner_emails(cur, blocked_emails):
    blocked = [normalize_email(x) for x in blocked_emails if normalize_email(x)]
    if not blocked:
        return 0
    cur.execute(
        """
        UPDATE res_partner
        SET email = NULL
        WHERE lower(COALESCE(email, '')) = ANY(%s)
          AND customer_rank > 0
          AND (ref IS NULL OR ref NOT LIKE 'VENDOR-%%')
        """,
        (blocked,),
    )
    return cur.rowcount


def run_oracle_query_csv(sql):
    script = (
        "alter session set nls_numeric_characters = '.,';\n"
        "alter session set nls_date_format = 'YYYY-MM-DD HH24:MI:SS';\n"
        "set pagesize 0 feedback off verify off heading on echo off termout off\n"
        "set trimspool on linesize 32767\n"
        "set markup csv on quote on\n"
        f"{sql.strip().rstrip(';')};\n"
        "exit\n"
    )
    cp = subprocess.run(
        [ORACLE_EXE, "-S", ORACLE_CONN],
        input=script.encode("utf-8"),
        capture_output=True,
        check=False,
    )

    stdout = decode_oracle_output(cp.stdout)
    stderr = decode_oracle_output(cp.stderr)
    output = f"{stdout}\n{stderr}".strip()
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
            if not any(w.startswith(prefix) for prefix in BENIGN_ORACLE_WARNINGS)
        ]
        if non_benign:
            raise RuntimeError("Oracle query returned no CSV data:\n" + output)
        return [], warnings

    reader = csv.DictReader(io.StringIO("\n".join(csv_lines)))
    rows = []
    for rec in reader:
        row = {}
        for k, v in rec.items():
            if k is None:
                continue
            row[k.strip().upper()] = clean_text(v)
        rows.append(row)
    return rows, warnings


def get_odoo_defaults(cur):
    cur.execute("SELECT id FROM res_company ORDER BY id LIMIT 1")
    company_id = cur.fetchone()[0]

    cur.execute("SELECT id FROM uom_uom ORDER BY id LIMIT 1")
    uom_id = cur.fetchone()[0]

    cur.execute("SELECT id FROM res_currency WHERE name = 'USD' ORDER BY id LIMIT 1")
    row = cur.fetchone()
    currency_id = row[0] if row else 1
    return {"company_id": company_id, "uom_id": uom_id, "currency_id": currency_id}


def normalize_existing_partner_refs(cur):
    cur.execute(
        """
        SELECT id, ref
        FROM res_partner
        WHERE ref LIKE 'ORA_%'
        ORDER BY id
        """
    )
    rows = cur.fetchall()
    merged = 0
    updated = 0

    for partner_id, ref in rows:
        new_ref = clean_text(ref)[4:]
        if not new_ref:
            continue

        cur.execute(
            "SELECT id FROM res_partner WHERE ref = %s AND id <> %s ORDER BY id LIMIT 1",
            (new_ref, partner_id),
        )
        existing = cur.fetchone()
        if existing:
            target_id = existing[0]
            for col in ("partner_id", "partner_invoice_id", "partner_shipping_id"):
                cur.execute(
                    f"UPDATE sale_order SET {col} = %s WHERE {col} = %s",
                    (target_id, partner_id),
                )
            cur.execute("DELETE FROM res_partner WHERE id = %s", (partner_id,))
            merged += 1
            continue

        cur.execute(
            """
            UPDATE res_partner
            SET ref = %s,
                vat = CASE WHEN vat IS NULL OR btrim(vat) = '' THEN %s ELSE vat END
            WHERE id = %s
            """,
            (new_ref, new_ref, partner_id),
        )
        updated += 1

    return {"refs_updated": updated, "partners_merged": merged}


def cleanup_suspicious_rows(cur):
    stats = {}

    cur.execute(
        """
        DELETE FROM res_partner
        WHERE ref = 'ERROR:'
           OR ref ILIKE 'ORA-01031:%'
           OR (ref ILIKE 'ORA-04045:%' AND ref ILIKE '%TRGSALE%')
        """
    )
    stats["partners_deleted"] = cur.rowcount

    cur.execute(
        """
        DELETE FROM product_product
        WHERE default_code = 'ERROR:'
           OR default_code ILIKE 'ORA-01031:%'
           OR (default_code ILIKE 'ORA-04045:%' AND default_code ILIKE '%TRGSALE%')
        """
    )
    stats["product_variants_deleted"] = cur.rowcount

    cur.execute(
        """
        DELETE FROM product_template
        WHERE default_code = 'ERROR:'
           OR default_code ILIKE 'ORA-01031:%'
           OR (default_code ILIKE 'ORA-04045:%' AND default_code ILIKE '%TRGSALE%')
        """
    )
    stats["product_templates_deleted"] = cur.rowcount

    return stats


def choose_better_partner(current, candidate):
    def score(rec):
        name = clean_text(rec.get("name", ""))
        return (
            1 if name and not name.upper().startswith("CLIENTE ") else 0,
            1 if clean_text(rec.get("email", "")) else 0,
            1 if clean_text(rec.get("phone", "")) else 0,
            1 if clean_text(rec.get("street", "")) else 0,
            len(name),
        )

    return candidate if score(candidate) > score(current) else current


def load_partner_source():
    sql = """
    SELECT
        TRIM(NOMBRE) AS NOMBRE,
        TRIM(RUC) AS RUC,
        TRIM(EMAIL) AS EMAIL,
        TRIM(NVL(TELEFCLIEN, NVL(TELECLIE1, NVL(TELECLIE2, CELULAR)))) AS PHONE,
        TRIM(DIRECCION) AS STREET
    FROM SYSTEM.AUX_CLIENTE
    WHERE RUC IS NOT NULL
      AND TRIM(RUC) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Partner source warnings: {len(warnings)}")

    by_ruc = {}
    skipped = 0
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        if not ruc or any(ruc.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            skipped += 1
            continue
        if ruc in {"-", "ORA_-"}:
            skipped += 1
            continue

        candidate = {
            "ruc": ruc,
            "name": clean_text(row.get("NOMBRE")) or f"CLIENTE {ruc}",
            "email": clean_text(row.get("EMAIL")),
            "phone": clean_text(row.get("PHONE")),
            "street": clean_text(row.get("STREET")),
        }
        if ruc in by_ruc:
            by_ruc[ruc] = choose_better_partner(by_ruc[ruc], candidate)
        else:
            by_ruc[ruc] = candidate

    return by_ruc, skipped


def load_partner_source_from_aux_ventasfamp():
    sql = """
    SELECT
        TRIM(RUC) AS RUC,
        TRIM(RAZONSOCIAL) AS NOMBRE
    FROM SYSTEM.AUX_VENTASFAMP
    WHERE RUC IS NOT NULL
      AND TRIM(RUC) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"AUX_VENTASFAMP partner warnings: {len(warnings)}")

    by_ruc = {}
    skipped = 0
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        if not ruc or any(ruc.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            skipped += 1
            continue
        if ruc in {"-", "ORA_-"}:
            skipped += 1
            continue
        name = clean_text(row.get("NOMBRE")) or f"CLIENTE {ruc}"
        if ruc not in by_ruc or len(name) > len(by_ruc[ruc]["name"]):
            by_ruc[ruc] = {
                "ruc": ruc,
                "name": name,
                "email": "",
                "phone": "",
                "street": "",
            }
    return by_ruc, skipped


def load_partner_fallback_from_saldo():
    sql = """
    SELECT DISTINCT TRIM(RUC) AS RUC
    FROM SYSTEM.AUX_SALDO_CLIENTE
    WHERE RUC IS NOT NULL
      AND TRIM(RUC) IS NOT NULL
    UNION
    SELECT DISTINCT TRIM(RUC) AS RUC
    FROM SYSTEM.AUX_VENTASFAMP
    WHERE RUC IS NOT NULL
      AND TRIM(RUC) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Saldo source warnings: {len(warnings)}")

    rucs = set()
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        if not ruc or any(ruc.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            continue
        if ruc in {"-", "ORA_-"}:
            continue
        rucs.add(ruc)
    return rucs


def find_existing_partner_id(cur, ref, vat):
    ref = clean_text(ref)
    vat = clean_text(vat)
    if ref:
        cur.execute("SELECT id FROM res_partner WHERE ref = %s ORDER BY id LIMIT 1", (ref,))
        row = cur.fetchone()
        if row:
            return row[0]
    if vat:
        cur.execute(
            """
            SELECT id
            FROM res_partner
            WHERE vat = %s
            ORDER BY CASE WHEN ref IS NULL OR btrim(ref) = '' THEN 0 ELSE 1 END, id
            LIMIT 1
            """,
            (vat,),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    return None


def upsert_partner_record(
    cur,
    ref,
    vat,
    name,
    email="",
    phone="",
    street="",
    customer_rank=1,
    supplier_rank=0,
    street2="",
    city="",
):
    ref = clean_text(ref)
    vat = clean_text(vat)
    name = clean_text(name) or (f"CLIENTE {ref}" if ref else "CLIENTE")
    email = clean_text(email)
    phone = clean_text(phone)
    street = clean_text(street)
    street2 = clean_text(street2)
    city = clean_text(city)

    partner_id = find_existing_partner_id(cur, ref, vat)
    if partner_id:
        cur.execute(
            """
            UPDATE res_partner
            SET name = %s,
                ref = COALESCE(NULLIF(ref, ''), %s),
                vat = COALESCE(NULLIF(vat, ''), %s),
                email = CASE WHEN (email IS NULL OR btrim(email) = '') THEN %s ELSE email END,
                phone = CASE WHEN (phone IS NULL OR btrim(phone) = '') THEN %s ELSE phone END,
                street = CASE WHEN (street IS NULL OR btrim(street) = '') THEN %s ELSE street END,
                street2 = CASE WHEN (street2 IS NULL OR btrim(street2) = '') THEN %s ELSE street2 END,
                city = CASE WHEN (city IS NULL OR btrim(city) = '') THEN %s ELSE city END,
                active = true,
                customer_rank = GREATEST(COALESCE(customer_rank, 0), %s),
                supplier_rank = GREATEST(COALESCE(supplier_rank, 0), %s),
                autopost_bills = 'never',
                complete_name = COALESCE(NULLIF(complete_name, ''), %s),
                type = COALESCE(type, 'contact'),
                is_company = COALESCE(is_company, false),
                group_rfq = 'default',
                group_on = 'default'
            WHERE id = %s
            """,
            (
                name,
                ref,
                vat,
                email,
                phone,
                street,
                street2,
                city,
                customer_rank,
                supplier_rank,
                name,
                partner_id,
            ),
        )
        return partner_id

    cur.execute(
        """
        INSERT INTO res_partner
            (name, ref, vat, email, phone, street, street2, city, active,
             customer_rank, supplier_rank, autopost_bills, complete_name,
             type, is_company, group_rfq, group_on)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, true,
             %s, %s, 'never', %s,
             'contact', false, 'default', 'default')
        RETURNING id
        """,
        (name, ref, vat, email, phone, street, street2, city, customer_rank, supplier_rank, name),
    )
    return cur.fetchone()[0]


def upsert_partners(cur, partner_map):
    inserted_or_updated = 0
    for rec in partner_map.values():
        ruc = rec["ruc"]
        name = rec["name"] or f"CLIENTE {ruc}"
        email = rec["email"]
        phone = rec["phone"]
        street = rec["street"]

        upsert_partner_record(
            cur=cur,
            ref=ruc,
            vat=ruc,
            name=name,
            email=email,
            phone=phone,
            street=street,
            customer_rank=1,
        )
        inserted_or_updated += 1

    return inserted_or_updated


def load_product_source():
    sql = """
    SELECT
        TRIM(ARTL_ARTICULO) AS CODE,
        TRIM(NOMBRE) AS NOMBRE
    FROM SYSTEM.AUX_INVENTARIO
    WHERE ARTL_ARTICULO IS NOT NULL
      AND TRIM(ARTL_ARTICULO) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Product source warnings: {len(warnings)}")

    by_code = {}
    skipped = 0
    for row in rows:
        code = clean_text(row.get("CODE"))
        name = clean_text(row.get("NOMBRE"))
        if not code or any(code.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            skipped += 1
            continue
        if code in {"-", "ORA_-"}:
            skipped += 1
            continue
        if not name:
            name = code

        if code not in by_code or len(name) > len(by_code[code]):
            by_code[code] = name
    return by_code, skipped


def upsert_products(cur, by_code, defaults):
    total = 0
    for code, name in by_code.items():
        name_json = Json({"en_US": name, "es_EC": name})
        cur.execute(
            """
            INSERT INTO product_template
                (name, default_code, sale_ok, purchase_ok, type, active,
                 list_price, uom_id, categ_id, service_tracking, tracking, is_storable, invoice_policy)
            VALUES
                (%s, %s, true, true, 'product', true,
                 0.0, %s, 1, 'no', 'none', true, 'delivery')
            ON CONFLICT (default_code) DO UPDATE
            SET name = EXCLUDED.name,
                active = true,
                sale_ok = true,
                purchase_ok = true,
                type = 'product',
                is_storable = true,
                invoice_policy = COALESCE(product_template.invoice_policy, 'delivery')
            RETURNING id
            """,
            (name_json, code, defaults["uom_id"]),
        )
        tmpl_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO product_product
                (product_tmpl_id, default_code, active, combination_indices)
            VALUES
                (%s, %s, true, '')
            ON CONFLICT (default_code) DO UPDATE
            SET product_tmpl_id = EXCLUDED.product_tmpl_id,
                active = true
            """,
            (tmpl_id, code),
        )
        total += 1
    return total


def choose_best_price_candidate(current, candidate):
    if not current:
        return candidate
    if candidate["score"] > current["score"]:
        return candidate
    if candidate["score"] < current["score"]:
        return current
    if clean_text(candidate.get("ts")) > clean_text(current.get("ts")):
        return candidate
    return current


def load_sale_price_map():
    by_code = {}

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(ARTL_ARTICULO) AS CODE,
            TRIM(TO_CHAR(LSPR_LSPR_ID)) AS LSPR_ID,
            NVL(PRECVENT, 0) AS PRICE,
            TRIM(VIGENTE) AS VIGENTE,
            TRIM(ACTIVO) AS ACTIVO,
            TO_CHAR(NVL(FECHACTU, NVL(FECHA, FECHCREA)), 'YYYY-MM-DD HH24:MI:SS') AS TS
        FROM SYSTEM.VEN_PRECDESC
        WHERE ARTL_ARTICULO IS NOT NULL
          AND TRIM(ARTL_ARTICULO) IS NOT NULL
          AND NVL(PRECVENT, 0) > 0
        """
    )
    if warnings:
        print(f"Sale price source VEN_PRECDESC warnings: {len(warnings)}")
    for row in rows:
        code = clean_text(row.get("CODE"))
        price = parse_decimal(row.get("PRICE"))
        if not code or price <= 0:
            continue
        lspr_id = clean_text(row.get("LSPR_ID"))
        vigente = clean_code(row.get("VIGENTE"))
        activo = clean_code(row.get("ACTIVO"))
        score = 0
        if vigente == "S":
            score += 100
        if activo == "S":
            score += 100
        if lspr_id == "0":
            score += 50
        candidate = {
            "price": price,
            "score": score,
            "ts": clean_text(row.get("TS")),
            "source": "VEN_PRECDESC",
        }
        by_code[code] = choose_best_price_candidate(by_code.get(code), candidate)

    # Fallback transaccional cuando no existe precio en VEN_PRECDESC.
    for source_name, sql in (
        (
            "DWH_VENTAS",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(PRECUNIT, 0) AS PRICE,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.DWH_VENTAS
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND NVL(PRECUNIT, 0) > 0
            """,
        ),
        (
            "AUX_KARDEX",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(PRECUNIT, 0) AS PRICE,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.AUX_KARDEX
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND NVL(PRECUNIT, 0) > 0
            """,
        ),
        (
            "AUX_KARDEXJUL",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(PRECUNIT, 0) AS PRICE,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.AUX_KARDEXJUL
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND NVL(PRECUNIT, 0) > 0
            """,
        ),
        (
            "VEN_BODEDATO",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(PRECUNIT, 0) AS PRICE,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.VEN_BODEDATO
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND NVL(PRECUNIT, 0) > 0
            """,
        ),
    ):
        rows, warnings = run_oracle_query_csv(sql)
        if warnings:
            print(f"Sale price source {source_name} warnings: {len(warnings)}")
        for row in rows:
            code = clean_text(row.get("CODE"))
            price = parse_decimal(row.get("PRICE"))
            if not code or price <= 0:
                continue
            if source_name == "DWH_VENTAS":
                score = 20
            elif source_name == "AUX_KARDEX":
                score = 18
            elif source_name == "AUX_KARDEXJUL":
                score = 16
            else:
                score = 10
            candidate = {
                "price": price,
                "score": score,
                "ts": clean_text(row.get("TS")),
                "source": source_name,
            }
            by_code[code] = choose_best_price_candidate(by_code.get(code), candidate)

    return {code: rec["price"] for code, rec in by_code.items()}


def load_cost_price_map():
    by_code = {}

    for source_name, sql in (
        (
            "DWH_VENTAS",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(COSTUNIT, 0) AS COSTUNIT,
                NVL(COSTO, 0) AS COSTO,
                NVL(CANTIDAD, 0) AS QTY,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.DWH_VENTAS
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND (NVL(COSTUNIT, 0) > 0 OR NVL(COSTO, 0) > 0)
            """,
        ),
        (
            "AUX_KARDEX",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(COSTUNIT, 0) AS COSTUNIT,
                NVL(VALOR, 0) AS COSTO,
                NVL(CANTIDAD, 0) AS QTY,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.AUX_KARDEX
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND (NVL(COSTUNIT, 0) > 0 OR NVL(VALOR, 0) > 0)
            """,
        ),
        (
            "AUX_KARDEXJUL",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(COSTUNIT, 0) AS COSTUNIT,
                NVL(VALOR, 0) AS COSTO,
                NVL(CANTIDAD, 0) AS QTY,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.AUX_KARDEXJUL
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND (NVL(COSTUNIT, 0) > 0 OR NVL(VALOR, 0) > 0)
            """,
        ),
        (
            "VEN_BODEDATO",
            """
            SELECT
                TRIM(ARTL_ARTICULO) AS CODE,
                NVL(COSTUNIT, 0) AS COSTUNIT,
                NVL(COSTO, 0) AS COSTO,
                NVL(CANTIDAD, 0) AS QTY,
                TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS TS
            FROM SYSTEM.VEN_BODEDATO
            WHERE ARTL_ARTICULO IS NOT NULL
              AND TRIM(ARTL_ARTICULO) IS NOT NULL
              AND (NVL(COSTUNIT, 0) > 0 OR NVL(COSTO, 0) > 0)
            """,
        ),
    ):
        rows, warnings = run_oracle_query_csv(sql)
        if warnings:
            print(f"Cost source {source_name} warnings: {len(warnings)}")
        for row in rows:
            code = clean_text(row.get("CODE"))
            if not code:
                continue
            costunit = parse_decimal(row.get("COSTUNIT"))
            costo = parse_decimal(row.get("COSTO"))
            qty = parse_decimal(row.get("QTY"))
            if costunit > 0:
                cost = costunit
                if source_name == "DWH_VENTAS":
                    score = 100
                elif source_name == "AUX_KARDEX":
                    score = 95
                elif source_name == "AUX_KARDEXJUL":
                    score = 93
                else:
                    score = 90
            elif costo > 0 and qty > 0:
                cost = costo / qty
                if source_name == "DWH_VENTAS":
                    score = 95
                elif source_name == "AUX_KARDEX":
                    score = 90
                elif source_name == "AUX_KARDEXJUL":
                    score = 88
                else:
                    score = 85
            elif costo > 0:
                cost = costo
                if source_name == "DWH_VENTAS":
                    score = 80
                elif source_name == "AUX_KARDEX":
                    score = 76
                elif source_name == "AUX_KARDEXJUL":
                    score = 74
                else:
                    score = 70
            else:
                continue
            candidate = {
                "price": cost,
                "score": score,
                "ts": clean_text(row.get("TS")),
                "source": source_name,
            }
            by_code[code] = choose_best_price_candidate(by_code.get(code), candidate)

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(d.ARTL_ARTICULO) AS CODE,
            NVL(d.COSTUNIT, 0) AS COSTUNIT,
            NVL(d.COSTACTU, 0) AS COSTACTU,
            TO_CHAR(NVL(v.FECHA, NVL(d.FECHACTU, d.FECHCREA)), 'YYYY-MM-DD HH24:MI:SS') AS TS
        FROM SYSTEM.VEN_DETAPROD d
        LEFT JOIN SYSTEM.VEN_VENTAS v
          ON v.OFCN_COMPANIA = d.VNTA_COMPANIA
         AND v.OFCN_OFICINA = d.VNTA_OFICINA
         AND v.TPCM_TIPOCOMP = d.VNTA_TIPOCOMP
         AND v.SERIE = d.VNTA_SERIE
         AND v.NUMERO = d.VNTA_NUMERO
        WHERE d.ARTL_ARTICULO IS NOT NULL
          AND TRIM(d.ARTL_ARTICULO) IS NOT NULL
          AND (NVL(d.COSTUNIT, 0) > 0 OR NVL(d.COSTACTU, 0) > 0)
        """
    )
    if warnings:
        print(f"Cost source VEN_DETAPROD warnings: {len(warnings)}")
    for row in rows:
        code = clean_text(row.get("CODE"))
        if not code:
            continue
        costunit = parse_decimal(row.get("COSTUNIT"))
        costactu = parse_decimal(row.get("COSTACTU"))
        cost = costunit if costunit > 0 else costactu
        if cost <= 0:
            continue
        score = 75 if costunit > 0 else 65
        candidate = {
            "price": cost,
            "score": score,
            "ts": clean_text(row.get("TS")),
            "source": "VEN_DETAPROD",
        }
        by_code[code] = choose_best_price_candidate(by_code.get(code), candidate)

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(ARTL_ARTICULO) AS CODE,
            NVL(COSTO, 0) AS COSTO
        FROM SYSTEM.AUX_INVFISICO
        WHERE ARTL_ARTICULO IS NOT NULL
          AND TRIM(ARTL_ARTICULO) IS NOT NULL
          AND NVL(COSTO, 0) > 0
        """
    )
    if warnings:
        print(f"Cost source AUX_INVFISICO warnings: {len(warnings)}")
    for row in rows:
        code = clean_text(row.get("CODE"))
        cost = parse_decimal(row.get("COSTO"))
        if not code or cost <= 0:
            continue
        candidate = {
            "price": cost,
            "score": 55,
            "ts": "",
            "source": "AUX_INVFISICO",
        }
        by_code[code] = choose_best_price_candidate(by_code.get(code), candidate)

    return {code: rec["price"] for code, rec in by_code.items()}


def apply_product_prices(cur, defaults):
    sale_map = load_sale_price_map()
    cost_map = load_cost_price_map()

    cur.execute(
        """
        SELECT pp.id, pp.product_tmpl_id, btrim(pp.default_code) AS code
        FROM product_product pp
        WHERE pp.default_code IS NOT NULL
          AND btrim(pp.default_code) <> ''
        """
    )
    rows = cur.fetchall()

    sale_updated = 0
    cost_updated = 0
    sale_missing = 0
    cost_missing = 0
    company_key = str(defaults["company_id"])

    for product_id, tmpl_id, code in rows:
        code_txt = clean_text(code)
        sale_price = sale_map.get(code_txt)
        cost_price = cost_map.get(code_txt)

        if sale_price and sale_price > 0:
            cur.execute(
                """
                UPDATE product_template
                SET list_price = %s
                WHERE id = %s
                """,
                (sale_price, tmpl_id),
            )
            sale_updated += 1
        else:
            sale_missing += 1

        if cost_price and cost_price > 0:
            cost_json = Json({company_key: float(cost_price)})
            cur.execute(
                """
                UPDATE product_product
                SET standard_price = %s
                WHERE id = %s
                """,
                (cost_json, product_id),
            )
            cost_updated += 1
        else:
            cost_missing += 1

    return {
        "odoo_products_with_code": len(rows),
        "source_sale_prices": len(sale_map),
        "source_cost_prices": len(cost_map),
        "sale_updated": sale_updated,
        "cost_updated": cost_updated,
        "sale_missing": sale_missing,
        "cost_missing": cost_missing,
    }


def load_partner_map_for_sales(cur):
    cur.execute(
        """
        SELECT btrim(ref), id
        FROM res_partner
        WHERE ref IS NOT NULL AND btrim(ref) <> ''
        """
    )
    return {row[0]: row[1] for row in cur.fetchall()}


def load_oracle_client_id_to_ruc():
    sql = """
    SELECT DISTINCT
        TRIM(CODIGOCLIENTE) AS CODIGOCLIENTE,
        TRIM(RUC) AS RUC,
        1 AS SRC_PRIORITY
    FROM SYSTEM.AUX_VENTASFAMP
    WHERE CODIGOCLIENTE IS NOT NULL
      AND TRIM(CODIGOCLIENTE) IS NOT NULL
      AND RUC IS NOT NULL
      AND TRIM(RUC) IS NOT NULL
    UNION ALL
    SELECT DISTINCT
        TRIM(CODIGOCLIENTE) AS CODIGOCLIENTE,
        TRIM(RUC) AS RUC,
        2 AS SRC_PRIORITY
    FROM SYSTEM.AUX_SALDO_CLIENTE
    WHERE CODIGOCLIENTE IS NOT NULL
      AND TRIM(CODIGOCLIENTE) IS NOT NULL
      AND RUC IS NOT NULL
      AND TRIM(RUC) IS NOT NULL
    UNION ALL
    SELECT DISTINCT
        TRIM(TO_CHAR(IDCLIENTE)) AS CODIGOCLIENTE,
        TRIM(CEDURUC) AS RUC,
        3 AS SRC_PRIORITY
    FROM SYSTEM.VEN_BODEDATO
    WHERE IDCLIENTE IS NOT NULL
      AND CEDURUC IS NOT NULL
      AND TRIM(CEDURUC) IS NOT NULL
    UNION ALL
    SELECT DISTINCT
        TRIM(TO_CHAR(IDCLIENTE)) AS CODIGOCLIENTE,
        TRIM(CEDURUC) AS RUC,
        4 AS SRC_PRIORITY
    FROM SYSTEM.DWH_VENTAS
    WHERE IDCLIENTE IS NOT NULL
      AND CEDURUC IS NOT NULL
      AND TRIM(CEDURUC) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Client map warnings: {len(warnings)}")

    out = {}
    seen = {}
    for row in rows:
        cid = clean_text(row.get("CODIGOCLIENTE"))
        ruc = clean_text(row.get("RUC"))
        prio = int(parse_decimal(row.get("SRC_PRIORITY")))
        if not cid or not ruc:
            continue
        if any(ruc.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            continue
        if cid not in seen or prio < seen[cid]:
            out[cid] = ruc
            seen[cid] = prio
    return out


def load_oracle_client_profiles():
    sql = """
    SELECT
        TRIM(CODIGOCLIENTE) AS CLIENT_ID,
        TRIM(RUC) AS RUC,
        TRIM(RAZONSOCIAL) AS CLIENT_NAME,
        1 AS SRC_PRIORITY
    FROM SYSTEM.AUX_VENTASFAMP
    WHERE CODIGOCLIENTE IS NOT NULL
      AND TRIM(CODIGOCLIENTE) IS NOT NULL
    UNION ALL
    SELECT
        TRIM(CODIGOCLIENTE) AS CLIENT_ID,
        TRIM(RUC) AS RUC,
        NULL AS CLIENT_NAME,
        2 AS SRC_PRIORITY
    FROM SYSTEM.AUX_SALDO_CLIENTE
    WHERE CODIGOCLIENTE IS NOT NULL
      AND TRIM(CODIGOCLIENTE) IS NOT NULL
    UNION ALL
    SELECT
        TRIM(TO_CHAR(IDCLIENTE)) AS CLIENT_ID,
        TRIM(CEDURUC) AS RUC,
        TRIM(CLIENTE) AS CLIENT_NAME,
        3 AS SRC_PRIORITY
    FROM SYSTEM.VEN_BODEDATO
    WHERE IDCLIENTE IS NOT NULL
      AND TRIM(TO_CHAR(IDCLIENTE)) IS NOT NULL
    UNION ALL
    SELECT
        TRIM(TO_CHAR(IDCLIENTE)) AS CLIENT_ID,
        TRIM(CEDURUC) AS RUC,
        TRIM(CLIENTE) AS CLIENT_NAME,
        4 AS SRC_PRIORITY
    FROM SYSTEM.DWH_VENTAS
    WHERE IDCLIENTE IS NOT NULL
      AND TRIM(TO_CHAR(IDCLIENTE)) IS NOT NULL
    UNION ALL
    SELECT
        TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_ID,
        NULL AS RUC,
        NULL AS CLIENT_NAME,
        5 AS SRC_PRIORITY
    FROM SYSTEM.CLI_DIRECCION
    WHERE CLTE_IDCLIENTE IS NOT NULL
    UNION ALL
    SELECT
        TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_ID,
        NULL AS RUC,
        NULL AS CLIENT_NAME,
        6 AS SRC_PRIORITY
    FROM SYSTEM.VEN_GRUPOS
    WHERE CLTE_IDCLIENTE IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Client profile warnings: {len(warnings)}")

    profiles = {}
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        if not client_id:
            continue
        prio = int(parse_decimal(row.get("SRC_PRIORITY")))
        ruc = clean_text(row.get("RUC"))
        name = clean_text(row.get("CLIENT_NAME"))

        if client_id not in profiles:
            profiles[client_id] = {"ruc": "", "name": "", "ruc_prio": 999}

        if ruc and not any(ruc.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            if prio < profiles[client_id]["ruc_prio"]:
                profiles[client_id]["ruc"] = ruc
                profiles[client_id]["ruc_prio"] = prio

        if name and len(name) > len(profiles[client_id]["name"]):
            profiles[client_id]["name"] = name

    return profiles


def load_partner_id_by_ref(cur):
    cur.execute(
        """
        SELECT btrim(ref), id
        FROM res_partner
        WHERE ref IS NOT NULL AND btrim(ref) <> ''
        """
    )
    return {row[0]: row[1] for row in cur.fetchall()}


def pick_best_contact(current, candidate):
    if not current:
        return candidate
    if candidate["score"] > current["score"]:
        return candidate
    return current


def build_client_to_partner_id_map(cur, client_profiles):
    partner_by_ref = load_partner_id_by_ref(cur)
    client_partner = {}
    for client_id, profile in client_profiles.items():
        ruc = clean_text(profile.get("ruc", ""))
        if ruc and ruc in partner_by_ref:
            client_partner[client_id] = partner_by_ref[ruc]
            continue
        synthetic_ref = f"CLIID-{client_id}"
        if synthetic_ref in partner_by_ref:
            client_partner[client_id] = partner_by_ref[synthetic_ref]
    return client_partner


def build_contact_candidates(cur, client_profiles, blocked_emails=None):
    blocked = {normalize_email(x) for x in (blocked_emails or set()) if normalize_email(x)}
    client_partner = build_client_to_partner_id_map(cur, client_profiles)
    by_partner_email = {}
    by_partner_phone = {}

    # Email source 1: CLI_RCCLCORR (if present)
    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(RCDP_IDCLIENTE)) AS CLIENT_ID,
            TRIM(EMAIL) AS EMAIL,
            TRIM(PRINCIPAL) AS PRINCIPAL
        FROM SYSTEM.CLI_RCCLCORR
        WHERE EMAIL IS NOT NULL
          AND TRIM(EMAIL) IS NOT NULL
          AND RCDP_IDCLIENTE IS NOT NULL
        """
    )
    if warnings:
        print(f"CLI_RCCLCORR contact warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        partner_id = client_partner.get(client_id)
        if not partner_id:
            continue
        email = normalize_email(row.get("EMAIL"))
        if not email or email in blocked:
            continue
        principal = clean_text(row.get("PRINCIPAL")).upper()
        score = 110 if principal == "S" else 100
        candidate = {"value": email, "score": score, "source": "CLI_RCCLCORR"}
        by_partner_email[partner_id] = pick_best_contact(by_partner_email.get(partner_id), candidate)

    # Email source 2: CLI_DIRECCION
    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_ID,
            TRIM(EMAIL) AS EMAIL,
            TRIM(PRINCIPAL) AS PRINCIPAL
        FROM SYSTEM.CLI_DIRECCION
        WHERE EMAIL IS NOT NULL
          AND TRIM(EMAIL) IS NOT NULL
          AND CLTE_IDCLIENTE IS NOT NULL
        """
    )
    if warnings:
        print(f"CLI_DIRECCION contact warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        partner_id = client_partner.get(client_id)
        if not partner_id:
            continue
        email = normalize_email(row.get("EMAIL"))
        if not email or email in blocked:
            continue
        principal = clean_text(row.get("PRINCIPAL")).upper()
        score = 95 if principal == "S" else 85
        candidate = {"value": email, "score": score, "source": "CLI_DIRECCION"}
        by_partner_email[partner_id] = pick_best_contact(by_partner_email.get(partner_id), candidate)

    # Email/phone fallback by RUC from AUX_CLIENTE
    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(RUC) AS RUC,
            TRIM(EMAIL) AS EMAIL,
            TRIM(NVL(TELEFCLIEN, NVL(TELECLIE1, NVL(TELECLIE2, CELULAR)))) AS PHONE
        FROM SYSTEM.AUX_CLIENTE
        WHERE RUC IS NOT NULL
          AND TRIM(RUC) IS NOT NULL
        """
    )
    if warnings:
        print(f"AUX_CLIENTE contact warnings: {len(warnings)}")
    partner_by_ref = load_partner_id_by_ref(cur)
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        partner_id = partner_by_ref.get(ruc)
        if not partner_id:
            continue

        email = normalize_email(row.get("EMAIL"))
        if email and email not in blocked:
            candidate = {"value": email, "score": 60, "source": "AUX_CLIENTE"}
            by_partner_email[partner_id] = pick_best_contact(by_partner_email.get(partner_id), candidate)

        phone = normalize_phone(row.get("PHONE"))
        if phone:
            candidate = {"value": phone, "score": 55, "source": "AUX_CLIENTE"}
            by_partner_phone[partner_id] = pick_best_contact(by_partner_phone.get(partner_id), candidate)

    # Phone source 1: GEN_TELEFONO
    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_ID,
            TRIM(NUMEFONO) AS PHONE,
            TRIM(PRINCIPAL) AS PRINCIPAL,
            TRIM(TPFN_TIPOTELE) AS PHONE_TYPE
        FROM SYSTEM.GEN_TELEFONO
        WHERE NUMEFONO IS NOT NULL
          AND TRIM(NUMEFONO) IS NOT NULL
          AND CLTE_IDCLIENTE IS NOT NULL
        """
    )
    if warnings:
        print(f"GEN_TELEFONO contact warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        partner_id = client_partner.get(client_id)
        if not partner_id:
            continue
        phone = normalize_phone(row.get("PHONE"))
        if not phone:
            continue
        principal = clean_text(row.get("PRINCIPAL")).upper()
        phone_type = clean_text(row.get("PHONE_TYPE")).upper()
        score = 100 if principal == "S" else 90
        if phone_type == "M":
            score += 2
        candidate = {"value": phone, "score": score, "source": "GEN_TELEFONO"}
        by_partner_phone[partner_id] = pick_best_contact(by_partner_phone.get(partner_id), candidate)

    # Email fallback from VEN_VENTAS (transactional)
    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(GRPS_IDCLIENTE)) AS CLIENT_ID,
            TRIM(EMAIL) AS EMAIL
        FROM SYSTEM.VEN_VENTAS
        WHERE GRPS_IDCLIENTE IS NOT NULL
          AND EMAIL IS NOT NULL
          AND TRIM(EMAIL) IS NOT NULL
        """
    )
    if warnings:
        print(f"VEN_VENTAS contact warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        partner_id = client_partner.get(client_id)
        if not partner_id:
            continue
        email = normalize_email(row.get("EMAIL"))
        if not email or email in blocked:
            continue
        candidate = {"value": email, "score": 50, "source": "VEN_VENTAS"}
        by_partner_email[partner_id] = pick_best_contact(by_partner_email.get(partner_id), candidate)

    return by_partner_email, by_partner_phone


def enrich_partner_contacts(cur, client_profiles, blocked_emails=None):
    by_partner_email, by_partner_phone = build_contact_candidates(
        cur, client_profiles, blocked_emails=blocked_emails
    )
    partner_ids = set(by_partner_email.keys()) | set(by_partner_phone.keys())
    if not partner_ids:
        return {
            "candidates_email": 0,
            "candidates_phone": 0,
            "updated_email": 0,
            "updated_phone": 0,
        }

    cur.execute(
        """
        SELECT id, COALESCE(email, ''), COALESCE(phone, '')
        FROM res_partner
        WHERE id = ANY(%s)
        """,
        (list(partner_ids),),
    )
    current = {row[0]: {"email": clean_text(row[1]), "phone": clean_text(row[2])} for row in cur.fetchall()}

    updated_email = 0
    updated_phone = 0
    for partner_id in partner_ids:
        current_email = current.get(partner_id, {}).get("email", "")
        current_phone = current.get(partner_id, {}).get("phone", "")
        new_email = by_partner_email.get(partner_id, {}).get("value", "")
        new_phone = by_partner_phone.get(partner_id, {}).get("value", "")

        set_email = ""
        set_phone = ""

        if new_email and (not normalize_email(current_email)):
            set_email = new_email
        if new_phone and (not normalize_phone(current_phone)):
            set_phone = new_phone

        if set_email or set_phone:
            cur.execute(
                """
                UPDATE res_partner
                SET email = CASE WHEN %s <> '' THEN %s ELSE email END,
                    phone = CASE WHEN %s <> '' THEN %s ELSE phone END
                WHERE id = %s
                """,
                (set_email, set_email, set_phone, set_phone, partner_id),
            )
            if set_email:
                updated_email += 1
            if set_phone:
                updated_phone += 1

    return {
        "candidates_email": len(by_partner_email),
        "candidates_phone": len(by_partner_phone),
        "updated_email": updated_email,
        "updated_phone": updated_phone,
    }


def pick_scored_candidate(current, candidate):
    if not current:
        return candidate
    current_score = int(current.get("score", 0))
    candidate_score = int(candidate.get("score", 0))
    if candidate_score > current_score:
        return candidate
    if candidate_score < current_score:
        return current

    current_ts = clean_text(current.get("ts"))
    candidate_ts = clean_text(candidate.get("ts"))
    if candidate_ts > current_ts:
        return candidate
    if candidate_ts < current_ts:
        return current

    current_street_len = len(clean_text(current.get("street")))
    candidate_street_len = len(clean_text(candidate.get("street")))
    if candidate_street_len > current_street_len:
        return candidate
    return current


def build_street_value(calle, numero):
    calle_clean = safe_text(calle)
    numero_clean = safe_text(numero)
    if not calle_clean and not numero_clean:
        return ""
    if calle_clean and numero_clean:
        if numero_clean.upper() in {"SN", "S/N"}:
            return calle_clean
        return f"{calle_clean} {numero_clean}".strip()
    return calle_clean or numero_clean


def build_street2_value(trnsvers, barrio, referenc):
    parts = []
    for value in (trnsvers, barrio, referenc):
        txt = safe_text(value)
        if not txt:
            continue
        if txt not in parts:
            parts.append(txt)
    return " | ".join(parts[:3])


def load_client_address_candidates():
    sql = """
    SELECT
        TRIM(TO_CHAR(d.CLTE_IDCLIENTE)) AS CLIENT_ID,
        TRIM(d.PRINCIPAL) AS PRINCIPAL,
        TRIM(d.LUGAR) AS LUGAR,
        TRIM(d.BARRIO) AS BARRIO,
        TRIM(d.CALLE) AS CALLE,
        TRIM(d.TRNSVERS) AS TRNSVERS,
        TRIM(d.NUMERO) AS NUMERO,
        TRIM(d.REFERENC) AS REFERENC,
        TRIM(d.CANT_CODIPROV) AS PROV_CODE,
        TRIM(d.CANT_CODICANT) AS CANTON_CODE,
        TRIM(d.CANT_CODIPARR) AS PARR_CODE,
        TRIM(p.DESCRIPC) AS PROV_NAME,
        TRIM(c.DESCRIPC) AS CANTON_NAME,
        TRIM(pa.DESCRIPC) AS PARR_NAME,
        TO_CHAR(NVL(d.FECHACTU, d.FECHCREA), 'YYYY-MM-DD HH24:MI:SS') AS TS
    FROM SYSTEM.CLI_DIRECCION d
    LEFT JOIN SYSTEM.GEN_PROVINCIA p
      ON p.CODIPROV = d.CANT_CODIPROV
    LEFT JOIN SYSTEM.GEN_CANTON c
      ON c.PVCA_CODIPROV = d.CANT_CODIPROV
     AND c.CODICANT = d.CANT_CODICANT
    LEFT JOIN SYSTEM.GEN_PARROQS pa
      ON pa.CANT_CODIPROV = d.CANT_CODIPROV
     AND pa.CANT_CODICANT = d.CANT_CODICANT
     AND pa.CODIPARR = d.CANT_CODIPARR
    WHERE d.CLTE_IDCLIENTE IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Address source warnings: {len(warnings)}")

    by_client = {}
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        if not client_id:
            continue

        city = safe_text(row.get("LUGAR")) or safe_text(row.get("CANTON_NAME"))
        street = build_street_value(row.get("CALLE"), row.get("NUMERO"))
        street2 = build_street2_value(row.get("TRNSVERS"), row.get("BARRIO"), row.get("REFERENC"))
        prov_code = clean_text(row.get("PROV_CODE"))

        score = 0
        if clean_code(row.get("PRINCIPAL")) == "S":
            score += 100
        if street:
            score += 30
        if city:
            score += 20
        if prov_code:
            score += 10
        if street2:
            score += 5

        candidate = {
            "client_id": client_id,
            "street": street,
            "street2": street2,
            "city": city,
            "state_code": prov_code,
            "country_code": "EC" if prov_code else "",
            "province_name": safe_text(row.get("PROV_NAME")),
            "canton_name": safe_text(row.get("CANTON_NAME")),
            "parish_name": safe_text(row.get("PARR_NAME")),
            "score": score,
            "ts": clean_text(row.get("TS")),
            "source": "CLI_DIRECCION",
        }
        by_client[client_id] = pick_scored_candidate(by_client.get(client_id), candidate)
    return by_client


def load_vendor_name_candidates():
    sql = """
    SELECT code, vendor_name, SUM(cnt) AS CNT
    FROM (
        SELECT TRIM(VNDR_CODIGO) AS code, TRIM(VENDEDOR) AS vendor_name, COUNT(*) AS cnt
        FROM SYSTEM.DWH_VENTAS
        WHERE VNDR_CODIGO IS NOT NULL
          AND TRIM(VNDR_CODIGO) IS NOT NULL
          AND VENDEDOR IS NOT NULL
          AND TRIM(VENDEDOR) IS NOT NULL
        GROUP BY TRIM(VNDR_CODIGO), TRIM(VENDEDOR)
        UNION ALL
        SELECT TRIM(VNDR_CODIGO) AS code, TRIM(VENDEDOR) AS vendor_name, COUNT(*) AS cnt
        FROM SYSTEM.VEN_BODEDATO
        WHERE VNDR_CODIGO IS NOT NULL
          AND TRIM(VNDR_CODIGO) IS NOT NULL
          AND VENDEDOR IS NOT NULL
          AND TRIM(VENDEDOR) IS NOT NULL
        GROUP BY TRIM(VNDR_CODIGO), TRIM(VENDEDOR)
    )
    GROUP BY code, vendor_name
    ORDER BY code, CNT DESC
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Vendor name source warnings: {len(warnings)}")

    by_code = {}
    for row in rows:
        code = clean_code(row.get("CODE"))
        name = safe_text(row.get("VENDOR_NAME"))
        cnt = int(parse_decimal(row.get("CNT")))
        if not code:
            continue
        if code not in by_code:
            by_code[code] = {"name": name or code, "cnt": cnt}
            continue
        current = by_code[code]
        if cnt > current["cnt"] or (cnt == current["cnt"] and len(name) > len(current["name"])):
            by_code[code] = {"name": name or code, "cnt": cnt}
    return {code: data["name"] for code, data in by_code.items()}


def load_client_sales_assignments():
    by_client = {}

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_ID,
            TRIM(TO_CHAR(LSPR_LSPR_ID)) AS LSPR_ID,
            TRIM(VNDR_CODIGO) AS VENDOR_CODE,
            TRIM(PREDEFINIDO) AS PREDEFINIDO,
            TRIM(DISPONIBLE) AS DISPONIBLE,
            TO_CHAR(NVL(FECHACTU, FECHCREA), 'YYYY-MM-DD HH24:MI:SS') AS TS
        FROM SYSTEM.VEN_GRUPOS
        WHERE CLTE_IDCLIENTE IS NOT NULL
        """
    )
    if warnings:
        print(f"VEN_GRUPOS assignment warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        if not client_id:
            continue
        vendor_code = clean_code(row.get("VENDOR_CODE"))
        lspr_id = clean_text(row.get("LSPR_ID"))
        score = 60
        if clean_code(row.get("PREDEFINIDO")) == "S":
            score += 100
        if clean_code(row.get("DISPONIBLE")) == "S":
            score += 20
        if vendor_code:
            score += 10
        if lspr_id:
            score += 5
        if vendor_code == "OFICINA":
            score -= 8
        candidate = {
            "client_id": client_id,
            "vendor_code": vendor_code,
            "lspr_id": lspr_id,
            "score": score,
            "ts": clean_text(row.get("TS")),
            "source": "VEN_GRUPOS",
        }
        by_client[client_id] = pick_scored_candidate(by_client.get(client_id), candidate)

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(TO_CHAR(GRPS_IDCLIENTE)) AS CLIENT_ID,
            TRIM(TO_CHAR(GRPS_LSPR_ID)) AS LSPR_ID,
            TRIM(VNDR_CODIGO) AS VENDOR_CODE,
            TO_CHAR(NVL(FECHACTU, FECHA), 'YYYY-MM-DD HH24:MI:SS') AS TS
        FROM SYSTEM.VEN_VENTAS
        WHERE GRPS_IDCLIENTE IS NOT NULL
        """
    )
    if warnings:
        print(f"VEN_VENTAS assignment warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        if not client_id:
            continue
        vendor_code = clean_code(row.get("VENDOR_CODE"))
        lspr_id = clean_text(row.get("LSPR_ID"))
        score = 30
        if vendor_code:
            score += 8
        if lspr_id:
            score += 5
        candidate = {
            "client_id": client_id,
            "vendor_code": vendor_code,
            "lspr_id": lspr_id,
            "score": score,
            "ts": clean_text(row.get("TS")),
            "source": "VEN_VENTAS",
        }
        by_client[client_id] = pick_scored_candidate(by_client.get(client_id), candidate)

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(CODIGOCLIENTE) AS CLIENT_ID,
            TRIM(CODIGOVENDEDOR) AS VENDOR_CODE
        FROM SYSTEM.AUX_VENTASFAMP
        WHERE CODIGOCLIENTE IS NOT NULL
        """
    )
    if warnings:
        print(f"AUX_VENTASFAMP assignment warnings: {len(warnings)}")
    for row in rows:
        client_id = clean_text(row.get("CLIENT_ID"))
        if not client_id:
            continue
        vendor_code = clean_code(row.get("VENDOR_CODE"))
        if not vendor_code:
            continue
        candidate = {
            "client_id": client_id,
            "vendor_code": vendor_code,
            "lspr_id": "",
            "score": 10,
            "ts": "",
            "source": "AUX_VENTASFAMP",
        }
        by_client[client_id] = pick_scored_candidate(by_client.get(client_id), candidate)

    return by_client


def build_client_business_profiles(client_profiles):
    address_by_client = load_client_address_candidates()
    assign_by_client = load_client_sales_assignments()
    vendor_name_by_code = load_vendor_name_candidates()

    out = {}
    client_ids = set(client_profiles.keys()) | set(address_by_client.keys()) | set(assign_by_client.keys())
    for client_id in client_ids:
        profile = {}
        profile.update(address_by_client.get(client_id, {}))

        assignment = assign_by_client.get(client_id, {})
        vendor_code = clean_code(assignment.get("vendor_code"))
        if vendor_code:
            profile["vendor_code"] = vendor_code
            profile["vendor_name"] = vendor_name_by_code.get(vendor_code, vendor_code)
        else:
            profile["vendor_code"] = ""
            profile["vendor_name"] = ""

        lspr_id = clean_text(assignment.get("lspr_id"))
        profile["lspr_id"] = lspr_id
        profile["assign_source"] = clean_text(assignment.get("source"))
        profile["assign_score"] = int(assignment.get("score", 0))

        if client_id not in out:
            out[client_id] = {}
        out[client_id].update(profile)

    return out


def ensure_partner_records_for_clients(cur, client_profiles):
    partner_by_ref = load_partner_id_by_ref(cur)
    created = 0
    updated = 0
    skipped = 0
    for client_id, profile in client_profiles.items():
        ruc = clean_text(profile.get("ruc", ""))
        name = safe_text(profile.get("name")) or (
            f"CLIENTE {ruc}" if ruc else f"CLIENTE ID {client_id}"
        )
        if ruc:
            exists = ruc in partner_by_ref
            partner_id = upsert_single_partner(cur, ruc, name, ruc)
            partner_by_ref[ruc] = partner_id
            if exists:
                updated += 1
            else:
                created += 1
            continue

        synthetic_ref = f"CLIID-{client_id}"
        exists = synthetic_ref in partner_by_ref
        partner_id = upsert_single_partner(cur, synthetic_ref, name, None)
        partner_by_ref[synthetic_ref] = partner_id
        if exists:
            updated += 1
        else:
            created += 1

    mapped_after = build_client_to_partner_id_map(cur, client_profiles)
    for client_id in client_profiles.keys():
        if client_id not in mapped_after:
            skipped += 1

    return {"created": created, "updated": updated, "unmapped_clients": skipped}


def build_lspr_label(lspr_id):
    lspr_txt = clean_text(lspr_id) or "0"
    if lspr_txt == "0":
        return "Lista ERP General [LSPR:0]"
    return f"Lista ERP {lspr_txt} [LSPR:{lspr_txt}]"


def ensure_pricelists(cur, defaults, lspr_ids):
    wanted = {clean_text(x) for x in lspr_ids if clean_text(x)}
    if not wanted:
        return {"mapping": {}, "created": 0, "existing": 0}

    token_re = re.compile(r"\[LSPR:([0-9]+)\]")
    mapping = {}
    cur.execute(
        """
        SELECT id, COALESCE(name->>'es_EC', name->>'en_US', name::text) AS name_txt
        FROM product_pricelist
        """
    )
    for pricelist_id, name_txt in cur.fetchall():
        txt = clean_text(name_txt)
        m = token_re.search(txt)
        if m:
            mapping[m.group(1)] = pricelist_id

    created = 0
    for lspr_id in sorted(wanted, key=lambda x: int(parse_decimal(x))):
        if lspr_id in mapping:
            continue
        label = build_lspr_label(lspr_id)
        name_json = Json({"en_US": label, "es_EC": label})
        cur.execute(
            """
            INSERT INTO product_pricelist
                (name, currency_id, company_id, active, sequence)
            VALUES
                (%s, %s, %s, true, %s)
            RETURNING id
            """,
            (name_json, defaults["currency_id"], defaults["company_id"], int(parse_decimal(lspr_id))),
        )
        mapping[lspr_id] = cur.fetchone()[0]
        created += 1

    return {"mapping": mapping, "created": created, "existing": len(mapping) - created}


def vendor_login_from_code(code):
    slug = slugify_code(code).lower()
    if not slug:
        slug = "sin_codigo"
    return f"vendor.{slug}@fam.local"


def ensure_sales_users(cur, defaults, vendor_name_by_code):
    if not vendor_name_by_code:
        return {"mapping": {}, "created_users": 0, "created_partners": 0}

    cur.execute("SELECT login, id FROM res_users")
    user_by_login = {clean_text(login): uid for login, uid in cur.fetchall()}

    cur.execute(
        """
        SELECT btrim(ref), id
        FROM res_partner
        WHERE ref IS NOT NULL AND btrim(ref) <> ''
        """
    )
    partner_by_ref = {clean_text(ref): partner_id for ref, partner_id in cur.fetchall()}

    group_ids = []
    cur.execute(
        """
        SELECT module, name, res_id
        FROM ir_model_data
        WHERE model = 'res.groups'
          AND (
            (module = 'base' AND name = 'group_user')
            OR (module = 'sales_team' AND name = 'group_sale_salesman')
          )
        """
    )
    for _module, _name, group_id in cur.fetchall():
        group_ids.append(group_id)

    created_users = 0
    created_partners = 0
    mapping = {}

    for code in sorted(vendor_name_by_code.keys()):
        clean_vendor = clean_code(code)
        if not clean_vendor:
            continue
        vendor_name = safe_text(vendor_name_by_code.get(code)) or clean_vendor

        partner_ref = f"VENDOR-{clean_vendor}"
        partner_id = partner_by_ref.get(partner_ref)
        if not partner_id:
            cur.execute(
                """
                INSERT INTO res_partner
                    (name, ref, active, customer_rank, supplier_rank, autopost_bills,
                     complete_name, type, is_company, group_rfq, group_on)
                VALUES
                    (%s, %s, true, 0, 0, 'never',
                     %s, 'contact', false, 'default', 'default')
                RETURNING id
                """,
                (vendor_name, partner_ref, vendor_name),
            )
            partner_id = cur.fetchone()[0]
            partner_by_ref[partner_ref] = partner_id
            created_partners += 1
        else:
            cur.execute(
                """
                UPDATE res_partner
                SET name = %s,
                    complete_name = %s,
                    active = true
                WHERE id = %s
                """,
                (vendor_name, vendor_name, partner_id),
            )

        login = vendor_login_from_code(clean_vendor)
        user_id = user_by_login.get(login)
        if not user_id:
            cur.execute(
                """
                INSERT INTO res_users
                    (company_id, partner_id, active, login, password, share, notification_type)
                VALUES
                    (%s, %s, true, %s, NULL, false, 'email')
                RETURNING id
                """,
                (defaults["company_id"], partner_id, login),
            )
            user_id = cur.fetchone()[0]
            user_by_login[login] = user_id
            created_users += 1
        else:
            cur.execute(
                """
                UPDATE res_users
                SET company_id = %s,
                    partner_id = %s,
                    active = true,
                    share = false,
                    notification_type = 'email'
                WHERE id = %s
                """,
                (defaults["company_id"], partner_id, user_id),
            )

        cur.execute(
            """
            INSERT INTO res_company_users_rel (cid, user_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (defaults["company_id"], user_id),
        )
        for group_id in group_ids:
            cur.execute(
                """
                INSERT INTO res_groups_users_rel (gid, uid)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (group_id, user_id),
            )
        mapping[clean_vendor] = user_id

    return {
        "mapping": mapping,
        "created_users": created_users,
        "created_partners": created_partners,
    }


def get_ec_location_maps(cur):
    cur.execute("SELECT id FROM res_country WHERE code = 'EC' ORDER BY id LIMIT 1")
    row = cur.fetchone()
    ec_country_id = row[0] if row else None

    state_by_code = {}
    if ec_country_id:
        cur.execute(
            """
            SELECT code, id
            FROM res_country_state
            WHERE country_id = %s
            """,
            (ec_country_id,),
        )
        for code, state_id in cur.fetchall():
            state_by_code[clean_text(code)] = state_id

    return ec_country_id, state_by_code


def apply_client_business_profiles(
    cur,
    defaults,
    client_profiles,
    business_profiles,
    vendor_user_map,
    pricelist_map,
):
    client_partner = build_client_to_partner_id_map(cur, client_profiles)
    ec_country_id, state_by_code = get_ec_location_maps(cur)

    updated = 0
    set_city = 0
    set_street = 0
    set_state = 0
    set_country = 0
    set_vendor = 0
    set_pricelist = 0
    missing_partner = 0

    for client_id, profile in business_profiles.items():
        partner_id = client_partner.get(client_id)
        if not partner_id:
            missing_partner += 1
            continue

        street = safe_text(profile.get("street"))
        street2 = safe_text(profile.get("street2"))
        city = safe_text(profile.get("city"))
        state_code = clean_text(profile.get("state_code"))
        state_id = state_by_code.get(state_code)
        country_id = ec_country_id if state_id or street or city else None

        vendor_code = clean_code(profile.get("vendor_code"))
        user_id = vendor_user_map.get(vendor_code)

        lspr_id = clean_text(profile.get("lspr_id"))
        pricelist_id = pricelist_map.get(lspr_id)
        pricelist_json = None
        if pricelist_id:
            pricelist_json = Json({str(defaults["company_id"]): pricelist_id})

        cur.execute(
            """
            UPDATE res_partner
            SET street = CASE WHEN %s <> '' THEN %s ELSE street END,
                street2 = CASE WHEN %s <> '' THEN %s ELSE street2 END,
                city = CASE WHEN %s <> '' THEN %s ELSE city END,
                state_id = COALESCE(%s, state_id),
                country_id = COALESCE(%s, country_id),
                user_id = COALESCE(%s, user_id),
                specific_property_product_pricelist =
                    CASE
                        WHEN %s IS NOT NULL THEN %s
                        ELSE specific_property_product_pricelist
                    END
            WHERE id = %s
            """,
            (
                street,
                street,
                street2,
                street2,
                city,
                city,
                state_id,
                country_id,
                user_id,
                pricelist_id,
                pricelist_json,
                partner_id,
            ),
        )
        updated += 1
        if city:
            set_city += 1
        if street:
            set_street += 1
        if state_id:
            set_state += 1
        if country_id:
            set_country += 1
        if user_id:
            set_vendor += 1
        if pricelist_id:
            set_pricelist += 1

    return {
        "profiles_total": len(business_profiles),
        "partners_updated": updated,
        "missing_partner": missing_partner,
        "set_city": set_city,
        "set_street": set_street,
        "set_state": set_state,
        "set_country": set_country,
        "set_vendor": set_vendor,
        "set_pricelist": set_pricelist,
    }


def audit_client_business_coverage(cur, client_profiles, business_profiles):
    client_partner = build_client_to_partner_id_map(cur, client_profiles)
    target_clients = set(business_profiles.keys())
    mapped_clients = [cid for cid in target_clients if cid in client_partner]
    mapped_partners = sorted({client_partner[cid] for cid in mapped_clients})

    source_with_street = sum(1 for v in business_profiles.values() if clean_text(v.get("street")))
    source_with_city = sum(1 for v in business_profiles.values() if clean_text(v.get("city")))
    source_with_vendor = sum(1 for v in business_profiles.values() if clean_text(v.get("vendor_code")))
    source_with_pricelist = sum(1 for v in business_profiles.values() if clean_text(v.get("lspr_id")))

    target = {
        "partners_in_scope": 0,
        "with_street": 0,
        "with_city": 0,
        "with_state": 0,
        "with_country": 0,
        "with_vendor": 0,
        "with_pricelist": 0,
    }
    if mapped_partners:
        cur.execute(
            """
            SELECT
                count(*) AS partners_in_scope,
                count(CASE WHEN street IS NOT NULL AND btrim(street) <> '' THEN 1 END) AS with_street,
                count(CASE WHEN city IS NOT NULL AND btrim(city) <> '' THEN 1 END) AS with_city,
                count(CASE WHEN state_id IS NOT NULL THEN 1 END) AS with_state,
                count(CASE WHEN country_id IS NOT NULL THEN 1 END) AS with_country,
                count(CASE WHEN user_id IS NOT NULL THEN 1 END) AS with_vendor,
                count(CASE WHEN specific_property_product_pricelist IS NOT NULL THEN 1 END) AS with_pricelist
            FROM res_partner
            WHERE id = ANY(%s)
            """,
            (mapped_partners,),
        )
        row = cur.fetchone()
        target = {
            "partners_in_scope": row[0],
            "with_street": row[1],
            "with_city": row[2],
            "with_state": row[3],
            "with_country": row[4],
            "with_vendor": row[5],
            "with_pricelist": row[6],
        }

    cur.execute(
        """
        SELECT
            count(*) AS so_total,
            count(CASE WHEN user_id IS NOT NULL THEN 1 END) AS so_with_user,
            count(CASE WHEN pricelist_id IS NOT NULL THEN 1 END) AS so_with_pricelist
        FROM sale_order
        WHERE name LIKE 'SOERP-%'
        """
    )
    so_row = cur.fetchone()

    return {
        "source_clients_total": len(target_clients),
        "source_with_street": source_with_street,
        "source_with_city": source_with_city,
        "source_with_vendor": source_with_vendor,
        "source_with_pricelist": source_with_pricelist,
        "mapped_clients": len(mapped_clients),
        "mapped_partners": len(mapped_partners),
        "target_partner_coverage": target,
        "target_sale_order_coverage": {
            "so_total": so_row[0],
            "so_with_user": so_row[1],
            "so_with_pricelist": so_row[2],
        },
    }


def load_sales_headers():
    sql = """
    SELECT
        TRIM(OFCN_COMPANIA) AS COMPANIA,
        TRIM(OFCN_OFICINA) AS OFICINA,
        TRIM(TPCM_TIPOCOMP) AS TIPOCOMP,
        TRIM(SERIE) AS SERIE,
        TRIM(TO_CHAR(NUMERO)) AS NUMERO,
        TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS FECHA,
        NVL(TOTAL, 0) AS TOTAL,
        TRIM(GRPS_IDCLIENTE) AS CLIENT_ID,
        TRIM(TO_CHAR(GRPS_LSPR_ID)) AS LSPR_ID,
        TRIM(VNDR_CODIGO) AS VENDOR_CODE
    FROM SYSTEM.VEN_VENTAS
    WHERE GRPS_IDCLIENTE IS NOT NULL
      AND TRIM(GRPS_IDCLIENTE) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Sales header warnings: {len(warnings)}")
    return rows


def load_sales_lines():
    sql = """
    SELECT
        TRIM(VNTA_COMPANIA) AS COMPANIA,
        TRIM(VNTA_OFICINA) AS OFICINA,
        TRIM(VNTA_TIPOCOMP) AS TIPOCOMP,
        TRIM(VNTA_SERIE) AS SERIE,
        TRIM(TO_CHAR(VNTA_NUMERO)) AS NUMERO,
        TRIM(ARTL_ARTICULO) AS CODE,
        NVL(CANTIDAD, 0) AS CANTIDAD,
        NVL(PRECUNIT, 0) AS PRECUNIT,
        NVL(VALOR, 0) AS VALOR
    FROM SYSTEM.VEN_DETAPROD
    WHERE ARTL_ARTICULO IS NOT NULL
      AND TRIM(ARTL_ARTICULO) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Sales line warnings: {len(warnings)}")
    return rows


def sales_key(row):
    return (
        clean_text(row.get("COMPANIA")),
        clean_text(row.get("OFICINA")),
        clean_text(row.get("TIPOCOMP")),
        clean_text(row.get("SERIE")),
        clean_text(row.get("NUMERO")),
    )


def build_sales_order_name(key):
    return f"SOERP-{key[0]}-{key[1]}-{key[2]}-{key[3]}-{key[4]}"


def load_product_map_for_lines(cur, default_uom):
    cur.execute(
        """
        SELECT
            pp.default_code,
            pp.id,
            COALESCE(pt.uom_id, %s) AS uom_id,
            COALESCE(pt.name->>'es_EC', pt.name->>'en_US', pp.default_code) AS pname
        FROM product_product pp
        JOIN product_template pt ON pt.id = pp.product_tmpl_id
        WHERE pp.default_code IS NOT NULL AND btrim(pp.default_code) <> ''
        """,
        (default_uom,),
    )
    out = {}
    for code, prod_id, uom_id, pname in cur.fetchall():
        out[clean_text(code)] = {
            "product_id": prod_id,
            "tmpl_id": None,
            "uom_id": uom_id or default_uom,
            "name": clean_text(pname) or clean_text(code),
        }
    return out


def upsert_single_partner(cur, ref, name, vat):
    return upsert_partner_record(
        cur=cur,
        ref=ref,
        vat=vat or "",
        name=name,
        email="",
        phone="",
        street="",
        customer_rank=1,
    )


def ensure_product_exists(cur, defaults, product_map, code):
    code = clean_text(code)
    if not code:
        return None
    if code in product_map:
        return product_map[code]

    name_json = Json({"en_US": code, "es_EC": code})
    cur.execute(
        """
        INSERT INTO product_template
            (name, default_code, sale_ok, purchase_ok, type, active,
             list_price, uom_id, categ_id, service_tracking, tracking, is_storable, invoice_policy)
        VALUES
            (%s, %s, true, true, 'product', true,
             0.0, %s, 1, 'no', 'none', true, 'delivery')
        ON CONFLICT (default_code) DO UPDATE
        SET active = true,
            sale_ok = true,
            purchase_ok = true,
            type = 'product',
            is_storable = true,
            invoice_policy = COALESCE(product_template.invoice_policy, 'delivery')
        RETURNING id, uom_id
        """,
        (name_json, code, defaults["uom_id"]),
    )
    tmpl_id, uom_id = cur.fetchone()

    cur.execute(
        """
        INSERT INTO product_product
            (product_tmpl_id, default_code, active, combination_indices)
        VALUES
            (%s, %s, true, '')
        ON CONFLICT (default_code) DO UPDATE
        SET product_tmpl_id = EXCLUDED.product_tmpl_id,
            active = true
        RETURNING id
        """,
        (tmpl_id, code),
    )
    prod_id = cur.fetchone()[0]
    data = {
        "product_id": prod_id,
        "tmpl_id": tmpl_id,
        "uom_id": uom_id or defaults["uom_id"],
        "name": code,
    }
    product_map[code] = data
    return data


def migrate_sales(
    cur,
    defaults,
    client_profiles,
    client_business_profiles,
    vendor_user_map,
    pricelist_map,
):
    partner_by_ref = load_partner_map_for_sales(cur)

    headers = load_sales_headers()
    lines = load_sales_lines()

    lines_by_key = defaultdict(list)
    for line in lines:
        key = sales_key(line)
        if not all(key):
            continue
        lines_by_key[key].append(line)

    product_map = load_product_map_for_lines(cur, defaults["uom_id"])

    processed_orders = 0
    inserted_lines = 0
    skipped_no_partner = 0
    skipped_bad_key = 0
    created_missing_products = 0
    created_missing_partners = 0
    with_salesperson = 0
    with_pricelist = 0

    for row in headers:
        key = sales_key(row)
        if not all(key):
            skipped_bad_key += 1
            continue

        client_id = clean_text(row.get("CLIENT_ID"))
        profile = client_profiles.get(client_id, {})
        ruc = clean_text(profile.get("ruc", ""))
        profile_name = clean_text(profile.get("name", ""))

        partner_id = partner_by_ref.get(ruc) if ruc else None
        if not partner_id and ruc:
            partner_name = profile_name or f"CLIENTE {ruc}"
            partner_id = upsert_single_partner(cur, ruc, partner_name, ruc)
            partner_by_ref[ruc] = partner_id
            created_missing_partners += 1

        if not partner_id:
            synthetic_ref = f"CLIID-{client_id}"
            partner_name = profile_name or f"CLIENTE ID {client_id}"
            existed = synthetic_ref in partner_by_ref
            partner_id = upsert_single_partner(cur, synthetic_ref, partner_name, None)
            partner_by_ref[synthetic_ref] = partner_id
            if not existed:
                created_missing_partners += 1

        if not partner_id:
            skipped_no_partner += 1
            continue

        profile_extra = client_business_profiles.get(client_id, {})
        vendor_code = clean_code(row.get("VENDOR_CODE")) or clean_code(profile_extra.get("vendor_code"))
        lspr_id = clean_text(row.get("LSPR_ID")) or clean_text(profile_extra.get("lspr_id"))
        order_user_id = vendor_user_map.get(vendor_code)
        order_pricelist_id = pricelist_map.get(lspr_id)
        if order_user_id:
            with_salesperson += 1
        if order_pricelist_id:
            with_pricelist += 1

        order_name = build_sales_order_name(key)
        date_order = parse_datetime(row.get("FECHA"))
        header_total = parse_decimal(row.get("TOTAL"))

        cur.execute(
            """
            INSERT INTO sale_order
                (name, partner_id, partner_invoice_id, partner_shipping_id, date_order,
                 amount_total, amount_untaxed, amount_tax, state, company_id, currency_id,
                 invoice_status, picking_policy, locked, require_signature, require_payment,
                 user_id, pricelist_id)
            VALUES
                (%s, %s, %s, %s, %s,
                 %s, %s, %s, 'sale', %s, %s,
                 'no', 'direct', false, false, false,
                 %s, %s)
            ON CONFLICT (name) DO UPDATE
            SET partner_id = EXCLUDED.partner_id,
                partner_invoice_id = EXCLUDED.partner_invoice_id,
                partner_shipping_id = EXCLUDED.partner_shipping_id,
                date_order = EXCLUDED.date_order,
                amount_total = EXCLUDED.amount_total,
                amount_untaxed = EXCLUDED.amount_untaxed,
                amount_tax = EXCLUDED.amount_tax,
                state = 'sale',
                invoice_status = 'no',
                picking_policy = 'direct',
                user_id = COALESCE(EXCLUDED.user_id, sale_order.user_id),
                pricelist_id = COALESCE(EXCLUDED.pricelist_id, sale_order.pricelist_id)
            RETURNING id
            """,
            (
                order_name,
                partner_id,
                partner_id,
                partner_id,
                date_order,
                header_total,
                header_total,
                Decimal("0"),
                defaults["company_id"],
                defaults["currency_id"],
                order_user_id,
                order_pricelist_id,
            ),
        )
        order_id = cur.fetchone()[0]

        cur.execute("DELETE FROM sale_order_line WHERE order_id = %s", (order_id,))

        subtotal_sum = Decimal("0")
        for line in lines_by_key.get(key, []):
            code = clean_text(line.get("CODE"))
            prod = product_map.get(code)
            if not prod:
                prod = ensure_product_exists(cur, defaults, product_map, code)
                if prod:
                    created_missing_products += 1
                else:
                    continue

            qty = parse_decimal(line.get("CANTIDAD"))
            if qty == 0:
                qty = Decimal("1")
            price = parse_decimal(line.get("PRECUNIT"))
            subtotal = parse_decimal(line.get("VALOR"))
            if subtotal == 0:
                subtotal = qty * price
            subtotal_sum += subtotal

            cur.execute(
                """
                INSERT INTO sale_order_line
                    (order_id, company_id, currency_id, order_partner_id, product_id, product_uom_id,
                     name, product_uom_qty, price_unit, price_subtotal, price_total, customer_lead,
                     state, invoice_status, discount, price_tax)
                VALUES
                    (%s, %s, %s, %s, %s, %s,
                     %s, %s, %s, %s, %s, 0.0,
                     'sale', 'no', 0, 0)
                """,
                (
                    order_id,
                    defaults["company_id"],
                    defaults["currency_id"],
                    partner_id,
                    prod["product_id"],
                    prod["uom_id"],
                    prod["name"],
                    qty,
                    price,
                    subtotal,
                    subtotal,
                ),
            )
            inserted_lines += 1

        final_total = header_total if header_total > 0 else subtotal_sum
        amount_tax = final_total - subtotal_sum
        if amount_tax < 0:
            amount_tax = Decimal("0")
        cur.execute(
            """
            UPDATE sale_order
            SET amount_untaxed = %s,
                amount_tax = %s,
                amount_total = %s
            WHERE id = %s
            """,
            (subtotal_sum, amount_tax, final_total, order_id),
        )

        processed_orders += 1

    return {
        "headers_total": len(headers),
        "orders_upserted": processed_orders,
        "order_lines_inserted": inserted_lines,
        "skipped_no_partner": skipped_no_partner,
        "skipped_bad_key": skipped_bad_key,
        "missing_products_created": created_missing_products,
        "missing_partners_created": created_missing_partners,
        "orders_with_salesperson": with_salesperson,
        "orders_with_pricelist": with_pricelist,
    }


def load_lot_source():
    sql = """
    SELECT
        TRIM(m.ARTL_ARTICULO) AS CODE,
        TRIM(dl.LOTE_NUMELOTE) AS LOT,
        TO_CHAR(l.FVENLOTE, 'YYYY-MM-DD') AS EXPIRY
    FROM SYSTEM.ALM_DETALOTE dl
    JOIN SYSTEM.ALM_DETAMOVI m
      ON dl.DTMV_DTMV_ID = m.DTMV_ID
    JOIN SYSTEM.ALM_LOTE l
      ON dl.LOTE_NUMELOTE = l.NUMELOTE
     AND dl.LOTE_COMPANIA = l.CMPN_COMPANIA
    WHERE l.FVENLOTE IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Lot source warnings: {len(warnings)}")
    return rows


def migrate_lots(cur, defaults):
    cur.execute(
        """
        SELECT pp.default_code, pp.id, pp.product_tmpl_id
        FROM product_product pp
        WHERE pp.default_code IS NOT NULL AND btrim(pp.default_code) <> ''
        """
    )
    product_map = {
        clean_text(code): {"product_id": pid, "tmpl_id": tmpl_id}
        for code, pid, tmpl_id in cur.fetchall()
    }

    rows = load_lot_source()

    upserted = 0
    updated_templates = set()
    skipped_no_product = 0
    seen_triplets = set()
    created_missing_products = 0
    for row in rows:
        code = clean_text(row.get("CODE"))
        lot = clean_text(row.get("LOT"))
        expiry = clean_text(row.get("EXPIRY"))
        if not code or not lot or not expiry:
            continue
        if code not in product_map:
            prod = ensure_product_exists(cur, defaults, product_map, code)
            if prod:
                created_missing_products += 1
            else:
                skipped_no_product += 1
                continue

        product_id = product_map[code]["product_id"]
        tmpl_id = product_map[code]["tmpl_id"]
        triplet = (lot, product_id, defaults["company_id"])
        if triplet in seen_triplets:
            continue
        seen_triplets.add(triplet)

        if tmpl_id not in updated_templates:
            cur.execute(
                """
                UPDATE product_template
                SET tracking = 'lot',
                    use_expiration_date = true,
                    type = 'product',
                    is_storable = true,
                    invoice_policy = COALESCE(invoice_policy, 'delivery')
                WHERE id = %s
                """,
                (tmpl_id,),
            )
            updated_templates.add(tmpl_id)

        cur.execute(
            """
            INSERT INTO stock_lot (name, product_id, company_id, expiration_date, use_date, removal_date, alert_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (name, product_id, company_id) DO UPDATE
            SET expiration_date = COALESCE(EXCLUDED.expiration_date, stock_lot.expiration_date),
                use_date = COALESCE(EXCLUDED.use_date, stock_lot.use_date),
                removal_date = COALESCE(EXCLUDED.removal_date, stock_lot.removal_date),
                alert_date = COALESCE(EXCLUDED.alert_date, stock_lot.alert_date)
            """,
            (lot, product_id, defaults["company_id"], expiry, expiry, expiry, expiry),
        )
        upserted += 1

    return {
        "lot_rows_source": len(rows),
        "lot_upserted": upserted,
        "products_tracking_updated": len(updated_templates),
        "lot_skipped_no_product": skipped_no_product,
        "missing_products_created": created_missing_products,
    }


def choose_internal_stock_location(cur, company_id):
    cur.execute(
        """
        SELECT id
        FROM stock_location
        WHERE usage = 'internal'
          AND active = true
          AND company_id = %s
        ORDER BY id
        LIMIT 1
        """,
        (company_id,),
    )
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute(
        """
        SELECT id
        FROM stock_location
        WHERE usage = 'internal'
          AND active = true
        ORDER BY id
        LIMIT 1
        """
    )
    row = cur.fetchone()
    return row[0] if row else None


def load_inventory_snapshot_source():
    sql = """
    SELECT
        TRIM(ARTL_ARTICULO) AS CODE,
        TRIM(NUMELOTE) AS LOT,
        NVL(EXISTENCIA, 0) AS QTY,
        TO_CHAR(FVECIMIENTO, 'YYYY-MM-DD') AS EXPIRY
    FROM SYSTEM.AUX_INVENTARIO
    WHERE ARTL_ARTICULO IS NOT NULL
      AND TRIM(ARTL_ARTICULO) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Inventory snapshot warnings: {len(warnings)}")

    by_key = {}
    skipped = 0
    for row in rows:
        code = clean_text(row.get("CODE"))
        if not code or any(code.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
            skipped += 1
            continue

        lot = clean_text(row.get("LOT"))
        if is_placeholder(lot):
            lot = ""
        qty = parse_decimal(row.get("QTY"))
        if qty <= 0:
            continue
        expiry = clean_text(row.get("EXPIRY"))
        key = (code, lot)
        if key not in by_key:
            by_key[key] = {"code": code, "lot": lot, "qty": Decimal("0"), "expiry": expiry}
        by_key[key]["qty"] += qty
        if expiry and expiry > clean_text(by_key[key].get("expiry")):
            by_key[key]["expiry"] = expiry

    return list(by_key.values()), skipped


def migrate_stock_quants(cur, defaults):
    location_id = choose_internal_stock_location(cur, defaults["company_id"])
    if not location_id:
        return {
            "inventory_rows_source": 0,
            "inventory_rows_skipped": 0,
            "stock_location_used": None,
            "quant_upserted": 0,
            "lots_upserted": 0,
            "products_updated": 0,
            "total_quantity_loaded": str(Decimal("0")),
            "missing_products_created": 0,
        }

    cur.execute(
        """
        SELECT pp.default_code, pp.id, pp.product_tmpl_id
        FROM product_product pp
        WHERE pp.default_code IS NOT NULL
          AND btrim(pp.default_code) <> ''
        """
    )
    product_map = {
        clean_text(code): {"product_id": pid, "tmpl_id": tmpl_id}
        for code, pid, tmpl_id in cur.fetchall()
    }

    rows, skipped = load_inventory_snapshot_source()
    quant_upserted = 0
    lot_upserted = 0
    products_updated = set()
    total_qty = Decimal("0")
    created_missing_products = 0
    today = datetime.now().date()
    now_ts = datetime.now()

    for row in rows:
        code = clean_text(row.get("code"))
        lot = clean_text(row.get("lot"))
        qty = parse_decimal(row.get("qty"))
        if not code or qty <= 0:
            continue

        prod = product_map.get(code)
        if not prod:
            prod = ensure_product_exists(cur, defaults, product_map, code)
            if not prod:
                continue
            created_missing_products += 1

        product_id = prod["product_id"]
        tmpl_id = prod["tmpl_id"]
        lot_id = None
        expiry_txt = clean_text(row.get("expiry"))
        expiry_dt = parse_datetime_nullable(expiry_txt)

        if lot:
            if tmpl_id and tmpl_id not in products_updated:
                cur.execute(
                    """
                    UPDATE product_template
                    SET tracking = 'lot',
                        use_expiration_date = true,
                        type = 'product',
                        is_storable = true,
                        invoice_policy = COALESCE(invoice_policy, 'delivery')
                    WHERE id = %s
                    """,
                    (tmpl_id,),
                )
                products_updated.add(tmpl_id)

            alert_dt = expiry_dt - timedelta(days=30) if expiry_dt else None
            cur.execute(
                """
                INSERT INTO stock_lot
                    (name, product_id, company_id, expiration_date, use_date, removal_date, alert_date)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (name, product_id, company_id) DO UPDATE
                SET expiration_date = COALESCE(EXCLUDED.expiration_date, stock_lot.expiration_date),
                    use_date = COALESCE(EXCLUDED.use_date, stock_lot.use_date),
                    removal_date = COALESCE(EXCLUDED.removal_date, stock_lot.removal_date),
                    alert_date = COALESCE(EXCLUDED.alert_date, stock_lot.alert_date)
                RETURNING id
                """,
                (
                    lot,
                    product_id,
                    defaults["company_id"],
                    expiry_dt,
                    expiry_dt,
                    expiry_dt,
                    alert_dt,
                ),
            )
            lot_id = cur.fetchone()[0]
            lot_upserted += 1
        elif tmpl_id and tmpl_id not in products_updated:
            cur.execute(
                """
                UPDATE product_template
                SET type = 'product',
                    is_storable = true,
                    invoice_policy = COALESCE(invoice_policy, 'delivery')
                WHERE id = %s
                """,
                (tmpl_id,),
            )
            products_updated.add(tmpl_id)

        cur.execute(
            """
            SELECT id
            FROM stock_quant
            WHERE product_id = %s
              AND location_id = %s
              AND company_id = %s
              AND package_id IS NULL
              AND owner_id IS NULL
              AND (
                    (lot_id IS NULL AND %s IS NULL)
                 OR lot_id = %s
              )
            ORDER BY id
            LIMIT 1
            """,
            (product_id, location_id, defaults["company_id"], lot_id, lot_id),
        )
        row_quant = cur.fetchone()
        if row_quant:
            cur.execute(
                """
                UPDATE stock_quant
                SET quantity = %s,
                    reserved_quantity = 0,
                    inventory_quantity = %s,
                    inventory_diff_quantity = 0,
                    inventory_quantity_set = true,
                    inventory_date = %s,
                    in_date = COALESCE(in_date, %s),
                    expiration_date = COALESCE(%s, expiration_date),
                    removal_date = COALESCE(%s, removal_date)
                WHERE id = %s
                """,
                (
                    qty,
                    qty,
                    today,
                    now_ts,
                    expiry_dt,
                    expiry_dt,
                    row_quant[0],
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO stock_quant
                    (product_id, company_id, location_id, lot_id, quantity,
                     reserved_quantity, inventory_quantity, inventory_diff_quantity,
                     inventory_quantity_set, inventory_date, in_date, expiration_date, removal_date)
                VALUES
                    (%s, %s, %s, %s, %s,
                     0, %s, 0,
                     true, %s, %s, %s, %s)
                """,
                (
                    product_id,
                    defaults["company_id"],
                    location_id,
                    lot_id,
                    qty,
                    qty,
                    today,
                    now_ts,
                    expiry_dt,
                    expiry_dt,
                ),
            )
        quant_upserted += 1
        total_qty += qty

    return {
        "inventory_rows_source": len(rows),
        "inventory_rows_skipped": skipped,
        "stock_location_used": location_id,
        "quant_upserted": quant_upserted,
        "lots_upserted": lot_upserted,
        "products_updated": len(products_updated),
        "total_quantity_loaded": str(total_qty),
        "missing_products_created": created_missing_products,
    }


def choose_better_supplier(current, candidate):
    def score(rec):
        name = clean_text(rec.get("name"))
        return (
            int(rec.get("source_score", 0)),
            1 if name and not name.upper().startswith("PROVEEDOR ") else 0,
            1 if normalize_email(rec.get("email")) else 0,
            1 if normalize_phone(rec.get("phone")) else 0,
            1 if safe_text(rec.get("street")) else 0,
            1 if safe_text(rec.get("city")) else 0,
            len(name),
        )

    return candidate if score(candidate) > score(current) else current


def merge_supplier_candidate(by_ruc, candidate):
    ruc = clean_text(candidate.get("ruc"))
    if not ruc or any(ruc.startswith(pfx) for pfx in SUSPICIOUS_ERROR_PREFIXES):
        return
    candidate["ruc"] = ruc
    if ruc in by_ruc:
        by_ruc[ruc] = choose_better_supplier(by_ruc[ruc], candidate)
    else:
        by_ruc[ruc] = candidate


def load_supplier_source():
    by_ruc = {}
    warnings_total = 0

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(CEDURUC) AS RUC,
            TRIM(NOMBRE) AS NAME,
            TRIM(EMAIL) AS EMAIL,
            TRIM(DIRECCIO) AS STREET,
            TRIM(NUMECALL) AS STREET_NO,
            TRIM(CIUDAD) AS CITY,
            TRIM(CONTACTO) AS CONTACT
        FROM SYSTEM.GEN_TMPPROVEEDOR
        WHERE CEDURUC IS NOT NULL
          AND TRIM(CEDURUC) IS NOT NULL
        """
    )
    warnings_total += len(warnings)
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        street = build_street_value(row.get("STREET"), row.get("STREET_NO"))
        merge_supplier_candidate(
            by_ruc,
            {
                "ruc": ruc,
                "name": safe_text(row.get("NAME")) or f"PROVEEDOR {ruc}",
                "email": normalize_email(row.get("EMAIL")),
                "phone": "",
                "street": street,
                "street2": safe_text(row.get("CONTACT")),
                "city": safe_text(row.get("CITY")),
                "source_score": 120,
            },
        )

    rows, warnings = run_oracle_query_csv(
        """
        SELECT DISTINCT
            TRIM(c.PROV_CEDURUC) AS RUC,
            TRIM(p.NOMBRE) AS NAME,
            TRIM(p.TELEFONO) AS PHONE,
            TRIM(p.CALLE) AS STREET,
            TRIM(p.NUMECALL) AS STREET_NO,
            TRIM(p.INTERSECCION) AS STREET2,
            TRIM(p.CANTON) AS CITY
        FROM SYSTEM.COM_TMPCOMPRAS c
        LEFT JOIN SYSTEM.GEN_PERSCONT p
          ON TRIM(p.CEDURUC) = TRIM(c.PROV_CEDURUC)
        WHERE c.PROV_CEDURUC IS NOT NULL
          AND TRIM(c.PROV_CEDURUC) IS NOT NULL
        """
    )
    warnings_total += len(warnings)
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        street = build_street_value(row.get("STREET"), row.get("STREET_NO"))
        merge_supplier_candidate(
            by_ruc,
            {
                "ruc": ruc,
                "name": safe_text(row.get("NAME")) or f"PROVEEDOR {ruc}",
                "email": "",
                "phone": normalize_phone(row.get("PHONE")),
                "street": street,
                "street2": safe_text(row.get("STREET2")),
                "city": safe_text(row.get("CITY")),
                "source_score": 80,
            },
        )

    rows, warnings = run_oracle_query_csv(
        """
        SELECT DISTINCT
            TRIM(PROV_CEDURUC) AS RUC
        FROM SYSTEM.COM_TMPCOMPRAS
        WHERE PROV_CEDURUC IS NOT NULL
          AND TRIM(PROV_CEDURUC) IS NOT NULL
        """
    )
    warnings_total += len(warnings)
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        merge_supplier_candidate(
            by_ruc,
            {
                "ruc": ruc,
                "name": f"PROVEEDOR {ruc}",
                "email": "",
                "phone": "",
                "street": "",
                "street2": "",
                "city": "",
                "source_score": 10,
            },
        )

    rows, warnings = run_oracle_query_csv(
        """
        SELECT
            TRIM(PROV_CEDURUC) AS RUC,
            TRIM(NUMEFONO) AS PHONE,
            TRIM(PRINCIPAL) AS PRINCIPAL,
            TO_CHAR(NVL(FECHACTU, FECHCREA), 'YYYY-MM-DD HH24:MI:SS') AS TS
        FROM SYSTEM.GEN_TELEFONO
        WHERE PROV_CEDURUC IS NOT NULL
          AND TRIM(PROV_CEDURUC) IS NOT NULL
          AND NUMEFONO IS NOT NULL
          AND TRIM(NUMEFONO) IS NOT NULL
        """
    )
    warnings_total += len(warnings)
    phones_by_ruc = {}
    for row in rows:
        ruc = clean_text(row.get("RUC"))
        phone = normalize_phone(row.get("PHONE"))
        if not ruc or not phone:
            continue
        score = 100 if clean_code(row.get("PRINCIPAL")) == "S" else 90
        ts = clean_text(row.get("TS"))
        current = phones_by_ruc.get(ruc)
        candidate = {"phone": phone, "score": score, "ts": ts}
        if not current or score > current["score"] or (score == current["score"] and ts > current["ts"]):
            phones_by_ruc[ruc] = candidate

    for ruc, phone_rec in phones_by_ruc.items():
        if ruc not in by_ruc:
            by_ruc[ruc] = {
                "ruc": ruc,
                "name": f"PROVEEDOR {ruc}",
                "email": "",
                "phone": phone_rec["phone"],
                "street": "",
                "street2": "",
                "city": "",
                "source_score": 20,
            }
            continue
        if not normalize_phone(by_ruc[ruc].get("phone")):
            by_ruc[ruc]["phone"] = phone_rec["phone"]

    return by_ruc, warnings_total


def upsert_suppliers(cur, supplier_map):
    upserted = 0
    for rec in supplier_map.values():
        ruc = clean_text(rec.get("ruc"))
        if not ruc:
            continue
        partner_id = upsert_partner_record(
            cur=cur,
            ref=ruc,
            vat=ruc,
            name=safe_text(rec.get("name")) or f"PROVEEDOR {ruc}",
            email=normalize_email(rec.get("email")),
            phone=normalize_phone(rec.get("phone")),
            street=safe_text(rec.get("street")),
            street2=safe_text(rec.get("street2")),
            city=safe_text(rec.get("city")),
            customer_rank=0,
            supplier_rank=1,
        )
        cur.execute(
            """
            UPDATE res_partner
            SET supplier_rank = GREATEST(COALESCE(supplier_rank, 0), 1),
                active = true
            WHERE id = %s
            """,
            (partner_id,),
        )
        upserted += 1
    return upserted


def get_purchase_defaults(cur):
    cur.execute(
        """
        SELECT id
        FROM stock_picking_type
        WHERE code = 'incoming'
        ORDER BY id
        LIMIT 1
        """
    )
    row = cur.fetchone()
    picking_type_id = row[0] if row else None
    return {"incoming_picking_type_id": picking_type_id}


def ensure_generic_purchase_product(cur, defaults):
    code = "ERP-COMPRA-SIN-DETALLE"
    cur.execute(
        """
        SELECT pp.id, COALESCE(pt.uom_id, %s) AS uom_id
        FROM product_product pp
        JOIN product_template pt ON pt.id = pp.product_tmpl_id
        WHERE pp.default_code = %s
        ORDER BY pp.id
        LIMIT 1
        """,
        (defaults["uom_id"], code),
    )
    row = cur.fetchone()
    if row:
        return {"product_id": row[0], "uom_id": row[1] or defaults["uom_id"], "name": code}

    name = "Compra ERP sin detalle de items"
    name_json = Json({"en_US": name, "es_EC": name})
    cur.execute(
        """
        INSERT INTO product_template
            (name, default_code, sale_ok, purchase_ok, type, active,
             list_price, uom_id, categ_id, service_tracking, tracking, is_storable, invoice_policy)
        VALUES
            (%s, %s, false, true, 'service', true,
             0.0, %s, 1, 'no', 'none', false, 'order')
        RETURNING id, uom_id
        """,
        (name_json, code, defaults["uom_id"]),
    )
    tmpl_id, uom_id = cur.fetchone()
    cur.execute(
        """
        INSERT INTO product_product
            (product_tmpl_id, default_code, active, combination_indices)
        VALUES
            (%s, %s, true, '')
        RETURNING id
        """,
        (tmpl_id, code),
    )
    product_id = cur.fetchone()[0]
    return {"product_id": product_id, "uom_id": uom_id or defaults["uom_id"], "name": name}


def purchase_key(row):
    return (
        clean_text(row.get("COMPANIA")),
        clean_text(row.get("OFICINA")),
        clean_text(row.get("SERIE")),
        clean_text(row.get("NUMERO")),
        clean_text(row.get("ALCANCE")),
    )


def build_purchase_order_name(key):
    return f"POERP-{key[0]}-{key[1]}-{key[2]}-{key[3]}-{key[4]}"


def load_purchase_headers():
    sql = """
    SELECT
        TRIM(OFCN_COMPANIA) AS COMPANIA,
        TRIM(OFCN_OFICINA) AS OFICINA,
        TRIM(SERIE) AS SERIE,
        TRIM(TO_CHAR(NUMERO)) AS NUMERO,
        TRIM(TO_CHAR(ALCANCE)) AS ALCANCE,
        TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS') AS FECHA,
        NVL(TOTAL, 0) AS TOTAL,
        TRIM(PROV_CEDURUC) AS RUC,
        TRIM(DESCRIPC) AS DESCRIPC,
        TRIM(REFER) AS REFER
    FROM SYSTEM.COM_TMPCOMPRAS
    WHERE PROV_CEDURUC IS NOT NULL
      AND TRIM(PROV_CEDURUC) IS NOT NULL
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Purchase header warnings: {len(warnings)}")

    by_key = {}
    for row in rows:
        key = purchase_key(row)
        if not all(key):
            continue
        if key not in by_key:
            by_key[key] = row
            continue
        ts_a = clean_text(by_key[key].get("FECHA"))
        ts_b = clean_text(row.get("FECHA"))
        if ts_b > ts_a:
            by_key[key] = row
    return list(by_key.values())


def migrate_purchase_orders(cur, defaults, supplier_map):
    purchase_defaults = get_purchase_defaults(cur)
    incoming_type_id = purchase_defaults.get("incoming_picking_type_id")
    if not incoming_type_id:
        return {
            "headers_total": 0,
            "orders_upserted": 0,
            "order_lines_inserted": 0,
            "missing_incoming_type": True,
            "missing_supplier_created": 0,
        }

    generic_product = ensure_generic_purchase_product(cur, defaults)
    headers = load_purchase_headers()
    partner_by_ref = load_partner_id_by_ref(cur)
    orders_upserted = 0
    order_lines_inserted = 0
    missing_supplier_created = 0

    for row in headers:
        key = purchase_key(row)
        if not all(key):
            continue
        ruc = clean_text(row.get("RUC"))
        partner_id = partner_by_ref.get(ruc)
        if not partner_id and ruc:
            supplier = supplier_map.get(ruc, {})
            partner_id = upsert_partner_record(
                cur=cur,
                ref=ruc,
                vat=ruc,
                name=safe_text(supplier.get("name")) or f"PROVEEDOR {ruc}",
                email=normalize_email(supplier.get("email")),
                phone=normalize_phone(supplier.get("phone")),
                street=safe_text(supplier.get("street")),
                street2=safe_text(supplier.get("street2")),
                city=safe_text(supplier.get("city")),
                customer_rank=0,
                supplier_rank=1,
            )
            partner_by_ref[ruc] = partner_id
            missing_supplier_created += 1

        if not partner_id:
            continue

        order_name = build_purchase_order_name(key)
        date_order = parse_datetime(row.get("FECHA"))
        total = parse_decimal(row.get("TOTAL"))
        if total < 0:
            total = Decimal("0")

        cur.execute("SELECT id FROM purchase_order WHERE name = %s ORDER BY id LIMIT 1", (order_name,))
        existing = cur.fetchone()
        if existing:
            order_id = existing[0]
            cur.execute(
                """
                UPDATE purchase_order
                SET partner_id = %s,
                    currency_id = %s,
                    company_id = %s,
                    date_order = %s,
                    picking_type_id = %s,
                    state = 'purchase',
                    invoice_status = 'no',
                    amount_untaxed = %s,
                    amount_tax = 0,
                    amount_total = %s
                WHERE id = %s
                """,
                (
                    partner_id,
                    defaults["currency_id"],
                    defaults["company_id"],
                    date_order,
                    incoming_type_id,
                    total,
                    total,
                    order_id,
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO purchase_order
                    (partner_id, currency_id, company_id, name, date_order, picking_type_id,
                     state, invoice_status, amount_untaxed, amount_tax, amount_total, user_id)
                VALUES
                    (%s, %s, %s, %s, %s, %s,
                     'purchase', 'no', %s, 0, %s, NULL)
                RETURNING id
                """,
                (
                    partner_id,
                    defaults["currency_id"],
                    defaults["company_id"],
                    order_name,
                    date_order,
                    incoming_type_id,
                    total,
                    total,
                ),
            )
            order_id = cur.fetchone()[0]

        cur.execute("DELETE FROM purchase_order_line WHERE order_id = %s", (order_id,))
        description = safe_text(row.get("DESCRIPC")) or safe_text(row.get("REFER")) or generic_product["name"]
        cur.execute(
            """
            INSERT INTO purchase_order_line
                (order_id, company_id, partner_id, product_id, product_uom_id, name,
                 product_qty, product_uom_qty, price_unit, price_subtotal, price_total,
                 qty_received, qty_invoiced, qty_to_invoice, is_downpayment, date_planned,
                 discount, price_tax, technical_price_unit)
            VALUES
                (%s, %s, %s, %s, %s, %s,
                 1, 1, %s, %s, %s,
                 0, 0, 1, false, %s,
                 0, 0, %s)
            """,
            (
                order_id,
                defaults["company_id"],
                partner_id,
                generic_product["product_id"],
                generic_product["uom_id"],
                description,
                total,
                total,
                total,
                date_order,
                total,
            ),
        )
        order_lines_inserted += 1
        orders_upserted += 1

    return {
        "headers_total": len(headers),
        "orders_upserted": orders_upserted,
        "order_lines_inserted": order_lines_inserted,
        "missing_incoming_type": False,
        "missing_supplier_created": missing_supplier_created,
    }


def configure_partial_delivery(cur):
    stats = {}
    cur.execute(
        """
        UPDATE stock_picking_type
        SET create_backorder = 'ask',
            reservation_method = 'at_confirm',
            use_existing_lots = true
        WHERE code = 'outgoing'
        """
    )
    stats["outgoing_picking_types_configured"] = cur.rowcount

    cur.execute(
        """
        UPDATE stock_picking_type
        SET create_backorder = 'ask',
            reservation_method = 'at_confirm',
            use_create_lots = true
        WHERE code = 'incoming'
        """
    )
    stats["incoming_picking_types_configured"] = cur.rowcount

    cur.execute(
        """
        UPDATE sale_order
        SET picking_policy = 'direct'
        WHERE name LIKE 'SOERP-%'
          AND COALESCE(picking_policy, '') <> 'direct'
        """
    )
    stats["sale_orders_direct_policy"] = cur.rowcount

    cur.execute(
        """
        UPDATE product_template
        SET invoice_policy = 'delivery'
        WHERE type = 'product'
          AND sale_ok = true
          AND COALESCE(invoice_policy, '') <> 'delivery'
        """
    )
    stats["products_invoice_policy_delivery"] = cur.rowcount

    cur.execute(
        """
        UPDATE product_template pt
        SET tracking = 'lot',
            use_expiration_date = true,
            type = 'product',
            is_storable = true
        FROM product_product pp
        WHERE pt.id = pp.product_tmpl_id
          AND EXISTS (
            SELECT 1
            FROM stock_lot sl
            WHERE sl.product_id = pp.id
          )
        """
    )
    stats["products_lot_tracked_aligned"] = cur.rowcount
    return stats


def audit_oracle_functional_tables():
    prefix_sql = " OR ".join([f"table_name LIKE '{p}_%'" for p in FUNCTIONAL_PREFIXES])
    sql = f"""
    SELECT table_name, NVL(num_rows, 0) AS NUM_ROWS
    FROM all_tables
    WHERE owner = 'SYSTEM'
      AND ({prefix_sql})
    ORDER BY table_name
    """
    rows, warnings = run_oracle_query_csv(sql)
    by_prefix = defaultdict(lambda: {"tables": 0, "rows": 0})
    top_tables = []
    for row in rows:
        table = clean_text(row.get("TABLE_NAME"))
        num_rows = int(parse_decimal(row.get("NUM_ROWS")))
        prefix = table.split("_", 1)[0] if "_" in table else table[:3]
        by_prefix[prefix]["tables"] += 1
        by_prefix[prefix]["rows"] += num_rows
        top_tables.append({"table": table, "rows": num_rows})
    top_tables.sort(key=lambda x: x["rows"], reverse=True)
    return {
        "warnings": warnings,
        "total_tables": len(rows),
        "by_prefix": dict(sorted(by_prefix.items(), key=lambda x: (-x[1]["rows"], x[0]))),
        "top_tables": top_tables[:40],
    }


def audit_odoo_operational_status(cur):
    checks = {
        "partners_customers": "SELECT count(*) FROM res_partner WHERE customer_rank > 0 AND active = true",
        "partners_suppliers": "SELECT count(*) FROM res_partner WHERE supplier_rank > 0 AND active = true",
        "products_total": "SELECT count(*) FROM product_template",
        "products_storable": "SELECT count(*) FROM product_template WHERE type = 'product'",
        "products_with_sale_price": "SELECT count(*) FROM product_template WHERE list_price IS NOT NULL AND list_price > 0",
        "products_with_cost_price": "SELECT count(*) FROM product_product WHERE standard_price IS NOT NULL",
        "products_lot_tracked": "SELECT count(*) FROM product_template WHERE tracking = 'lot'",
        "products_with_expiry": "SELECT count(*) FROM product_template WHERE use_expiration_date = true",
        "stock_lots": "SELECT count(*) FROM stock_lot",
        "stock_quants": "SELECT count(*) FROM stock_quant",
        "sales_orders_soerp": "SELECT count(*) FROM sale_order WHERE name LIKE 'SOERP-%'",
        "sales_lines_total": "SELECT count(*) FROM sale_order_line",
        "purchase_orders_poerp": "SELECT count(*) FROM purchase_order WHERE name LIKE 'POERP-%'",
        "purchase_lines_total": "SELECT count(*) FROM purchase_order_line",
        "account_moves_total": "SELECT count(*) FROM account_move",
        "hr_employees_total": "SELECT count(*) FROM hr_employee",
        "stock_pickings_total": "SELECT count(*) FROM stock_picking",
        "stock_moves_total": "SELECT count(*) FROM stock_move",
        "stock_move_lines_total": "SELECT count(*) FROM stock_move_line",
    }
    out = {}
    for key, sql in checks.items():
        cur.execute(sql)
        out[key] = cur.fetchone()[0]
    return out


def audit_required_modules(cur):
    wanted = sorted({m for modules in REQUIRED_ODOO_MODULES.values() for m in modules})
    cur.execute(
        """
        SELECT name, state
        FROM ir_module_module
        WHERE name = ANY(%s)
        """,
        (wanted,),
    )
    states = {name: state for name, state in cur.fetchall()}
    missing_not_found = [name for name in wanted if name not in states]
    for name in missing_not_found:
        states[name] = "not_found"

    by_domain = {}
    for domain, modules in REQUIRED_ODOO_MODULES.items():
        installed = [m for m in modules if states.get(m) == "installed"]
        missing = [m for m in modules if states.get(m) != "installed"]
        by_domain[domain] = {
            "installed": installed,
            "missing": missing,
            "ready": len(missing) == 0,
        }

    return {
        "states": dict(sorted(states.items())),
        "missing_not_found": missing_not_found,
        "by_domain": by_domain,
    }


def write_full_audit_report(oracle_audit, odoo_audit, module_audit, migration_stats):
    reports_dir = Path("reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = reports_dir / f"AUDITORIA_INTEGRAL_ODOO_{stamp}.md"

    lines = []
    lines.append("# Auditoria Integral Oracle -> Odoo")
    lines.append("")
    lines.append(f"- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- Oracle tablas funcionales detectadas: {oracle_audit.get('total_tables', 0)}")
    lines.append("")
    lines.append("## 1) Cobertura Oracle por prefijo")
    lines.append("")
    lines.append("| Prefijo | Tablas | Filas (stats Oracle) |")
    lines.append("| --- | ---: | ---: |")
    for pref, data in oracle_audit.get("by_prefix", {}).items():
        lines.append(f"| {pref} | {data.get('tables', 0)} | {data.get('rows', 0)} |")

    lines.append("")
    lines.append("## 2) Top tablas Oracle por volumen")
    lines.append("")
    lines.append("| Tabla | Filas (stats Oracle) |")
    lines.append("| --- | ---: |")
    for rec in oracle_audit.get("top_tables", [])[:20]:
        lines.append(f"| {rec.get('table')} | {rec.get('rows', 0)} |")

    lines.append("")
    lines.append("## 3) Estado operativo Odoo")
    lines.append("")
    for key in sorted(odoo_audit.keys()):
        lines.append(f"- `{key}`: {odoo_audit[key]}")

    lines.append("")
    lines.append("## 4) Modulos Odoo requeridos")
    lines.append("")
    for domain, info in module_audit.get("by_domain", {}).items():
        status = "OK" if info.get("ready") else "PENDIENTE"
        installed = ", ".join(info.get("installed", [])) or "-"
        missing = ", ".join(info.get("missing", [])) or "-"
        lines.append(f"- `{domain}`: {status}")
        lines.append(f"  instalados: {installed}")
        lines.append(f"  faltantes: {missing}")

    if module_audit.get("missing_not_found"):
        lines.append("")
        lines.append("### Modulos no encontrados en esta distribucion")
        for name in module_audit["missing_not_found"]:
            lines.append(f"- `{name}`")

    lines.append("")
    lines.append("## 5) Estadisticas de corrida de migracion")
    lines.append("")
    for key, value in migration_stats.items():
        lines.append(f"- `{key}`: {json.dumps(value, ensure_ascii=False)}")

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(report_path.resolve())


def postprocess_partners(cur):
    cur.execute(
        """
        UPDATE res_partner
        SET complete_name = name
        WHERE ref IS NOT NULL
          AND btrim(ref) <> ''
          AND (complete_name IS NULL OR btrim(complete_name) = '' OR complete_name IS DISTINCT FROM name)
        """
    )
    complete_name_fixed = cur.rowcount

    cur.execute(
        """
        UPDATE res_partner
        SET commercial_partner_id = id
        WHERE ref IS NOT NULL
          AND btrim(ref) <> ''
          AND commercial_partner_id IS NULL
        """
    )
    commercial_fixed = cur.rowcount

    cur.execute(
        """
        UPDATE res_partner
        SET type = 'contact'
        WHERE ref IS NOT NULL
          AND btrim(ref) <> ''
          AND (type IS NULL OR btrim(type) = '')
        """
    )
    type_fixed = cur.rowcount

    cur.execute(
        """
        UPDATE res_partner
        SET is_company = false
        WHERE ref IS NOT NULL
          AND btrim(ref) <> ''
          AND is_company IS NULL
        """
    )
    is_company_fixed = cur.rowcount

    cur.execute(
        """
        UPDATE res_partner
        SET autopost_bills = 'never',
            group_rfq = 'default',
            group_on = 'default'
        WHERE ref IS NOT NULL
          AND btrim(ref) <> ''
        """
    )
    base_fields_fixed = cur.rowcount

    return {
        "complete_name_fixed": complete_name_fixed,
        "commercial_partner_fixed": commercial_fixed,
        "type_fixed": type_fixed,
        "is_company_fixed": is_company_fixed,
        "base_fields_fixed": base_fields_fixed,
    }


def validate_counts(cur):
    checks = {
        "odoo_partners_with_ref": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> ''",
        "odoo_partners_missing_name": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND (name IS NULL OR btrim(name) = '')",
        "odoo_partners_missing_complete_name": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND (complete_name IS NULL OR btrim(complete_name) = '')",
        "odoo_partners_missing_commercial": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND commercial_partner_id IS NULL",
        "odoo_partners_with_street": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND street IS NOT NULL AND btrim(street) <> ''",
        "odoo_partners_with_city": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND city IS NOT NULL AND btrim(city) <> ''",
        "odoo_partners_with_state": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND state_id IS NOT NULL",
        "odoo_partners_with_country": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND country_id IS NOT NULL",
        "odoo_partners_with_salesperson": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND user_id IS NOT NULL",
        "odoo_partners_with_pricelist": "SELECT count(*) FROM res_partner WHERE ref IS NOT NULL AND btrim(ref) <> '' AND specific_property_product_pricelist IS NOT NULL",
        "odoo_suppliers_active": "SELECT count(*) FROM res_partner WHERE supplier_rank > 0 AND active = true",
        "odoo_products_codes": "SELECT count(*) FROM product_template WHERE default_code IS NOT NULL AND btrim(default_code) <> ''",
        "odoo_products_storable": "SELECT count(*) FROM product_template WHERE type = 'product'",
        "odoo_products_invoice_delivery": "SELECT count(*) FROM product_template WHERE type = 'product' AND sale_ok = true AND invoice_policy = 'delivery'",
        "odoo_products_with_sale_price": "SELECT count(*) FROM product_template WHERE list_price IS NOT NULL AND list_price > 0",
        "odoo_products_with_cost_price": "SELECT count(*) FROM product_product WHERE standard_price IS NOT NULL",
        "odoo_sales_soerp": "SELECT count(*) FROM sale_order WHERE name LIKE 'SOERP-%'",
        "odoo_sales_soerp_with_salesperson": "SELECT count(*) FROM sale_order WHERE name LIKE 'SOERP-%' AND user_id IS NOT NULL",
        "odoo_sales_soerp_with_pricelist": "SELECT count(*) FROM sale_order WHERE name LIKE 'SOERP-%' AND pricelist_id IS NOT NULL",
        "odoo_sales_lines": "SELECT count(*) FROM sale_order_line",
        "odoo_lots": "SELECT count(*) FROM stock_lot",
        "odoo_quants": "SELECT count(*) FROM stock_quant",
        "odoo_purchase_poerp": "SELECT count(*) FROM purchase_order WHERE name LIKE 'POERP-%'",
        "odoo_purchase_lines": "SELECT count(*) FROM purchase_order_line",
    }
    out = {}
    for key, sql in checks.items():
        cur.execute(sql)
        out[key] = cur.fetchone()[0]
    return out


def validate_oracle_counts():
    sql = """
    SELECT 'AUX_CLIENTE_DISTINCT_RUC' AS METRIC, count(distinct trim(RUC)) AS CNT
    FROM SYSTEM.AUX_CLIENTE
    WHERE RUC IS NOT NULL AND trim(RUC) IS NOT NULL
    UNION ALL
    SELECT 'AUX_INVENTARIO_DISTINCT_CODE', count(distinct trim(ARTL_ARTICULO))
    FROM SYSTEM.AUX_INVENTARIO
    WHERE ARTL_ARTICULO IS NOT NULL AND trim(ARTL_ARTICULO) IS NOT NULL
    UNION ALL
    SELECT 'VEN_VENTAS_TOTAL', count(*)
    FROM SYSTEM.VEN_VENTAS
    UNION ALL
    SELECT 'VEN_DETAPROD_TOTAL', count(*)
    FROM SYSTEM.VEN_DETAPROD
    UNION ALL
    SELECT 'CLI_DIRECCION_CLIENTS', count(distinct trim(to_char(CLTE_IDCLIENTE)))
    FROM SYSTEM.CLI_DIRECCION
    UNION ALL
    SELECT 'VEN_GRUPOS_CLIENTS', count(distinct trim(to_char(CLTE_IDCLIENTE)))
    FROM SYSTEM.VEN_GRUPOS
    UNION ALL
    SELECT 'VEN_GRUPOS_WITH_VENDOR', count(*)
    FROM SYSTEM.VEN_GRUPOS
    WHERE VNDR_CODIGO IS NOT NULL
      AND trim(VNDR_CODIGO) IS NOT NULL
    UNION ALL
    SELECT 'VEN_GRUPOS_WITH_LSPR', count(*)
    FROM SYSTEM.VEN_GRUPOS
    WHERE LSPR_LSPR_ID IS NOT NULL
    UNION ALL
    SELECT 'GEN_TMPPROVEEDOR_DISTINCT_RUC', count(distinct trim(CEDURUC))
    FROM SYSTEM.GEN_TMPPROVEEDOR
    WHERE CEDURUC IS NOT NULL AND trim(CEDURUC) IS NOT NULL
    UNION ALL
    SELECT 'COM_TMPCOMPRAS_TOTAL', count(*)
    FROM SYSTEM.COM_TMPCOMPRAS
    UNION ALL
    SELECT 'COM_TMPCOMPRAS_DISTINCT_PROV', count(distinct trim(PROV_CEDURUC))
    FROM SYSTEM.COM_TMPCOMPRAS
    WHERE PROV_CEDURUC IS NOT NULL AND trim(PROV_CEDURUC) IS NOT NULL
    UNION ALL
    SELECT 'AUX_INVENTARIO_POSITIVE_QTY', count(*)
    FROM SYSTEM.AUX_INVENTARIO
    WHERE ARTL_ARTICULO IS NOT NULL
      AND trim(ARTL_ARTICULO) IS NOT NULL
      AND NVL(EXISTENCIA,0) > 0
    UNION ALL
    SELECT 'LOT_DISTINCT_TRIPLET',
           count(*)
    FROM (
      SELECT DISTINCT m.ARTL_ARTICULO, dl.LOTE_NUMELOTE, l.CMPN_COMPANIA
      FROM SYSTEM.ALM_DETALOTE dl
      JOIN SYSTEM.ALM_DETAMOVI m ON dl.DTMV_DTMV_ID = m.DTMV_ID
      JOIN SYSTEM.ALM_LOTE l ON dl.LOTE_NUMELOTE = l.NUMELOTE AND dl.LOTE_COMPANIA = l.CMPN_COMPANIA
      WHERE l.FVENLOTE IS NOT NULL
    )
    """
    rows, warnings = run_oracle_query_csv(sql)
    if warnings:
        print(f"Oracle validation warnings: {len(warnings)}")
    out = {}
    for row in rows:
        out[clean_text(row.get("METRIC"))] = int(parse_decimal(row.get("CNT")))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Starting Oracle -> Odoo ERP migration...")

    conn = psycopg2.connect(**POSTGRES_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        migration_stats = {}
        defaults = get_odoo_defaults(cur)
        print(f"Odoo defaults: {defaults}")

        cleanup_stats = cleanup_suspicious_rows(cur)
        ref_stats = normalize_existing_partner_refs(cur)
        print("Cleanup:", cleanup_stats)
        print("Ref normalize:", ref_stats)
        migration_stats["cleanup"] = cleanup_stats
        migration_stats["ref_normalize"] = ref_stats

        partner_map, partner_skipped = load_partner_source()
        partner_map_ventas, partner_skipped_ventas = load_partner_source_from_aux_ventasfamp()
        for ruc, rec in partner_map_ventas.items():
            if ruc in partner_map:
                partner_map[ruc] = choose_better_partner(partner_map[ruc], rec)
            else:
                partner_map[ruc] = rec
        fallback_rucs = load_partner_fallback_from_saldo()
        for ruc in sorted(fallback_rucs):
            if ruc not in partner_map:
                partner_map[ruc] = {
                    "ruc": ruc,
                    "name": f"CLIENTE {ruc}",
                    "email": "",
                    "phone": "",
                    "street": "",
                }
        partners_written = upsert_partners(cur, partner_map)
        print(
            f"Partners source={len(partner_map)} skipped_aux_cliente={partner_skipped} "
            f"skipped_aux_ventasfamp={partner_skipped_ventas} upserted={partners_written}"
        )
        migration_stats["partners"] = {
            "source": len(partner_map),
            "skipped_aux_cliente": partner_skipped,
            "skipped_aux_ventasfamp": partner_skipped_ventas,
            "upserted": partners_written,
        }

        supplier_map, supplier_warning_count = load_supplier_source()
        suppliers_written = upsert_suppliers(cur, supplier_map)
        print(
            f"Suppliers source={len(supplier_map)} warnings={supplier_warning_count} upserted={suppliers_written}"
        )
        migration_stats["suppliers"] = {
            "source": len(supplier_map),
            "warnings": supplier_warning_count,
            "upserted": suppliers_written,
        }

        product_map, product_skipped = load_product_source()
        products_written = upsert_products(cur, product_map, defaults)
        print(
            f"Products source={len(product_map)} skipped={product_skipped} upserted={products_written}"
        )
        migration_stats["products"] = {
            "source": len(product_map),
            "skipped": product_skipped,
            "upserted": products_written,
        }

        product_price_stats = apply_product_prices(cur, defaults)
        print("Product prices:", product_price_stats)
        migration_stats["product_prices"] = product_price_stats

        client_profiles = load_oracle_client_profiles()
        print(f"Client profiles loaded: {len(client_profiles)}")
        migration_stats["client_profiles"] = {"loaded": len(client_profiles)}

        partner_profile_stats = ensure_partner_records_for_clients(cur, client_profiles)
        print("Partner sync from client profiles:", partner_profile_stats)
        migration_stats["partner_profile_sync"] = partner_profile_stats

        blocked_emails = load_overused_client_emails(min_clients=20)
        cleared_emails = clear_suspicious_partner_emails(cur, blocked_emails)
        print(
            f"Suspicious emails blocked={len(blocked_emails)} "
            f"partner_emails_cleared={cleared_emails}"
        )
        migration_stats["suspicious_emails"] = {
            "blocked": len(blocked_emails),
            "cleared": cleared_emails,
        }

        contact_stats = enrich_partner_contacts(cur, client_profiles, blocked_emails=blocked_emails)
        print("Partner contacts:", contact_stats)
        migration_stats["partner_contacts"] = contact_stats

        client_business_profiles = build_client_business_profiles(client_profiles)
        print(f"Client business profiles loaded: {len(client_business_profiles)}")
        migration_stats["client_business_profiles"] = {"loaded": len(client_business_profiles)}

        vendor_name_by_code = {}
        for profile in client_business_profiles.values():
            code = clean_code(profile.get("vendor_code"))
            if not code:
                continue
            name = safe_text(profile.get("vendor_name")) or code
            if code not in vendor_name_by_code or len(name) > len(vendor_name_by_code[code]):
                vendor_name_by_code[code] = name
        sales_users = ensure_sales_users(cur, defaults, vendor_name_by_code)
        vendor_user_map = sales_users["mapping"]
        print("Sales users:", {k: sales_users[k] for k in ("created_users", "created_partners")})
        migration_stats["sales_users"] = {
            "created_users": sales_users.get("created_users", 0),
            "created_partners": sales_users.get("created_partners", 0),
            "mapped": len(vendor_user_map),
        }

        lspr_ids = {clean_text(p.get("lspr_id")) for p in client_business_profiles.values()}
        lspr_ids = {x for x in lspr_ids if x}
        pricelist_stats = ensure_pricelists(cur, defaults, lspr_ids)
        pricelist_map = pricelist_stats["mapping"]
        print("Pricelist sync:", {k: pricelist_stats[k] for k in ("created", "existing")})
        migration_stats["pricelists"] = {
            "created": pricelist_stats.get("created", 0),
            "existing": pricelist_stats.get("existing", 0),
            "mapped": len(pricelist_map),
        }

        partner_business_stats = apply_client_business_profiles(
            cur,
            defaults,
            client_profiles,
            client_business_profiles,
            vendor_user_map,
            pricelist_map,
        )
        print("Partner business fields:", partner_business_stats)
        migration_stats["partner_business_fields"] = partner_business_stats

        sales_stats = migrate_sales(
            cur,
            defaults,
            client_profiles,
            client_business_profiles,
            vendor_user_map,
            pricelist_map,
        )
        print("Sales:", sales_stats)
        migration_stats["sales"] = sales_stats

        lot_stats = migrate_lots(cur, defaults)
        print("Lots:", lot_stats)
        migration_stats["lots"] = lot_stats

        stock_quant_stats = migrate_stock_quants(cur, defaults)
        print("Stock quants:", stock_quant_stats)
        migration_stats["stock_quants"] = stock_quant_stats

        purchase_stats = migrate_purchase_orders(cur, defaults, supplier_map)
        print("Purchases:", purchase_stats)
        migration_stats["purchases"] = purchase_stats

        partial_delivery_stats = configure_partial_delivery(cur)
        print("Partial delivery config:", partial_delivery_stats)
        migration_stats["partial_delivery"] = partial_delivery_stats

        partner_fix_stats = postprocess_partners(cur)
        print("Partner postprocess:", partner_fix_stats)
        migration_stats["partner_postprocess"] = partner_fix_stats

        business_audit = audit_client_business_coverage(cur, client_profiles, client_business_profiles)
        print("Business coverage audit:", json.dumps(business_audit, ensure_ascii=False, indent=2))
        migration_stats["business_coverage"] = business_audit

        oracle_functional_audit = audit_oracle_functional_tables()
        print(
            "Oracle functional audit:",
            json.dumps(
                {
                    "total_tables": oracle_functional_audit.get("total_tables"),
                    "top_prefixes": list(oracle_functional_audit.get("by_prefix", {}).keys())[:8],
                    "warnings": len(oracle_functional_audit.get("warnings", [])),
                },
                ensure_ascii=False,
            ),
        )
        migration_stats["oracle_functional_audit"] = {
            "total_tables": oracle_functional_audit.get("total_tables", 0),
            "warnings": len(oracle_functional_audit.get("warnings", [])),
        }

        conn.commit()
        print("Migration committed.")

        oracle_counts = validate_oracle_counts()
        odoo_counts = validate_counts(cur)
        odoo_operational_audit = audit_odoo_operational_status(cur)
        module_audit = audit_required_modules(cur)
        report_path = write_full_audit_report(
            oracle_functional_audit,
            odoo_operational_audit,
            module_audit,
            migration_stats,
        )
        print("Oracle baseline counts:", json.dumps(oracle_counts, ensure_ascii=False, indent=2))
        print("Odoo final counts:", json.dumps(odoo_counts, ensure_ascii=False, indent=2))
        print("Odoo operational audit:", json.dumps(odoo_operational_audit, ensure_ascii=False, indent=2))
        print("Module audit:", json.dumps(module_audit, ensure_ascii=False, indent=2))
        print(f"Full audit report: {report_path}")

    except Exception as exc:
        conn.rollback()
        print("Migration failed; transaction rolled back.")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
