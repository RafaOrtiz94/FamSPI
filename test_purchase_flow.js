/**
 * Script de prueba manual para verificar el flujo de compras públicas y privadas
 * Ejecutar en la consola del navegador después de navegar al dashboard comercial
 */

console.log('=== PRUEBA MANUAL DEL FLUJO DE COMPRAS ===');

// Paso 1: Verificar que el botón "Crear Solicitud" existe
const createButton = document.querySelector('button:has-text("Crear Solicitud")') ||
    document.querySelector('button').closest('[class*="Crear"]') ||
    document.querySelector('button');

if (createButton) {
    console.log('✅ Botón "Crear Solicitud" encontrado:', createButton);

    // Simular click en el botón
    createButton.click();
    console.log('✅ Click simulado en "Crear Solicitud"');

    // Esperar un poco y verificar si el modal del selector se abrió
    setTimeout(() => {
        const selectorModal = document.querySelector('[role="dialog"]') ||
            document.querySelector('.fixed.inset-0.z-50');
        if (selectorModal) {
            console.log('✅ Modal del selector encontrado:', selectorModal);

            // Buscar botones de compra privada
            const privateButtons = Array.from(document.querySelectorAll('button'))
                .filter(btn => btn.textContent.includes('Compra Privada') ||
                    btn.textContent.includes('Privada'));

            if (privateButtons.length > 0) {
                console.log('✅ Botón "Compra Privada" encontrado:', privateButtons[0]);

                // Simular click en "Compra Privada"
                privateButtons[0].click();
                console.log('✅ Click simulado en "Compra Privada"');

                // Esperar y verificar si el modal de compra privada se abrió
                setTimeout(() => {
                    const purchaseModal = Array.from(document.querySelectorAll('[role="dialog"]'))
                        .find(modal => modal !== selectorModal);

                    if (purchaseModal) {
                        console.log('✅ Modal de compra privada encontrado:', purchaseModal);

                        // Verificar contenido del modal
                        const modalContent = purchaseModal.textContent;
                        if (modalContent.includes('Nueva Solicitud de Compra Privada')) {
                            console.log('✅ Modal tiene título correcto');
                        } else {
                            console.log('❌ Modal no tiene título correcto:', modalContent.substring(0, 100));
                        }

                    } else {
                        console.log('❌ Modal de compra privada NO encontrado');
                        console.log('Modales actuales:', document.querySelectorAll('[role="dialog"]'));
                    }
                }, 500);

            } else {
                console.log('❌ Botón "Compra Privada" NO encontrado');
                console.log('Botones disponibles:', Array.from(document.querySelectorAll('button')).map(btn => btn.textContent));
            }

        } else {
            console.log('❌ Modal del selector NO encontrado');
            console.log('Elementos fixed encontrados:', document.querySelectorAll('.fixed'));
        }
    }, 500);

} else {
    console.log('❌ Botón "Crear Solicitud" NO encontrado');
    console.log('Botones disponibles:', Array.from(document.querySelectorAll('button')).map(btn => btn.textContent));
}

console.log('=== FIN DE PRUEBA ===');
