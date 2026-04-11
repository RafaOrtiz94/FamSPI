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
    # Concatenamos las columnas con un delimitador único
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
    cur.execute("SELECT id FROM uom_uom ORDER BY id LIMIT 1")
    uom_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM res_company LIMIT 1")
    company_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM res_currency WHERE name = 'USD'")
    currency_id = cur.fetchone()
    currency_id = currency_id[0] if currency_id else 1
    cur.close()
    conn.close()
    return {"uom_id": uom_id, "company_id": company_id, "currency_id": currency_id}

def migrate_partners():
    print("Migrating Partners from AUX_CLIENTE...")
    # SQL cols: NOMBRE, RUC, EMAIL, TELEFCLIEN, DIRECCION
    data = run_oracle_query_concat(["NOMBRE", "RUC", "EMAIL", "TELEFCLIEN", "DIRECCION"], "SYSTEM.AUX_CLIENTE", "1=1")
    
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cur = conn.cursor()
    count = 0
    for parts in data:
        if len(parts) < 2: continue
        name = parts[0]
        vat = parts[1]
        email = parts[2] if len(parts) > 2 else ""
        phone = parts[3] if len(parts) > 3 else ""
        street = parts[4] if len(parts) > 4 else ""
        
        if not vat: continue
        try:
            cur.execute("""
                INSERT INTO res_partner (name, ref, vat, email, phone, street, active, customer_rank, autopost_bills, display_name, complete_name, type)
                VALUES (%s, %s, %s, %s, %s, %s, true, 1, 'never', %s, %s, 'contact')
                ON CONFLICT (ref) DO UPDATE SET
                    name = EXCLUDED.name,
                    vat = EXCLUDED.vat,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    street = EXCLUDED.street,
                    display_name = EXCLUDED.display_name,
                    complete_name = EXCLUDED.complete_name
            """, (name, vat, vat, email, phone, street, name, name))
            count += 1
        except:
            conn.rollback()
    conn.commit()
    cur.close()
    conn.close()
    print(f"Migrated {count} partners.")

def migrate_products():
    print("Migrating Products...")
    data = run_oracle_query_concat(["ARTL_ARTICULO", "NOMBRE"], "SYSTEM.AUX_INVENTARIO", "1=1")
    
    defaults = get_odoo_defaults()
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cur = conn.cursor()
    count = 0
    for parts in data:
        if len(parts) < 2: continue
        code, name = parts[0], parts[1]
        if not code: continue
        try:
            name_json = json.dumps({"en_US": name, "es_EC": name})
            cur.execute("""
                INSERT INTO product_template (name, default_code, sale_ok, purchase_ok, type, active, list_price, uom_id, categ_id, service_tracking)
                VALUES (%s, %s, true, true, 'consu', true, 0.0, %s, 1, 'no')
                ON CONFLICT (default_code) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            """, (name_json, code, defaults['uom_id']))
            tmpl_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO product_product (product_tmpl_id, default_code, active, combination_indices)
                VALUES (%s, %s, true, '')
                ON CONFLICT (default_code) DO NOTHING
            """, (tmpl_id, code))
            count += 1
        except:
            conn.rollback()
    conn.commit()
    cur.close()
    conn.close()
    print(f"Migrated {count} products.")

def migrate_sales_orders():
    print("Migrating Sales Orders...")
    
    # Mapeo Oracle ID -> RUC
    print("Building Oracle ID to RUC map...")
    map_data = run_oracle_query_concat(["CODIGOCLIENTE", "RUC"], "SYSTEM.AUX_SALDO_CLIENTE", "1=1")
    oracle_to_ruc = {p[0]: p[1] for p in map_data if len(p) >= 2}
    
    # Mapeo RUC -> Odoo ID
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT ref, id FROM res_partner WHERE ref IS NOT NULL")
    ruc_to_odoo = {row[0]: row[1] for row in cur.fetchall()}
    
    partner_map = {ora_id: ruc_to_odoo[ruc] for ora_id, ruc in oracle_to_ruc.items() if ruc in ruc_to_odoo}
    print(f"Mapping size: {len(partner_map)} clients with mapping found.")

    # Ventas
    sales_data = run_oracle_query_concat(["NUMERO", "SERIE", "FECHA", "TOTAL", "GRPS_IDCLIENTE"], "SYSTEM.VEN_VENTAS", "rownum <= 500")
    defaults = get_odoo_defaults()
    
    count = 0
    for parts in sales_data:
        if len(parts) < 5: continue
        num, serie, fecha, total, ora_id = parts[0], parts[1], parts[2], parts[3], parts[4]
        if ora_id not in partner_map: continue
        partner_id = partner_map[ora_id]
        
        so_name = f"SO-{serie}-{num}"
        # Fecha simple
        date_str = fecha.split(' ')[0].replace('/', '-')
        
        try:
            cur.execute("""
                INSERT INTO sale_order (name, partner_id, partner_invoice_id, partner_shipping_id, date_order, amount_total, state, company_id, currency_id, pricelist_id)
                VALUES (%s, %s, %s, %s, %s, %s, 'sale', %s, %s, 1)
                ON CONFLICT (name) DO NOTHING
                RETURNING id
            """, (so_name, partner_id, partner_id, partner_id, date_str, total, defaults['company_id'], defaults['currency_id']))
            
            res = cur.fetchone()
            if res:
                order_id = res[0]
                # Líneas de venta
                line_data = run_oracle_query_concat(["ARTL_ARTICULO", "CANTIDAD", "PRECUNIT", "VALOR"], "SYSTEM.VEN_DETAPROD", f"VNTA_NUMERO = {num} and VNTA_SERIE = '{serie}'")
                
                # Mapa productos local para velocidad
                cur_prod = conn.cursor()
                cur_prod.execute("SELECT default_code, id FROM product_product")
                prod_map = {r[0]: r[1] for r in cur_prod.fetchall()}
                cur_prod.close()
                
                for lp in line_data:
                    if len(lp) < 4: continue
                    p_code, p_qty, p_price, p_val = lp[0], lp[1], lp[2], lp[3]
                    if p_code not in prod_map: continue
                    
                    cur.execute("""
                        INSERT INTO sale_order_line (order_id, product_id, name, product_uom_qty, price_unit, price_subtotal, price_total, customer_lead, company_id, currency_id, product_uom_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 0.0, %s, %s, %s)
                    """, (order_id, prod_map[p_code], f"Product {p_code}", p_qty, p_price, p_val, p_val, defaults['company_id'], defaults['currency_id'], defaults['uom_id']))
                count += 1
        except:
            conn.rollback()
            continue
            
    conn.commit()
    cur.close()
    conn.close()
    print(f"Migrated {count} sales orders.")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        conn = psycopg2.connect(**POSTGRES_CONFIG)
        cur = conn.cursor()
        for table, col in [('res_partner', 'ref'), ('product_template', 'default_code'), ('product_product', 'default_code'), ('sale_order', 'name')]:
            try:
                cur.execute(f"ALTER TABLE {table} ADD CONSTRAINT {table}_{col}_unique UNIQUE ({col})")
                conn.commit()
            except: conn.rollback()
        cur.close()
        conn.close()
        
        migrate_partners()
        migrate_products()
        migrate_sales_orders()
    except Exception as e:
        print(f"Migration failed: {e}")
