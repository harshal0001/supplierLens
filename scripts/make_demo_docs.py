"""Write synthetic supplier PDFs into demo-data/.

Run from the repo root:
    uv run --with fpdf2 python scripts/make_demo_docs.py
"""

from pathlib import Path

from fpdf import FPDF

from demo_catalog import SUPPLIERS

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo-data"
FOOTER = "SYNTHETIC DEMO DATA, NOT A REAL COMPANY"


class DemoPDF(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 9)
        self.cell(0, 8, FOOTER, align="C")


def write_pdf(path: Path, title: str, lines: list[str]) -> None:
    pdf = DemoPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.multi_cell(0, 9, title)
    pdf.ln(4)
    pdf.set_font("Helvetica", size=12)
    for line in lines:
        pdf.multi_cell(0, 8, line)
        pdf.ln(1)
    path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(path)


def main() -> None:
    for supplier in SUPPLIERS:
        for filename, lines in supplier["files"].items():
            path = OUT / filename
            write_pdf(path, supplier["name"], lines)
            print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
