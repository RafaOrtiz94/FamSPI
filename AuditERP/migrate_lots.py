import psycopg2
import subprocess
import sys
import json
from datetime import datetime

# Configuración Oracle
ORACLE_CONN = "SYSTEM/FamDb@XE"
ORACLE_EXE = "sqlplus"

# Configuración Odoo PostgreSQL
POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "user": "postgres",
    "password": "FamDb",
    "dbname": "OdooFAM"
}

def run_oracle_query_concat(sql_cols, table, where="rownum <= 5000"):
    cols_concat = " || '|' || ".join(sql_cols)
    query = f"select {cols_concat} from {table} where {where}"
    
    script = (
        "set pagesize 0 feedback off verify off heading off echo off\n"
        "set linesize 32767\n"
        "set trimout on\n"
        "set trimspool on\n"
        f"{query};\n"
        "exit\n"
    )
    cp = subprocess.run(
        [ORACLE_EXE, "-S", ORACLE_CONN],
        input=script,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    
    results = []
    for line in cp.stdout.splitlines():
        l = line.strip()
        if not l or l.startswith('ORA-') or l.startswith('ERROR:'):
            continue
        results.append([p.strip() for p in l.split('|')])
    return results

def get_odoo_defaults():
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT id FROM res_company LIMIT 1")
    company_id = cur.fetchone()[0]
    cur.close()
    conn.close()
    return {"company_id": company_id}

def migrate_lots_and_expiry():
    print("Fetching lots and expiry from Oracle...")
    data = run_oracle_query_concat(
        ["m.ARTL_ARTICULO", "dl.LOTE_NUMELOTE", "TO_CHAR(l.FVENLOTE, 'YYYY-MM-DD')"],
        "SYSTEM.ALM_DETALOTE dl JOIN SYSTEM.ALM_DETAMOVI m ON dl.DTMV_DTMV_ID = m.DTMV_ID JOIN SYSTEM.ALM_LOTE l ON dl.LOTE_NUMELOTE = l.NUMELOTE AND dl.LOTE_COMPANIA = l.CMPN_COMPANIA",
        "l.FVENLOTE IS NOT NULL AND rownum <= 5000"
    )

    if not data:
        print("No lot data found in Oracle.")
        return

    defaults = get_odoo_defaults()
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cur = conn.cursor()

    # Get product mapping (default_code -> product_product.id)
    cur.execute("SELECT default_code, id, product_tmpl_id FROM product_product WHERE default_code IS NOT NULL")
    product_map = {row[0]: (row[1], row[2]) for row in cur.fetchall()}

    count = 0
    updated_products = set()

    for parts in data:
        if len(parts) < 3: continue
        art_code, lot_name, expiry_date = parts[0], parts[1], parts[2]

        if art_code not in product_map:
            continue

        product_id, tmpl_id = product_map[art_code]

        if tmpl_id not in updated_products:
            cur.execute("UPDATE product_template SET tracking = 'lot', use_expiration_date = true WHERE id = %s", (tmpl_id,))
            updated_products.add(tmpl_id)

        try:
            # Odoo 17 stock_lot does not have 'active' col by default
            cur.execute("""
                INSERT INTO stock_lot (name, product_id, company_id, expiration_date)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (name, product_id, company_id) DO UPDATE SET
                    expiration_date = EXCLUDED.expiration_date
            """, (lot_name, product_id, defaults['company_id'], expiry_date))
            count += 1
        except Exception as e:
            conn.rollback()
            continue

    conn.commit()
    cur.close()
    conn.close()
    print(f"Successfully migrated {count} lots and updated {len(updated_products)} products for tracking.")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        # Ensure unique constraint for ON CONFLICT
        conn = psycopg2.connect(**POSTGRES_CONFIG)
        cur = conn.cursor()
        try:
            cur.execute("ALTER TABLE stock_lot ADD CONSTRAINT stock_lot_name_product_company_unique UNIQUE (name, product_id, company_id)")
            conn.commit()
        except:
            conn.rollback()
        cur.close()
        conn.close()
        
        migrate_lots_and_expiry()
    except Exception as e:
        print(f"Lot migration failed: {e}")
