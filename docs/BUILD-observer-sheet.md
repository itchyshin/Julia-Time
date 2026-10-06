# Rebuilding the observer sheet PDF

`docs/playtest-observer-sheet.md` and `docs/playtest-observer-sheet.tex` hold the same content by hand, so change both. Then rebuild the PDF with XeLaTeX in a scratch folder, so the build files stay out of the repo:

```sh
mkdir -p /tmp/observer-sheet && cp docs/playtest-observer-sheet.tex /tmp/observer-sheet/ && cd /tmp/observer-sheet
xelatex -interaction=nonstopmode playtest-observer-sheet.tex
xelatex -interaction=nonstopmode playtest-observer-sheet.tex
cp playtest-observer-sheet.pdf <repo>/docs/playtest-observer-sheet.pdf
```

Check that `pdfinfo docs/playtest-observer-sheet.pdf` says `Pages: 1` and that `pdftotext` shows the same text as the `.md`. The sheet must stay one US letter page.

The longer guidance for observers is in `docs/playtest-observer-guide.md`. It is not built; it is plain Markdown, and the sheet points to it by name.
