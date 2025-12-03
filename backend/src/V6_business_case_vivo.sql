-- =====================================================
-- Business Case Vivo - Catálogos y Versionamiento
-- Versión: V6
-- Fecha: 2025-12-02
-- Descripción: Estructura de catálogos versionados para equipos,
--              determinaciones y consumibles
-- =====================================================

-- =====================================================
-- CATÁLOGOS MAESTROS
-- =====================================================

-- Catálogo de Equipos
CREATE TABLE IF NOT EXISTS catalog_equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255),
    version VARCHAR(100),
    manufacturer VARCHAR(255) DEFAULT 'Roche',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinuado', 'reservado')),
    replaced_by_id INT REFERENCES catalog_equipment(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    UNIQUE (name, model, version)
);

CREATE INDEX idx_catalog_equipment_status ON catalog_equipment(status);
CREATE INDEX idx_catalog_equipment_name ON catalog_equipment(name);

COMMENT ON TABLE catalog_equipment IS 'Catálogo de equipos disponibles con versionamiento';
COMMENT ON COLUMN catalog_equipment.status IS 'Estado: active, discontinuado, reservado';
COMMENT ON COLUMN catalog_equipment.replaced_by_id IS 'ID del equipo que reemplaza a este (si fue discontinuado)';

-- Catálogo de Determinaciones
CREATE TABLE IF NOT EXISTS catalog_determinations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    roche_code VARCHAR(100),
    category VARCHAR(100),
    equipment_id INT REFERENCES catalog_equipment(id) ON DELETE SET NULL,
    version VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinuado')),
    replaced_by_id INT REFERENCES catalog_determinations(id) ON DELETE SET NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    UNIQUE (name, roche_code, version)
);

CREATE INDEX idx_catalog_determinations_status ON catalog_determinations(status);
CREATE INDEX idx_catalog_determinations_equipment ON catalog_determinations(equipment_id);
CREATE INDEX idx_catalog_determinations_name ON catalog_determinations(name);

COMMENT ON TABLE catalog_determinations IS 'Catálogo de determinaciones médicas con versionamiento';
COMMENT ON COLUMN catalog_determinations.valid_from IS 'Fecha desde la cual esta versión es válida';
COMMENT ON COLUMN catalog_determinations.valid_to IS 'Fecha hasta la cual esta versión es válida (NULL si aún vigente)';

-- Catálogo de Consumibles
CREATE TABLE IF NOT EXISTS catalog_consumables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('reactivo', 'calibrador', 'control', 'diluyente', 'material')),
    units_per_kit INT,
    unit_price DECIMAL(10,2),
    version VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinuado')),
    replaced_by_id INT REFERENCES catalog_consumables(id) ON DELETE SET NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performance JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_catalog_consumables_status ON catalog_consumables(status);
CREATE INDEX idx_catalog_consumables_type ON catalog_consumables(type);
CREATE INDEX idx_catalog_consumables_name ON catalog_consumables(name);

COMMENT ON TABLE catalog_consumables IS 'Catálogo de consumibles (reactivos, calibradores, controles)';
COMMENT ON COLUMN catalog_consumables.performance IS 'Rendimiento por determinación en formato JSON';
COMMENT ON COLUMN catalog_consumables.units_per_kit IS 'Unidades/determinaciones por kit';

-- =====================================================
-- RELACIONES Y CONSUMOS
-- =====================================================

-- Relación Equipo - Consumible - Determinación
CREATE TABLE IF NOT EXISTS catalog_equipment_consumables (
    id SERIAL PRIMARY KEY,
    equipment_id INT REFERENCES catalog_equipment(id) ON DELETE CASCADE,
    consumable_id INT REFERENCES catalog_consumables(id) ON DELETE CASCADE,
    determination_id INT REFERENCES catalog_determinations(id) ON DELETE CASCADE,
    consumption_rate DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (equipment_id, consumable_id, determination_id)
);

CREATE INDEX idx_eq_cons_equipment ON catalog_equipment_consumables(equipment_id);
CREATE INDEX idx_eq_cons_determination ON catalog_equipment_consumables(determination_id);

COMMENT ON TABLE catalog_equipment_consumables IS 'Relación entre equipos, determinaciones y sus consumibles';
COMMENT ON COLUMN catalog_equipment_consumables.consumption_rate IS 'Tasa de consumo del consumible por determinación';

-- =====================================================
-- INVENTARIO DE CONTRATOS
-- =====================================================

-- Inventario de Determinaciones por Cliente
CREATE TABLE IF NOT EXISTS contract_determinations (
    id SERIAL PRIMARY KEY,
    business_case_id UUID REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
    client_id INT,
    determination_id INT REFERENCES catalog_determinations(id) ON DELETE SET NULL,
    annual_negotiated_quantity INT NOT NULL CHECK (annual_negotiated_quantity > 0),
    consumed_quantity INT DEFAULT 0 CHECK (consumed_quantity >= 0),
    remaining_quantity INT,
    alert_threshold_yellow INT DEFAULT 30 CHECK (alert_threshold_yellow > 0 AND alert_threshold_yellow <= 100),
    alert_threshold_red INT DEFAULT 10 CHECK (alert_threshold_red > 0 AND alert_threshold_red <= 100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contract_det_bc ON contract_determinations(business_case_id);
CREATE INDEX idx_contract_det_client ON contract_determinations(client_id);
CREATE INDEX idx_contract_det_determination ON contract_determinations(determination_id);
CREATE INDEX idx_contract_det_status ON contract_determinations(status);

COMMENT ON TABLE contract_determinations IS 'Inventario de determinaciones negociadas por Business Case';
COMMENT ON COLUMN contract_determinations.alert_threshold_yellow IS 'Porcentaje restante para alerta amarilla';
COMMENT ON COLUMN contract_determinations.alert_threshold_red IS 'Porcentaje restante para alerta roja';

-- Trigger para calcular remaining_quantity automáticamente
CREATE OR REPLACE FUNCTION update_remaining_quantity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_quantity := NEW.annual_negotiated_quantity - NEW.consumed_quantity;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_remaining_quantity
    BEFORE INSERT OR UPDATE OF consumed_quantity, annual_negotiated_quantity
    ON contract_determinations
    FOR EACH ROW
    EXECUTE FUNCTION update_remaining_quantity();

-- =====================================================
-- HISTÓRICO DE CONSUMO
-- =====================================================

-- Log de Consumo de Determinaciones
CREATE TABLE IF NOT EXISTS determination_consumption_log (
    id SERIAL PRIMARY KEY,
    contract_determination_id INT REFERENCES contract_determinations(id) ON DELETE CASCADE,
    consumed_quantity INT NOT NULL CHECK (consumed_quantity > 0),
    consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consumed_by_user_id INT,
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'lis_integration', 'auto')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consumption_log_contract ON determination_consumption_log(contract_determination_id);
CREATE INDEX idx_consumption_log_date ON determination_consumption_log(consumption_date);
CREATE INDEX idx_consumption_log_user ON determination_consumption_log(consumed_by_user_id);

COMMENT ON TABLE determination_consumption_log IS 'Registro histórico de consumos de determinaciones';
COMMENT ON COLUMN determination_consumption_log.source IS 'Origen del registro: manual, lis_integration, auto';

-- =====================================================
-- SISTEMA DE ALERTAS
-- =====================================================

-- Alertas de Business Case
CREATE TABLE IF NOT EXISTS bc_alerts (
    id SERIAL PRIMARY KEY,
    business_case_id UUID REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
    contract_determination_id INT REFERENCES contract_determinations(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_inventory', 'product_discontinued', 'unusual_consumption', 'threshold_exceeded')),
    severity VARCHAR(20) NOT NULL DEFAULT 'yellow' CHECK (severity IN ('yellow', 'red', 'critical')),
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by_user_id INT
);

CREATE INDEX idx_bc_alerts_bc ON bc_alerts(business_case_id);
CREATE INDEX idx_bc_alerts_contract ON bc_alerts(contract_determination_id);
CREATE INDEX idx_bc_alerts_type ON bc_alerts(alert_type);
CREATE INDEX idx_bc_alerts_severity ON bc_alerts(severity);
CREATE INDEX idx_bc_alerts_acknowledged ON bc_alerts(acknowledged);

COMMENT ON TABLE bc_alerts IS 'Alertas automáticas para Business Cases';
COMMENT ON COLUMN bc_alerts.alert_type IS 'Tipo: low_inventory, product_discontinued, unusual_consumption, threshold_exceeded';
COMMENT ON COLUMN bc_alerts.severity IS 'Severidad: yellow (30%), red (10%), critical (<5%)';

-- =====================================================
-- CATÁLOGO DE INVERSIONES (Para auto-sugerir)
-- =====================================================

-- Catálogo de Inversiones Adicionales
CREATE TABLE IF NOT EXISTS catalog_investments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    suggested_price DECIMAL(10,2),
    suggested_quantity INT DEFAULT 1,
    requires_lis BOOLEAN DEFAULT FALSE,
    requires_equipment BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_catalog_inv_category ON catalog_investments(category);
CREATE INDEX idx_catalog_inv_status ON catalog_investments(status);

COMMENT ON TABLE catalog_investments IS 'Catálogo de inversiones adicionales para sugerir automáticamente';
COMMENT ON COLUMN catalog_investments.requires_lis IS 'TRUE si esta inversión es recomendada cuando se incluye LIS';
COMMENT ON COLUMN catalog_investments.requires_equipment IS 'TRUE si esta inversión es recomendada con equipo principal';

-- =====================================================
-- DATOS INICIALES (SEED)
-- =====================================================

-- Insertar equipos iniciales
INSERT INTO catalog_equipment (name, model, version, manufacturer, status) VALUES
('Cobas PRO e801', 'e801', 'E2G 1.0', 'Roche', 'active'),
('Cobas PRO e801', 'e801', 'E2G 2.0', 'Roche', 'active'),
('Cobas PRO e801', 'e801', 'E2G 300', 'Roche', 'active'),
('Cobas PRO e411', 'e411', 'Elecsys 2010', 'Roche', 'active'),
('Cobas c 111', 'c111', 'V1', 'Roche', 'active')
ON CONFLICT (name, model, version) DO NOTHING;

-- Insertar determinaciones comunes
INSERT INTO catalog_determinations (name, roche_code, category, equipment_id, version, status) VALUES
('TSH', 'TSH-001', 'Hormonas', 1, 'Elecsys E2G 300', 'active'),
('T4', 'T4-001', 'Hormonas', 1, 'Elecsys E2G 300', 'active'),
('T3', 'T3-001', 'Hormonas', 1, 'Elecsys E2G 300', 'active'),
('Ferritina', 'FRT-001', 'Química Clínica', 1, 'Elecsys E2G 300', 'active'),
('Vitamina B12', 'VB12-001', 'Vitaminas', 1, 'Elecsys E2G 300', 'active'),
('Ácido Fólico', 'AFOL-001', 'Vitaminas', 1, 'Elecsys E2G 300', 'active'),
('PSA', 'PSA-001', 'Marcadores Tumorales', 1, 'Elecsys E2G 300', 'active'),
('HbA1c', 'HBA1C-001', 'Diabetes', 5, 'V1', 'active'),
('Glucosa', 'GLU-001', 'Química Clínica', 5, 'V1', 'active')
ON CONFLICT (name, roche_code, version) DO NOTHING;

-- Insertar consumibles básicos
INSERT INTO catalog_consumables (name, type, units_per_kit, unit_price, version, status) VALUES
('Reactivo TSH Elecsys', 'reactivo', 100, 450.00, 'E2G 300 V2', 'active'),
('Reactivo T4 Elecsys', 'reactivo', 100, 350.00, 'E2G 300 V2', 'active'),
('Calibrador Multi-analito', 'calibrador', 50, 180.00, 'V2', 'active'),
('Control de Calidad Nivel 1', 'control', 25, 120.00, 'V2', 'active'),
('Control de Calidad Nivel 2', 'control', 25, 120.00, 'V2', 'active'),
('Diluyente Universal', 'diluyente', 500, 75.00, 'V1', 'active'),
('Reactivo Ferritina Elecsys', 'reactivo', 100, 380.00, 'E2G 300 V1', 'active')
ON CONFLICT DO NOTHING;

-- Insertar relaciones equipo-consumible-determinación
INSERT INTO catalog_equipment_consumables (equipment_id, consumable_id, determination_id, consumption_rate) VALUES
(1, 1, 1, 1.05), -- Cobas e801 + Reactivo TSH + TSH (5% extra por calibraciones)
(1, 2, 2, 1.05), -- Cobas e801 + Reactivo T4 + T4
(1, 3, 1, 0.02), -- Cobas e801 + Calibrador + TSH (2 calibraciones por cada 100)
(1, 4, 1, 0.01), -- Cobas e801 + Control N1 + TSH
(1, 5, 1, 0.01), -- Cobas e801 + Control N2 + TSH
(1, 7, 4, 1.05)  -- Cobas e801 + Reactivo Ferritina + Ferritina
ON CONFLICT (equipment_id, consumable_id, determination_id) DO NOTHING;

-- Insertar inversiones adicionales catalogadas
INSERT INTO catalog_investments (name, category, subcategory, suggested_price, suggested_quantity, requires_lis, requires_equipment) VALUES
-- Hardware LIS
('Router', 'Hardware LIS', 'Conectividad', 90.00, 1, TRUE, FALSE),
('UPS Equipo', 'Hardware LIS', 'Energía', 600.00, 1, TRUE, FALSE),
('Impresora Zebra', 'Hardware LIS', 'Impresión', 350.00, 1, TRUE, FALSE),
('Cable de Red CAT6', 'Hardware LIS', 'Conectividad', 15.00, 10, TRUE, FALSE),

-- Mobiliario
('Mesa de acero inoxidable', 'Mobiliario', 'Muebles', 450.00, 1, FALSE, TRUE),
('Gavetas para almacenamiento', 'Mobiliario', 'Almacenamiento', 180.00, 2, FALSE, TRUE),
('Silla ergonómica', 'Mobiliario', 'Muebles', 120.00, 2, FALSE, FALSE),

-- Consumibles
('Hisopos estériles x100', 'Consumibles', 'Materiales', 0.80, 100, FALSE, TRUE),
('Guantes de nitrilo x100', 'Consumibles', 'Protección', 12.00, 50, FALSE, TRUE),
('Tubos de recolección x100', 'Consumibles', 'Materiales', 25.00, 50, FALSE, TRUE),
('Puntas de pipeta x1000', 'Consumibles', 'Materiales', 45.00, 10, FALSE, TRUE),

-- Servicios
('Sistema de Osmosis Inversa', 'Servicios', 'Agua', 1200.00, 1, FALSE, TRUE),
('Aire Acondicionado Split', 'Servicios', 'Climatización', 800.00, 1, FALSE, TRUE),
('Regulador de Voltaje', 'Servicios', 'Energía', 350.00, 1, FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de equipos activos con sus determinaciones
CREATE OR REPLACE VIEW v_equipment_determinations AS
SELECT 
    e.id AS equipment_id,
    e.name AS equipment_name,
    e.model,
    e.version AS equipment_version,
    d.id AS determination_id,
    d.name AS determination_name,
    d.roche_code,
    d.category,
    d.version AS determination_version,
    d.status AS determination_status
FROM catalog_equipment e
LEFT JOIN catalog_determinations d ON d.equipment_id = e.id
WHERE e.status = 'active'
ORDER BY e.name, d.name;

-- Vista de consumos por cliente
CREATE OR REPLACE VIEW v_client_inventory AS
SELECT 
    cd.id,
    cd.business_case_id,
    ep.client_name,
    d.name AS determination_name,
    cd.annual_negotiated_quantity,
    cd.consumed_quantity,
    cd.remaining_quantity,
    ROUND((cd.remaining_quantity::DECIMAL / cd.annual_negotiated_quantity) * 100, 2) AS percentage_remaining,
    cd.status,
    cd.alert_threshold_yellow,
    cd.alert_threshold_red,
    CASE 
        WHEN (cd.remaining_quantity::DECIMAL / cd.annual_negotiated_quantity) * 100 <= cd.alert_threshold_red THEN 'red'
        WHEN (cd.remaining_quantity::DECIMAL / cd.annual_negotiated_quantity) * 100 <= cd.alert_threshold_yellow THEN 'yellow'
        ELSE 'green'
    END AS alert_level
FROM contract_determinations cd
JOIN equipment_purchase_requests ep ON cd.business_case_id = ep.id
JOIN catalog_determinations d ON cd.determination_id = d.id
WHERE cd.status = 'active'
ORDER BY cd.business_case_id, d.name;

-- =====================================================
-- FIN DE MIGRACIÓN V6
-- =====================================================
