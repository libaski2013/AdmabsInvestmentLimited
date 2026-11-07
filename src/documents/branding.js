export const DEFAULT_COMPANY = "ADMABS Investment Company Limited";
export const cleanPdfText = value => String(value ?? "").replaceAll("GH₵", "GHC").replace(/[–—]/g, "-").replace(/\u00a0/g, " ");
export function companyBrand(site = {}) {
  return { companyName: site.companyName || DEFAULT_COMPANY, logoUrl: site.logoUrl || "/admabs-app-icon.png",
    address: site.address || "Ghana", phone: site.phone || "", email: site.email || "" };
}
export async function loadCompanyBrand() {
  const base = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");
  try { const response = await fetch(`${base}/site/content`); if (response.ok) return companyBrand(await response.json()); } catch {}
  return companyBrand();
}
async function logoImage(src) {
  return new Promise(resolve => {
    const image = new Image(); image.crossOrigin = "anonymous";
    const timeout = setTimeout(() => resolve(null), 5000);
    image.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 260;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, 900, 260);
        const scale = Math.min(900 / image.naturalWidth, 260 / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, (900 - w) / 2, (260 - h) / 2, w, h); resolve(canvas.toDataURL("image/jpeg", .94));
      } catch { resolve(null); }
    };
    image.onerror = () => { clearTimeout(timeout); resolve(null); }; image.src = src;
  });
}
export async function createCompanyPdf({ site, title = "ADMABS document" } = {}) {
  const brand = site ? companyBrand(site) : await loadCompanyBrand();
  let logo = await logoImage(brand.logoUrl);
  if (!logo && brand.logoUrl !== "/admabs-app-icon.png") logo = await logoImage("/admabs-app-icon.png");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: cleanPdfText(title), author: brand.companyName, creator: "ADMABS Integrated System" });
  const header = () => {
    let y = 10;
    if (logo) { pdf.addImage(logo, "JPEG", 60, y, 90, 26); y += 31; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(20, 55, 130);
    const names = pdf.splitTextToSize(cleanPdfText(brand.companyName), 184);
    pdf.text(names, 105, y, { align: "center" }); y += names.length * 5 + 1;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(55, 65, 81);
    for (const value of [`HEAD OFFICE: ${brand.address}`, [brand.phone, brand.email].filter(Boolean).join(" | ")].filter(Boolean)) {
      const lines = pdf.splitTextToSize(cleanPdfText(value), 182);
      pdf.text(lines, 105, y, { align: "center" }); y += lines.length * 3.5 + 1;
    }
    pdf.setDrawColor(20, 55, 130); pdf.setLineWidth(.8); pdf.line(12, y + 1, 198, y + 1); y += 8;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(15, 23, 42);
    const titles = pdf.splitTextToSize(cleanPdfText(title).toUpperCase(), 182);
    pdf.text(titles, 105, y, { align: "center" }); y += titles.length * 4.2 + 5;
    pdf.bodyTop = y;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(15, 23, 42);
  };
  const originalAddPage = pdf.addPage.bind(pdf);
  pdf.addPage = (...args) => { originalAddPage(...args); header(); return pdf; };
  pdf.finishCompanyDocument = () => {
    const count = pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      pdf.setPage(page); pdf.setDrawColor(20, 55, 130); pdf.setLineWidth(1); pdf.line(12, 283, 198, 283);
      pdf.setDrawColor(190, 24, 24); pdf.line(12, 283, 42, 283);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(55, 65, 81);
      pdf.text(cleanPdfText(`Copyright ${new Date().getFullYear()} ${brand.companyName}. All rights reserved.`), 12, 288, { maxWidth: 160 });
      pdf.text("Computer-generated ADMABS document", 12, 292);
      pdf.text(`Page ${page} of ${count}`, 198, 292, { align: "right" });
    }
    return pdf;
  };
  header(); return pdf;
}

// Wrap long cells and repeat both letterhead and column headings on every page.
export function companyPdfTable(pdf, { title, headers, rows, widths, y }) {
  const scale = 186 / widths.reduce((sum, width) => sum + width, 0);
  widths = widths.map(width => width * scale);
  const drawHeading = () => {
    if (title) { pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.text(cleanPdfText(title), 12, y); y += 5; }
    pdf.setFillColor(20, 55, 130); pdf.rect(12, y, 186, 9, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(255);
    let x = 14; headers.forEach((h, i) => { pdf.text(cleanPdfText(h), x, y + 5.5, { maxWidth: widths[i] - 3 }); x += widths[i]; });
    y += 14; pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
  };
  if (y + 24 > 274) { pdf.addPage(); y = pdf.bodyTop; }
  drawHeading();
  for (const row of rows) {
    const cells = row.map((value, i) => pdf.splitTextToSize(cleanPdfText(value || value === 0 ? value : "-"), widths[i] - 4));
    let offset = 0; const length = Math.max(...cells.map(cell => cell.length), 1);
    while (offset < length) {
      if (y + 8 > 274) { pdf.addPage(); y = pdf.bodyTop; drawHeading(); }
      const take = Math.max(1, Math.min(length - offset, Math.floor((274 - y - 3) / 3.5)));
      let x = 14;
      cells.forEach((cell, i) => { const part = cell.slice(offset, offset + take); if (part.length) pdf.text(part, x, y); x += widths[i]; });
      y += Math.max(8, take * 3.5 + 3); offset += take;
      pdf.setDrawColor(225); pdf.setLineWidth(.2); pdf.line(12, y - 2, 198, y - 2);
      if (offset < length) { pdf.addPage(); y = pdf.bodyTop; drawHeading(); }
    }
  }
  return y + 5;
}
