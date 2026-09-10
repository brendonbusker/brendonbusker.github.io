"""Compare a browser-generated résumé PDF with the user-approved reference.

Requires pdfplumber. Run after the résumé Playwright test:
  python scripts/verify-resume-pdf.py test-results/generated-resume.pdf
Only use the reference comparison for the unchanged, approved résumé content.
"""

import sys
from pathlib import Path

import pdfplumber

reference = Path(__file__).resolve().parents[1] / "resume.pdf"
generated = Path(sys.argv[1])
with pdfplumber.open(reference) as original, pdfplumber.open(generated) as actual:
    assert len(actual.pages) == len(original.pages) == 1, "Expected one page"
    before, after = original.pages[0], actual.pages[0]
    assert (before.width, before.height) == (after.width, after.height)
    expected_lines = before.extract_text_lines()
    actual_lines = after.extract_text_lines()
    assert len(expected_lines) == len(actual_lines), "Line count changed"
    for expected, rendered in zip(expected_lines, actual_lines):
        assert expected["text"] == rendered["text"], (expected["text"], rendered["text"])
        for coordinate in ("x0", "x1", "top", "bottom"):
            assert abs(expected[coordinate] - rendered[coordinate]) < 0.05, (
                expected["text"], coordinate, expected[coordinate], rendered[coordinate]
            )
    assert len(before.lines) == len(after.lines) == 5
    for expected, rendered in zip(before.lines, after.lines):
        for coordinate in ("x0", "x1", "top"):
            assert abs(expected[coordinate] - rendered[coordinate]) < 0.05
    assert {c["fontname"] for c in before.chars} == {c["fontname"] for c in after.chars}
    assert all(0 <= c["x0"] <= c["x1"] <= after.width and 0 <= c["top"] <= c["bottom"] <= after.height for c in after.chars)
    print(f"Matched {len(actual_lines)} lines, fonts, five rules and Letter page geometry within 0.05 pt.")
