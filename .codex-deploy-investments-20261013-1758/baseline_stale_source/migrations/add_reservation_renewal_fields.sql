-- Migración para agregar campos de renovación de reserva
-- Fecha: 2025-11-25

-- Agregar columnas para gestión de renovación de reserva
DO $$ 
BEGIN
    -- reservation_expires_at: Fecha de expiración de la reserva (60 días después)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = 'reservation_expires_at'
    ) THEN
        ALTER TABLE equipment_purchase_requests 
        ADD COLUMN reservation_expires_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna reservation_expires_at agregada exitosamente';
    END IF;

    -- reservation_renewed_at: Última vez que se renovó la reserva
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = 'reservation_renewed_at'
    ) THEN
        ALTER TABLE equipment_purchase_requests 
        ADD COLUMN reservation_renewed_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna reservation_renewed_at agregada exitosamente';
    END IF;

    -- reservation_renewal_count: Contador de renovaciones
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = 'reservation_renewal_count'
    ) THEN
        ALTER TABLE equipment_purchase_requests 
        ADD COLUMN reservation_renewal_count INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Columna reservation_renewal_count agregada exitosamente';
    END IF;

    -- cancelled_at: Fecha de cancelación
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE equipment_purchase_requests 
        ADD COLUMN cancelled_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna cancelled_at agregada exitosamente';
    END IF;

    -- cancellation_reason: Razón de cancelación
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE equipment_purchase_requests 
        ADD COLUMN cancellation_reason TEXT;
        
        RAISE NOTICE 'Columna cancellation_reason agregada exitosamente';
    END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN equipment_purchase_requests.reservation_expires_at IS 'Fecha de expiración de la reserva (60 días después de la última reserva/renovación)';
COMMENT ON COLUMN equipment_purchase_requests.reservation_renewed_at IS 'Última fecha de renovación de la reserva';
COMMENT ON COLUMN equipment_purchase_requests.reservation_renewal_count IS 'Número de veces que se ha renovado la reserva';
COMMENT ON COLUMN equipment_purchase_requests.cancelled_at IS 'Fecha de cancelación de la orden';
COMMENT ON COLUMN equipment_purchase_requests.cancellation_reason IS 'Razón de la cancelación (manual, auto-expiración, etc)';
