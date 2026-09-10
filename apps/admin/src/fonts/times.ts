import roman from "./Times-Roman.afm?raw";
import bold from "./Times-Bold.afm?raw";
import italic from "./Times-Italic.afm?raw";
import boldItalic from "./Times-BoldItalic.afm?raw";
import helvetica from "./Helvetica.afm?raw";

// PDFKit's Standard 14 metrics let the browser use the same fonts as resume.pdf.
// The reference uses unkerned Times; omit pair adjustments to match its widths.
// These are font metrics, not replacement font files. See PDFKit-LICENSE.txt.
export default Object.fromEntries(
  Object.entries({
    "Times-Roman": roman,
    "Times-Bold": bold,
    "Times-Italic": italic,
    "Times-BoldItalic": boldItalic,
    Helvetica: helvetica,
  }).map(([name, data]) => [
    `data/${name}.afm`,
    btoa(data.replace(/^KPX .*$/gm, "")),
  ]),
);
