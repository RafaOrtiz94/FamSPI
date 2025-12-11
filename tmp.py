from pathlib import Path
path = Path('spi_front/src/modules/comercial/pages/Clientes.jsx')
data = path.read_text(encoding='utf-8-sig')
path.write_text(data, encoding='utf-8')
