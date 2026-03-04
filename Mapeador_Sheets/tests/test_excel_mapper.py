import json
import sys
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation

SCRIPT_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import excel_mapper  # noqa: E402


class TestExcelMapper(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)
        self.input_file = self.temp_path / "sample.xlsx"
        self.output_dir = self.temp_path / "out"
        self._create_sample_workbook(self.input_file)

    def tearDown(self):
        self.temp_dir.cleanup()

    @staticmethod
    def _create_sample_workbook(path):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "XP 300"

        sheet["B8"] = "ID"
        sheet["C8"] = "PRODUCTO"
        sheet["F8"] = "DET/AÑO PROCESO"
        sheet["I8"] = "PRODUCTO A ENTREGAR"

        sheet["B9"] = 1001
        sheet["C9"] = "Reactivo A"
        sheet["F9"] = None
        sheet["G9"] = "=1+1"
        sheet["I9"] = None

        sheet["B10"] = 1002
        sheet["C10"] = "Reactivo B"
        sheet["F10"] = 24
        sheet["I10"] = None

        sheet["B11"] = 1003
        sheet["C11"] = "Reactivo C"
        sheet["F11"] = None
        sheet["I11"] = None

        sheet["B12"] = 1004
        sheet["C12"] = "Reactivo D"
        sheet["F12"] = "=1+1"
        sheet["I12"] = 0

        validation = DataValidation(type="list", formula1='"SI,NO"')
        sheet.add_data_validation(validation)
        validation.add("I9:I12")

        workbook.save(path)

    def test_analyze_workbook_excludes_empty_cells_by_default(self):
        mapping = excel_mapper.analyze_workbook(str(self.input_file), include_empty=False)
        cells = {cell["cell"] for cell in mapping["sheets"][0]["cells"]}
        self.assertNotIn("F9", cells)

    def test_analyze_workbook_includes_empty_cells_when_enabled(self):
        mapping = excel_mapper.analyze_workbook(str(self.input_file), include_empty=True)
        cells = {cell["cell"] for cell in mapping["sheets"][0]["cells"]}
        self.assertIn("F9", cells)

    def test_sheet_summary_contains_expected_metrics(self):
        mapping = excel_mapper.analyze_workbook(str(self.input_file), include_empty=False)
        summary = mapping["sheets"][0]["summary"]

        self.assertEqual(summary["formula_cells"], 2)
        self.assertEqual(summary["validation_cells"], 4)
        self.assertEqual(summary["fillable_headers"], 2)
        self.assertEqual(summary["empty_fill_targets_objective"], 7)
        self.assertGreaterEqual(summary["empty_fill_targets_general"], 1)
        self.assertGreaterEqual(summary["empty_fill_targets"], summary["empty_fill_targets_objective"])

    def test_empty_fill_targets_are_detected_from_target_columns(self):
        mapping = excel_mapper.analyze_workbook(str(self.input_file), include_empty=False)
        targets = mapping["sheets"][0]["empty_fill_targets_objective"]
        f9_target = next((target for target in targets if target["cell"] == "F9"), None)
        f12_target = next((target for target in targets if target["cell"] == "F12"), None)
        i12_target = next((target for target in targets if target["cell"] == "I12"), None)

        self.assertIsNotNone(f9_target)
        self.assertEqual(f9_target["detection_reason"], "target_column_empty")
        self.assertEqual(f9_target["value_state"], "empty")
        self.assertEqual(f9_target["target_header"], excel_mapper.TARGET_HEADER_DET)
        self.assertIn("fila 9", f9_target["fill_description"])
        self.assertIn("columna F/6", f9_target["fill_description"])

        self.assertIsNotNone(f12_target)
        self.assertEqual(f12_target["value_state"], "formula")
        self.assertEqual(f12_target["detection_reason"], "target_column_formula")

        self.assertIsNotNone(i12_target)
        self.assertEqual(i12_target["value_state"], "zero")
        self.assertEqual(i12_target["detection_reason"], "target_column_zero")

    def test_markdown_includes_complete_and_objective_sections(self):
        mapping = excel_mapper.analyze_workbook(str(self.input_file), include_empty=False)
        md_content = excel_mapper.generate_markdown(mapping)

        self.assertIn("Celdas Vacias por Rellenar (Columnas Objetivo)", md_content)
        self.assertIn("Celdas Vacias por Rellenar (General - Informe Completo)", md_content)
        self.assertIn("Celdas Vacias por Rellenar (Consolidado)", md_content)
        self.assertIn("| F9 | 9 | F/6 |", md_content)

    def test_main_writes_only_json_when_requested(self):
        exit_code = excel_mapper.main(
            [
                "--input",
                str(self.input_file),
                "--out-dir",
                str(self.output_dir),
                "--format",
                "json",
            ]
        )
        self.assertEqual(exit_code, 0)

        json_file = self.output_dir / "mapping_auto.json"
        md_file = self.output_dir / "mapping_auto.md"
        self.assertTrue(json_file.exists())
        self.assertFalse(md_file.exists())

        content = json.loads(json_file.read_text(encoding="utf-8"))
        self.assertIn("summary", content)
        self.assertEqual(content["summary"]["total_sheets"], 1)

    def test_header_classification_supports_variants(self):
        self.assertEqual(
            excel_mapper.classify_fillable_header("PRODUCTO A ENTREGAR"),
            excel_mapper.TARGET_HEADER_PRODUCT,
        )
        self.assertEqual(
            excel_mapper.classify_fillable_header("PRODUCTO A ENVIAR"),
            excel_mapper.TARGET_HEADER_PRODUCT,
        )
        self.assertEqual(
            excel_mapper.classify_fillable_header("DET/AÑO PROCESO"),
            excel_mapper.TARGET_HEADER_DET,
        )
        self.assertEqual(
            excel_mapper.classify_fillable_header("CANTIDAD PROCESO/AÑO"),
            excel_mapper.TARGET_HEADER_DET,
        )

    def test_bc_sheet_maps_characteristics_quantity_and_price_columns(self):
        bc_file = self.temp_path / "sample_bc.xlsx"

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "BC"

        sheet["A57"] = "*Inversiones adicionales"
        sheet["B57"] = "Características"
        sheet["C57"] = "Estado"
        sheet["D57"] = "Cantidad"
        sheet["E57"] = "Precio"

        sheet["A58"] = "Item 1"
        sheet["B58"] = None
        sheet["D58"] = None
        sheet["E58"] = None

        sheet["A59"] = "Item 2"
        sheet["B59"] = None
        sheet["D59"] = "=1+1"
        sheet["E59"] = 0

        workbook.save(bc_file)

        mapping = excel_mapper.analyze_workbook(str(bc_file), include_empty=False)
        bc_sheet = mapping["sheets"][0]
        objective_targets = bc_sheet["empty_fill_targets_objective"]
        target_cells = {target["cell"] for target in objective_targets}

        expected_cells = {"B58", "D58", "E58", "B59", "D59", "E59"}
        self.assertTrue(expected_cells.issubset(target_cells))

        d59 = next(target for target in objective_targets if target["cell"] == "D59")
        e59 = next(target for target in objective_targets if target["cell"] == "E59")
        self.assertEqual(d59["value_state"], "formula")
        self.assertEqual(e59["value_state"], "zero")


if __name__ == "__main__":
    unittest.main()
