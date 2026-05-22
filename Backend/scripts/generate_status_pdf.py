#!/usr/bin/env python3
"""Generate PDF from BACKEND_IMPLEMENTATION_STATUS.md via HTML + Chrome headless."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
MD_PATH = ROOT / "BACKEND_IMPLEMENTATION_STATUS.md"
HTML_PATH = ROOT / ".BACKEND_IMPLEMENTATION_STATUS.html"
PDF_PATH = ROOT / "BACKEND_IMPLEMENTATION_STATUS.pdf"

PRINT_CSS = """
@page { margin: 18mm 16mm; size: A4; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1a1a1a;
  margin: 0;
  padding: 0 4mm;
}
h1 { font-size: 20pt; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 0; }
h2 {
  font-size: 14pt;
  color: #1e40af;
  margin-top: 1.4em;
  page-break-after: avoid;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 4px;
}
h3 { font-size: 11.5pt; margin-top: 1em; page-break-after: avoid; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6em 0 1em;
  font-size: 9pt;
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #94a3b8;
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
}
th { background: #eff6ff; font-weight: 600; }
tr:nth-child(even) td { background: #f8fafc; }
code {
  font-family: ui-monospace, "Cascadia Code", monospace;
  font-size: 8.5pt;
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
}
pre {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 10px;
  font-size: 7.5pt;
  page-break-inside: avoid;
  white-space: pre-wrap;
  word-break: break-word;
}
pre code { background: none; padding: 0; }
.diagram-note {
  font-size: 8pt;
  font-weight: 600;
  color: #1e40af;
  margin: 0.8em 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5em 0; }
"""


def preprocess_mermaid(md: str) -> str:
    """Label mermaid blocks before markdown conversion."""

    def repl(match: re.Match[str]) -> str:
        body = match.group(1).strip()
        return (
            '<p class="diagram-note">Architecture diagram (Mermaid source)</p>\n\n'
            f"```\n{body}\n```"
        )

    return re.sub(r"```mermaid\n(.*?)```", repl, md, flags=re.DOTALL)


def main() -> int:
    if not MD_PATH.is_file():
        print(f"Missing: {MD_PATH}", file=sys.stderr)
        return 1

    raw = MD_PATH.read_text(encoding="utf-8")
    html_body = markdown.markdown(
        preprocess_mermaid(raw),
        extensions=["tables", "fenced_code", "nl2br", "sane_lists"],
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>UGF AgentX — Backend Implementation Status</title>
  <style>{PRINT_CSS}</style>
</head>
<body>
{html_body}
</body>
</html>
"""

    HTML_PATH.write_text(html, encoding="utf-8")

    cmd = [
        "/usr/bin/google-chrome-stable",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_PATH}",
        HTML_PATH.as_uri(),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        return result.returncode

    if not PDF_PATH.is_file():
        print("Chrome did not create PDF", file=sys.stderr)
        return 1

    print(f"Wrote {PDF_PATH} ({PDF_PATH.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
