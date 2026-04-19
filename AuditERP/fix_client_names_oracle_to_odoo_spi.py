import argparse
import csv
import io
import os
import re
import shutil
import subprocess
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import psycopg2


GENERIC_NAME_RE = re.compile(r"^(CLIENTE( ID)?\s+\d+|RUC\s+ODOO-.*)$", re.IGNORECASE)


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def is_generic_name(value):
    txt = clean_text(value)
    if not txt:
        return True
    return bool(GENERIC_NAME_RE.match(txt))


def run_oracle_query_csv(sql, oracle_conn, oracle_exe):
    script = (
        "set pagesize 0 feedback off verify off heading on echo off termout off\n"
        "set trimspool on linesize 32767\n"
        "set markup csv on quote on\n"
        f"{sql.strip().rstrip(';')};\n"
        "exit\n"
    )
    cp = subprocess.run(
        [oracle_exe, "-S", oracle_conn],
        input=script.encode("utf-8"),
        capture_output=True,
        check=False,
    )
    stdout = cp.stdout.decode("cp1252", errors="replace")
    lines = []
    started = False
    for raw in stdout.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("ORA-") or line.startswith("SP2-") or line == "ERROR:":
            continue
        if not started and line.startswith('"'):
            started = True
        if started:
            lines.append(line)
    if not lines:
        return []
    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    return [{k.strip().upper(): clean_text(v) for k, v in row.items() if k is not None} for row in reader]


def pick_better_name(current_name, candidate_name, current_source_rank, candidate_source_rank):
    current_generic = is_generic_name(current_name)
    candidate_generic = is_generic_name(candidate_name)

    if candidate_generic:
        return current_name, current_source_rank
    if not current_name:
        return candidate_name, candidate_source_rank
    if current_generic and not candidate_generic:
        return candidate_name, candidate_source_rank
    if not current_generic and not candidate_generic and candidate_source_rank < current_source_rank:
        return candidate_name, candidate_source_rank
    return current_name, current_source_rank


def build_oracle_name_map(oracle_conn, oracle_exe):
    sources = [
        (
            1,
            "AUX_CLIENTE",
            """
            SELECT TRIM(RUC) AS RUC, TRIM(NOMBRE) AS NOMBRE
            FROM SYSTEM.AUX_CLIENTE
            WHERE RUC IS NOT NULL AND TRIM(RUC) IS NOT NULL
            """,
        ),
        (
            2,
            "AUX_VENTASFAMP",
            """
            SELECT TRIM(RUC) AS RUC, TRIM(RAZONSOCIAL) AS NOMBRE
            FROM SYSTEM.AUX_VENTASFAMP
            WHERE RUC IS NOT NULL AND TRIM(RUC) IS NOT NULL
            """,
        ),
        (
            3,
            "AUX_SALDO_CLIENTE",
            """
            SELECT TRIM(RUC) AS RUC, TRIM(CLIENTE) AS NOMBRE
            FROM SYSTEM.AUX_SALDO_CLIENTE
            WHERE RUC IS NOT NULL AND TRIM(RUC) IS NOT NULL
            """,
        ),
    ]

    by_ruc = {}
    for rank, source_name, sql in sources:
        rows = run_oracle_query_csv(sql, oracle_conn=oracle_conn, oracle_exe=oracle_exe)
        for row in rows:
            ruc = clean_text(row.get("RUC"))
            name = clean_text(row.get("NOMBRE"))
            if not ruc:
                continue
            current = by_ruc.get(ruc, {"name": "", "source_rank": 999, "source": ""})
            chosen_name, chosen_rank = pick_better_name(
                current["name"],
                name,
                current["source_rank"],
                rank,
            )
            if chosen_name != current["name"] or chosen_rank != current["source_rank"]:
                by_ruc[ruc] = {"name": chosen_name, "source_rank": chosen_rank, "source": source_name}
            elif ruc not in by_ruc:
                by_ruc[ruc] = current

    clean_map = {}
    for ruc, rec in by_ruc.items():
        name = clean_text(rec.get("name"))
        if name and not is_generic_name(name):
            clean_map[ruc] = name
    return clean_map


def build_oracle_code_name_map(oracle_conn, oracle_exe):
    sources = [
        (
            1,
            "AUX_CLIENTE",
            """
            SELECT TRIM(CODCLIEN) AS CLIENT_CODE, TRIM(NOMBRE) AS NOMBRE
            FROM SYSTEM.AUX_CLIENTE
            WHERE CODCLIEN IS NOT NULL AND TRIM(CODCLIEN) IS NOT NULL
            """,
        ),
        (
            2,
            "AUX_VENTASFAMP",
            """
            SELECT TRIM(CODIGOCLIENTE) AS CLIENT_CODE, TRIM(RAZONSOCIAL) AS NOMBRE
            FROM SYSTEM.AUX_VENTASFAMP
            WHERE CODIGOCLIENTE IS NOT NULL AND TRIM(CODIGOCLIENTE) IS NOT NULL
            """,
        ),
        (
            3,
            "CLI_CORPORATIVO",
            """
            SELECT TRIM(TO_CHAR(CLTE_IDCLIENTE)) AS CLIENT_CODE, TRIM(DANOMACT) AS NOMBRE
            FROM SYSTEM.CLI_CORPORATIVO
            WHERE CLTE_IDCLIENTE IS NOT NULL AND TRIM(TO_CHAR(CLTE_IDCLIENTE)) IS NOT NULL
            """,
        ),
    ]

    by_code = {}
    for rank, source_name, sql in sources:
        rows = run_oracle_query_csv(sql, oracle_conn=oracle_conn, oracle_exe=oracle_exe)
        for row in rows:
            code = clean_text(row.get("CLIENT_CODE"))
            name = clean_text(row.get("NOMBRE"))
            if not code:
                continue
            current = by_code.get(code, {"name": "", "source_rank": 999, "source": ""})
            chosen_name, chosen_rank = pick_better_name(
                current["name"],
                name,
                current["source_rank"],
                rank,
            )
            if chosen_name != current["name"] or chosen_rank != current["source_rank"]:
                by_code[code] = {"name": chosen_name, "source_rank": chosen_rank, "source": source_name}
            elif code not in by_code:
                by_code[code] = current

    clean_map = {}
    for code, rec in by_code.items():
        name = clean_text(rec.get("name"))
        if name and not is_generic_name(name):
            clean_map[code] = name
    return clean_map


def discover_oracle_code_name_sources(oracle_conn, oracle_exe, owner="SYSTEM"):
    """
    Descubre tablas Oracle con columnas candidatas para mapear CLIENT_CODE -> NOMBRE.
    Esto permite agregar fuentes funcionales sin hardcode por cada tabla nueva.
    """
    owner = clean_text(owner or "SYSTEM").upper()
    sql = f"""
        SELECT
          TABLE_NAME,
          MAX(CASE WHEN COLUMN_NAME IN ('CODCLIEN', 'CODIGOCLIENTE', 'CLTE_IDCLIENTE', 'IDCLIENTE', 'CLIENTE_ID', 'ID_CLIENTE') THEN COLUMN_NAME END) AS CODE_COL,
          MAX(CASE WHEN COLUMN_NAME IN ('NOMBRE', 'RAZONSOCIAL', 'RAZON_SOCIAL', 'CLIENTE', 'DANOMACT', 'NOMBRECLIENTE', 'NOMCLIENTE') THEN COLUMN_NAME END) AS NAME_COL
        FROM ALL_TAB_COLUMNS
        WHERE OWNER = '{owner}'
          AND COLUMN_NAME IN (
            'CODCLIEN', 'CODIGOCLIENTE', 'CLTE_IDCLIENTE', 'IDCLIENTE', 'CLIENTE_ID', 'ID_CLIENTE',
            'NOMBRE', 'RAZONSOCIAL', 'RAZON_SOCIAL', 'CLIENTE', 'DANOMACT', 'NOMBRECLIENTE', 'NOMCLIENTE'
          )
        GROUP BY TABLE_NAME
        HAVING
          MAX(CASE WHEN COLUMN_NAME IN ('CODCLIEN', 'CODIGOCLIENTE', 'CLTE_IDCLIENTE', 'IDCLIENTE', 'CLIENTE_ID', 'ID_CLIENTE') THEN 1 ELSE 0 END) = 1
          AND
          MAX(CASE WHEN COLUMN_NAME IN ('NOMBRE', 'RAZONSOCIAL', 'RAZON_SOCIAL', 'CLIENTE', 'DANOMACT', 'NOMBRECLIENTE', 'NOMCLIENTE') THEN 1 ELSE 0 END) = 1
        ORDER BY TABLE_NAME
    """
    rows = run_oracle_query_csv(sql, oracle_conn=oracle_conn, oracle_exe=oracle_exe)
    sources = []
    for row in rows:
        table_name = clean_text(row.get("TABLE_NAME")).upper()
        code_col = clean_text(row.get("CODE_COL")).upper()
        name_col = clean_text(row.get("NAME_COL")).upper()
        if not table_name or not code_col or not name_col:
            continue
        source_name = f"{owner}.{table_name}"
        source_sql = f"""
            SELECT TRIM(TO_CHAR({code_col})) AS CLIENT_CODE, TRIM({name_col}) AS NOMBRE
            FROM {owner}.{table_name}
            WHERE {code_col} IS NOT NULL
              AND TRIM(TO_CHAR({code_col})) IS NOT NULL
        """
        sources.append((source_name, source_sql))
    return sources


def load_code_name_map_from_csv(path):
    """
    CSV manual complementario con columnas CLIENT_CODE/NOMBRE
    (también acepta CODE/NAME o CLIENTE_ID/NOMBRE_CANONICO).
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"No existe archivo de mapeo: {file_path}")

    with file_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        output = {}
        for row in reader:
            normalized = {clean_text(k).upper(): clean_text(v) for k, v in row.items() if k is not None}
            code = (
                normalized.get("CLIENT_CODE")
                or normalized.get("CODE")
                or normalized.get("CLIENTE_ID")
                or normalized.get("CODIGOCLIENTE")
                or normalized.get("CODCLIEN")
            )
            name = (
                normalized.get("NOMBRE")
                or normalized.get("NAME")
                or normalized.get("NOMBRE_CANONICO")
                or normalized.get("RAZONSOCIAL")
            )
            code = clean_text(code)
            name = clean_text(name)
            if not code or not name or is_generic_name(name):
                continue
            output[code] = name
        return output


def get_spi_password(project_id):
    env_password = clean_text(os.getenv("SPI_DB_PASSWORD"))
    if env_password:
        return env_password
    if shutil.which("gcloud") is None:
        return ""
    try:
        cp = subprocess.run(
            ["gcloud", "secrets", "versions", "access", "latest", "--secret=DB_PASSWORD", f"--project={project_id}"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return ""
    return clean_text(cp.stdout)


def ensure_connection(config):
    conn = psycopg2.connect(**config)
    conn.autocommit = False
    return conn


def repair_odoo(odoo_config, ruc_to_name, code_to_name, apply_changes):
    conn = ensure_connection(odoo_config)
    cur = conn.cursor()
    stats = defaultdict(int)
    try:
        for ruc, canonical_name in ruc_to_name.items():
            cur.execute(
                """
                SELECT id, COALESCE(name, '')
                FROM res_partner
                WHERE customer_rank > 0
                  AND (
                    btrim(COALESCE(ref, '')) = %s
                    OR btrim(COALESCE(vat, '')) = %s
                  )
                """,
                (ruc, ruc),
            )
            rows = cur.fetchall()
            if not rows:
                continue
            for partner_id, current_name in rows:
                stats["candidates"] += 1
                if not is_generic_name(current_name):
                    stats["already_ok"] += 1
                    continue
                stats["to_update"] += 1
                if apply_changes:
                    cur.execute(
                        """
                        UPDATE res_partner
                        SET name = %s,
                            complete_name = %s,
                            write_date = NOW()
                        WHERE id = %s
                        """,
                        (canonical_name, canonical_name, partner_id),
                    )
                    stats["updated"] += cur.rowcount

        cur.execute(
            """
            SELECT id, COALESCE(name, ''), COALESCE(ref, '')
            FROM res_partner
            WHERE customer_rank > 0
              AND ref LIKE 'CLIID-%'
            """,
        )
        for partner_id, current_name, ref in cur.fetchall():
            client_code = clean_text(ref).replace("CLIID-", "", 1)
            canonical_name = code_to_name.get(client_code)
            if not canonical_name:
                continue
            stats["candidates_code"] += 1
            if not is_generic_name(current_name):
                stats["already_ok_code"] += 1
                continue
            stats["to_update_code"] += 1
            if apply_changes:
                cur.execute(
                    """
                    UPDATE res_partner
                    SET name = %s,
                        complete_name = %s,
                        write_date = NOW()
                    WHERE id = %s
                    """,
                    (canonical_name, canonical_name, partner_id),
                )
                stats["updated"] += cur.rowcount
        if apply_changes:
            conn.commit()
        else:
            conn.rollback()
    finally:
        cur.close()
        conn.close()
    return dict(stats)


def repair_spi(spi_config, ruc_to_name, odoo_config, apply_changes):
    conn = ensure_connection(spi_config)
    cur = conn.cursor()
    stats = defaultdict(int)
    try:
        for ruc, canonical_name in ruc_to_name.items():
            cur.execute(
                """
                SELECT id, COALESCE(commercial_name, ''), COALESCE(shipping_contact_name, '')
                FROM client_requests
                WHERE LOWER(COALESCE(status, '')) = 'approved'
                  AND btrim(COALESCE(ruc_cedula, '')) = %s
                """,
                (ruc,),
            )
            rows = cur.fetchall()
            if not rows:
                continue
            for client_id, commercial_name, shipping_contact_name in rows:
                stats["candidates"] += 1
                needs_commercial = is_generic_name(commercial_name)
                needs_contact = is_generic_name(shipping_contact_name)
                if not needs_commercial and not needs_contact:
                    stats["already_ok"] += 1
                    continue
                stats["to_update"] += 1
                if apply_changes:
                    cur.execute(
                        """
                        UPDATE client_requests
                        SET commercial_name = CASE
                              WHEN commercial_name IS NULL OR btrim(commercial_name) = '' OR commercial_name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$'
                              THEN %s
                              ELSE commercial_name
                            END,
                            shipping_contact_name = CASE
                              WHEN shipping_contact_name IS NULL OR btrim(shipping_contact_name) = '' OR shipping_contact_name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$'
                              THEN %s
                              ELSE shipping_contact_name
                            END,
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (canonical_name, canonical_name, client_id),
                    )
                    stats["updated"] += cur.rowcount

        odoo_conn = ensure_connection(odoo_config)
        odoo_cur = odoo_conn.cursor()
        try:
            odoo_cur.execute(
                """
                SELECT id, COALESCE(name, '')
                FROM res_partner
                WHERE customer_rank > 0
                """,
            )
            odoo_name_by_id = {
                str(partner_id): clean_text(name)
                for partner_id, name in odoo_cur.fetchall()
                if clean_text(name) and not is_generic_name(name)
            }
            odoo_conn.rollback()
        finally:
            odoo_cur.close()
            odoo_conn.close()

        cur.execute(
            """
            SELECT id, COALESCE(commercial_name, ''), COALESCE(shipping_contact_name, ''), COALESCE(external_id, '')
            FROM client_requests
            WHERE LOWER(COALESCE(status, '')) = 'approved'
              AND LOWER(COALESCE(external_source, '')) = 'odoo'
              AND external_id IS NOT NULL
            """,
        )
        for client_id, commercial_name, shipping_contact_name, external_id in cur.fetchall():
            canonical_name = odoo_name_by_id.get(clean_text(external_id))
            if not canonical_name:
                continue
            stats["candidates_external"] += 1
            needs_commercial = is_generic_name(commercial_name)
            needs_contact = is_generic_name(shipping_contact_name)
            if not needs_commercial and not needs_contact:
                stats["already_ok_external"] += 1
                continue
            stats["to_update_external"] += 1
            if apply_changes:
                cur.execute(
                    """
                    UPDATE client_requests
                    SET commercial_name = CASE
                          WHEN commercial_name IS NULL OR btrim(commercial_name) = '' OR commercial_name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$'
                          THEN %s
                          ELSE commercial_name
                        END,
                        shipping_contact_name = CASE
                          WHEN shipping_contact_name IS NULL OR btrim(shipping_contact_name) = '' OR shipping_contact_name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$'
                          THEN %s
                          ELSE shipping_contact_name
                        END,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (canonical_name, canonical_name, client_id),
                )
                stats["updated"] += cur.rowcount
        if apply_changes:
            conn.commit()
        else:
            conn.rollback()
    finally:
        cur.close()
        conn.close()
    return dict(stats)


def count_generics_odoo(odoo_config):
    conn = ensure_connection(odoo_config)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT count(*)
            FROM res_partner
            WHERE customer_rank > 0
              AND (name IS NULL OR btrim(name) = '' OR name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$')
            """,
        )
        count = cur.fetchone()[0]
        conn.rollback()
        return count
    finally:
        cur.close()
        conn.close()


def count_generics_spi(spi_config):
    conn = ensure_connection(spi_config)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT count(*)
            FROM client_requests
            WHERE LOWER(COALESCE(status, '')) = 'approved'
              AND (commercial_name IS NULL OR btrim(commercial_name) = '' OR commercial_name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$')
            """,
        )
        count = cur.fetchone()[0]
        conn.rollback()
        return count
    finally:
        cur.close()
        conn.close()


def export_unresolved_cliid_template(odoo_config, output_csv):
    conn = ensure_connection(odoo_config)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
              REPLACE(COALESCE(ref, ''), 'CLIID-', '') AS client_code,
              COALESCE(ref, '') AS ref,
              COALESCE(name, '') AS current_name,
              COALESCE(email, '') AS email,
              COALESCE(phone, '') AS phone,
              COALESCE(street, '') AS street,
              COALESCE(city, '') AS city,
              COALESCE(vat, '') AS vat
            FROM res_partner
            WHERE customer_rank > 0
              AND COALESCE(ref, '') LIKE 'CLIID-%'
              AND (name IS NULL OR btrim(name) = '' OR name ~* '^(CLIENTE( ID)?\\s+[0-9]+|RUC\\s+ODOO-.*)$')
            ORDER BY id
            """,
        )
        rows = cur.fetchall()
    finally:
        conn.rollback()
        cur.close()
        conn.close()

    output_path = Path(output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "CLIENT_CODE",
                "NOMBRE",
                "REF",
                "CURRENT_NAME",
                "EMAIL",
                "PHONE",
                "STREET",
                "CITY",
                "VAT",
            ]
        )
        for client_code, ref, current_name, email, phone, street, city, vat in rows:
            writer.writerow(
                [
                    clean_text(client_code),
                    "",
                    clean_text(ref),
                    clean_text(current_name),
                    clean_text(email),
                    clean_text(phone),
                    clean_text(street),
                    clean_text(city),
                    clean_text(vat),
                ]
            )
    return len(rows), str(output_path)


def main():
    parser = argparse.ArgumentParser(description="Corrige nombres de clientes (Odoo + SPI) usando fuente Oracle.")
    parser.add_argument("--apply", action="store_true", help="Aplica cambios. Sin este flag solo simula.")
    parser.add_argument("--oracle-conn", default="SYSTEM/FamDb@XE")
    parser.add_argument("--oracle-exe", default="sqlplus")
    parser.add_argument("--oracle-owner", default="SYSTEM")
    parser.add_argument(
        "--extra-code-map-csv",
        default="",
        help="CSV opcional con mapeo CLIENT_CODE->NOMBRE para completar los CLIID sin nombre.",
    )
    parser.add_argument("--project-id", default="famspi-sbox")
    parser.add_argument("--spi-host", default="ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech")
    parser.add_argument("--spi-port", type=int, default=5432)
    parser.add_argument("--spi-user", default="neondb_owner")
    parser.add_argument("--spi-db", default="FamSPI")
    parser.add_argument("--odoo-host", default="localhost")
    parser.add_argument("--odoo-port", type=int, default=5433)
    parser.add_argument("--odoo-user", default="odoo")
    parser.add_argument("--odoo-password", default="odoo123")
    parser.add_argument("--odoo-db", default="OdooFAM")
    parser.add_argument(
        "--export-unresolved-csv",
        default="",
        help="Exporta CSV de CLIID pendientes con contexto para completar NOMBRE canónico.",
    )
    args = parser.parse_args()

    spi_password = get_spi_password(args.project_id)
    if not spi_password:
        raise RuntimeError("No se pudo obtener SPI DB_PASSWORD (env SPI_DB_PASSWORD o gcloud secret).")

    spi_config = {
        "host": args.spi_host,
        "port": args.spi_port,
        "user": args.spi_user,
        "password": spi_password,
        "dbname": args.spi_db,
        "sslmode": "require",
    }
    odoo_config = {
        "host": args.odoo_host,
        "port": args.odoo_port,
        "user": args.odoo_user,
        "password": args.odoo_password,
        "dbname": args.odoo_db,
    }

    print(f"[mode] {'APPLY' if args.apply else 'DRY-RUN'}")
    before_odoo = count_generics_odoo(odoo_config)
    before_spi = count_generics_spi(spi_config)
    print(f"[before] Odoo generic names: {before_odoo}")
    print(f"[before] SPI generic names:  {before_spi}")

    ruc_to_name = build_oracle_name_map(args.oracle_conn, args.oracle_exe)
    code_to_name = build_oracle_code_name_map(args.oracle_conn, args.oracle_exe)
    discovered_sources = discover_oracle_code_name_sources(
        args.oracle_conn,
        args.oracle_exe,
        owner=args.oracle_owner,
    )
    static_source_names = {"SYSTEM.AUX_CLIENTE", "SYSTEM.AUX_VENTASFAMP", "SYSTEM.CLI_CORPORATIVO"}
    discovered_sources = [entry for entry in discovered_sources if entry[0] not in static_source_names]
    dynamic_added = 0
    for idx, (source_name, sql) in enumerate(discovered_sources, start=1):
        rows = run_oracle_query_csv(sql, oracle_conn=args.oracle_conn, oracle_exe=args.oracle_exe)
        rank = 100 + idx
        for row in rows:
            code = clean_text(row.get("CLIENT_CODE"))
            name = clean_text(row.get("NOMBRE"))
            if not code:
                continue
            current_name = code_to_name.get(code, "")
            chosen_name, _ = pick_better_name(current_name, name, 999 if not current_name else 1, rank)
            if chosen_name and not is_generic_name(chosen_name):
                if code not in code_to_name or code_to_name[code] != chosen_name:
                    code_to_name[code] = chosen_name
                    dynamic_added += 1

    csv_added = 0
    if clean_text(args.extra_code_map_csv):
        csv_map = load_code_name_map_from_csv(args.extra_code_map_csv)
        for code, name in csv_map.items():
            if code not in code_to_name or is_generic_name(code_to_name.get(code, "")):
                code_to_name[code] = name
                csv_added += 1

    print(f"[oracle] canonical names by RUC: {len(ruc_to_name)}")
    print(f"[oracle] canonical names by CODE: {len(code_to_name)}")
    print(f"[oracle] dynamic sources discovered: {len(discovered_sources)}")
    print(f"[oracle] CODE names added from dynamic sources: {dynamic_added}")
    if clean_text(args.extra_code_map_csv):
        print(f"[oracle] CODE names added from CSV: {csv_added}")

    odoo_stats = repair_odoo(odoo_config, ruc_to_name, code_to_name, apply_changes=args.apply)
    spi_stats = repair_spi(spi_config, ruc_to_name, odoo_config, apply_changes=args.apply)
    print(f"[odoo] stats: {odoo_stats}")
    print(f"[spi]  stats: {spi_stats}")

    after_odoo = count_generics_odoo(odoo_config)
    after_spi = count_generics_spi(spi_config)
    print(f"[after] Odoo generic names: {after_odoo}")
    print(f"[after] SPI generic names:  {after_spi}")

    export_path = clean_text(args.export_unresolved_csv)
    if export_path:
        count_rows, saved_path = export_unresolved_cliid_template(odoo_config, export_path)
        print(f"[export] unresolved CLIID rows: {count_rows}")
        print(f"[export] csv: {saved_path}")
    elif after_odoo > 0:
        default_dir = Path("AuditERP") / "reports"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_path = default_dir / f"UNRESOLVED_CLIID_TEMPLATE_{timestamp}.csv"
        count_rows, saved_path = export_unresolved_cliid_template(odoo_config, str(default_path))
        print(f"[export] unresolved CLIID rows: {count_rows}")
        print(f"[export] csv: {saved_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[error] {exc}")
        raise SystemExit(1)
