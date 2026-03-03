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

        validation = DataValidation(type="list", formula1='"SI,NO"')
        sheet.add_data_validation(validation)
        validation.add("I9:I11")

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

        self.assertEqual(summary["formula_cells"], 1)
        self.assertEqual(summary["validation_cells"], 3)
        self.assertEqual(summary["fillable_headers"], 2)
        self.assertEqual(summary["empty_fill_targets_objective"], 5)
        self.assertGreaterEqual(summary["empty_fill_targets_general"], 1)
        self.assertGreaterEqual(summary["empty_fill_targets"], summary["empty_fill_targets_objective"])

    def test_empty_fill_targets_are_detected_from_target_columns(self):
        mapping = excel_mapper.analyze_workbook(str(self.input_file), include_empty=False)
        targets = mapping["sheets"][0]["empty_fill_targets_objective"]
        f9_target = next((target for target in targets if target["cell"] == "F9"), None)

        self.assertIsNotNone(f9_target)
        self.assertEqual(f9_target["detection_reason"], "target_column")
        self.assertEqual(f9_target["target_header"], excel_mapper.TARGET_HEADER_DET)
        self.assertIn("fila 9", f9_target["fill_description"])
        self.assertIn("columna F/6", f9_target["fill_description"])

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


if __name__ == "__main__":
    unittest.main()
