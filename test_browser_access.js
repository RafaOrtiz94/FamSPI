const puppeteer = require('puppeteer');

async function testBrowserAccess() {
  console.log('🚀 Iniciando prueba de acceso al navegador...');

  let browser;
  try {
    console.log('📱 Lanzando navegador en modo headless...');
    browser = await puppeteer.launch({
      headless: true, // Modo headless para CI/CD
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list'
      ]
    });

    const page = await browser.newPage();

    // Configurar timeouts más largos
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    console.log('🌐 Navegando a https://spi-dev.famproject.com.ec...');

    // Capturar cualquier error de navegación
    let navigationError = null;
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`⚠️  Respuesta con error: ${response.status()} ${response.url()}`);
      }
    });

    try {
      const response = await page.goto('https://spi-dev.famproject.com.ec', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const statusCode = response ? response.status() : null;
      console.log('📊 Código de estado HTTP:', statusCode);

      if (statusCode >= 400) {
        throw new Error(`Error HTTP ${statusCode}`);
      }

    } catch (navError) {
      navigationError = navError;
      console.log('⚠️  Error de navegación:', navError.message);
    }

    const title = await page.title();
    const url = page.url();

    console.log('📄 Título de la página:', title);
    console.log('🔗 URL final:', url);

    // Verificar elementos básicos
    const hasReactRoot = await page.$('#root').catch(() => null);
    console.log('⚛️ React root encontrado:', !!hasReactRoot);

    // Capturar screenshot para debugging
    await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
    console.log('📸 Screenshot guardado como debug_screenshot.png');

    if (navigationError) {
      throw navigationError;
    }

    console.log('✅ Prueba exitosa - El sitio web es accesible desde el navegador!');
    return {
      success: true,
      title,
      url,
      hasReactRoot: !!hasReactRoot,
      statusCode: 200
    };

  } catch (error) {
    console.log('❌ Error en la prueba:', error.message);

    // Capturar screenshot del error si es posible
    try {
      if (browser) {
        await page.screenshot({ path: 'error_screenshot.png', fullPage: true });
        console.log('📸 Screenshot de error guardado como error_screenshot.png');
      }
    } catch (screenshotError) {
      console.log('⚠️  No se pudo capturar screenshot de error');
    }

    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testBrowserAccess().then(result => {
  console.log('\n📋 Resultado final:', result);
  process.exit(result.success ? 0 : 1);
});
