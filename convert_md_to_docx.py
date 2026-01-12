#!/usr/bin/env python3
"""
Script para convertir informe técnico Markdown a DOCX profesional
Usando Pandoc con configuración avanzada para documentos empresariales
"""

import os
import subprocess
import sys
from pathlib import Path

def convert_markdown_to_docx(input_md, output_docx):
    """
    Convierte archivo Markdown a DOCX con formato profesional
    """

    # Verificar que el archivo de entrada existe
    if not os.path.exists(input_md):
        print(f"❌ Error: Archivo {input_md} no encontrado")
        return False

    # Comando Pandoc con configuración profesional
    cmd = [
        "pandoc",
        input_md,
        "-f", "markdown",
        "-t", "docx",
        "-o", output_docx,
        "--reference-doc", "template.docx" if os.path.exists("template.docx") else None,
        "--toc",  # Tabla de contenidos
        "--toc-depth", "3",  # Profundidad del TOC
        "--number-sections",  # Numeración de secciones
        "--highlight-style", "tango",  # Estilo de resaltado de código
        "--wrap", "preserve",  # Preservar saltos de línea
        "--columns", "1",  # Una columna
        "--dpi", "300",  # Alta resolución
        "--extract-media", ".",  # Extraer medios si existen
        "--self-contained",  # Documento autocontenido
        # Metadatos del documento
        "--metadata", "title:SPI FAM - Informe Técnico Integral",
        "--metadata", "author:Ingeniero de Tecnologías de la Información - SPI FAM",
        "--metadata", "subject:Análisis Técnico del Sistema de Procesos Internos",
        "--metadata", "keywords:SPI FAM, FamProject, Arquitectura de Software, Seguridad Informática, LOPDP",
        "--metadata", "creator:FamProject - Departamento de TI",
        "--metadata", "producer:Documentación Técnica Automatizada",
        "--metadata", "lang:es-ES",
    ]

    # Remover None del comando si no hay template
    cmd = [x for x in cmd if x is not None]

    try:
        print(f"🔄 Convirtiendo {input_md} a {output_docx}...")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.getcwd())

        if result.returncode == 0:
            print(f"✅ Conversión exitosa: {output_docx}")
            print(f"📊 Tamaño del archivo: {os.path.getsize(output_docx)} bytes")
            return True
        else:
            print(f"❌ Error en conversión:")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False

    except FileNotFoundError:
        print("❌ Error: Pandoc no está instalado. Instale con: sudo apt install pandoc")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return False

def create_template_docx():
    """
    Crea un template DOCX básico si no existe
    """
    template_content = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p>
            <w:pPr>
                <w:pStyle w:val="Title"/>
            </w:pPr>
            <w:r>
                <w:t>Template SPI FAM</w:t>
            </w:r>
        </w:p>
    </w:body>
</w:document>
"""

    # Crear template básico usando pandoc
    try:
        cmd = [
            "pandoc",
            "-o", "template.docx",
            "--metadata", "title:Template SPI FAM"
        ]

        with open("temp_template.md", "w", encoding="utf-8") as f:
            f.write("# Template SPI FAM\n\nDocumento de referencia para informes técnicos.")

        cmd.extend(["temp_template.md"])
        subprocess.run(cmd, capture_output=True)

        # Limpiar archivo temporal
        if os.path.exists("temp_template.md"):
            os.remove("temp_template.md")

        print("📄 Template DOCX creado")
        return True

    except Exception as e:
        print(f"⚠️ No se pudo crear template: {e}")
        return False

def main():
    """
    Función principal
    """
    print("🚀 Conversor Markdown a DOCX - SPI FAM")
    print("=" * 50)

    # Archivos
    input_file = "SPI_FAM_Technical_Report.md"
    output_file = "SPI_FAM_Informe_Tecnico_Integral.docx"

    # Verificar archivos
    if not os.path.exists(input_file):
        print(f"❌ Archivo fuente no encontrado: {input_file}")
        sys.exit(1)

    # Crear template si no existe
    if not os.path.exists("template.docx"):
        print("📝 Creando template DOCX...")
        create_template_docx()

    # Convertir
    success = convert_markdown_to_docx(input_file, output_file)

    if success:
        print("\n" + "=" * 50)
        print("🎉 CONVERSIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 50)
        print(f"📁 Archivo generado: {output_file}")
        print("📊 Características del documento:")
        print("   • Tabla de contenidos automática")
        print("   • Numeración de secciones")
        print("   • Formato profesional corporativo")
        print("   • Metadatos completos")
        print("   • Optimizado para impresión")
        print("\n📧 Listo para distribución ejecutiva")
    else:
        print("\n❌ CONVERSIÓN FALLIDA")
        sys.exit(1)

if __name__ == "__main__":
    main()
