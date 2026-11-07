import { companyBrand, loadCompanyBrand } from "./branding.js";
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function printCompanyDocument(target, { site, title = "ADMABS document", receipt = false } = {}) {
  const nodes = (Array.isArray(target) ? target : [target]).filter(Boolean);
  if (!nodes.length) { window.alert("The document is not ready to print."); return; }
  const preview = window.open("about:blank", "_blank");
  if (!preview) { window.alert("Allow pop-ups to preview and print this ADMABS document."); return; }
  const brand = site ? companyBrand(site) : await loadCompanyBrand();
  const content = nodes.map(node => {
    const clone = node.cloneNode(true);
    const originals = node.querySelectorAll("canvas");
    clone.querySelectorAll("canvas").forEach((canvas, i) => { try { const image = document.createElement("img"); image.src = originals[i].toDataURL(); image.style.maxWidth = "100%"; canvas.replaceWith(image); } catch { canvas.remove(); } });
    clone.classList.remove("hidden", "statement-document", "receipt-print", "statement-qr-document");
    clone.hidden = false;
    clone.querySelectorAll("[data-company-letterhead],button,nav,script,input[type=password]").forEach(element => element.remove());
    const originalFields = node.querySelectorAll("input:not([type=password]),select,textarea");
    clone.querySelectorAll("input,select,textarea").forEach((field, i) => { const original = originalFields[i] || field; const text = document.createElement("span"); text.textContent = original.tagName === "SELECT" ? original.selectedOptions?.[0]?.textContent || original.value : original.value; field.replaceWith(text); });
    clone.querySelectorAll("*").forEach(element => { for (const attr of [...element.attributes]) if (/^on/i.test(attr.name)) element.removeAttribute(attr.name); });
    return clone.outerHTML;
  }).join("\n");
  const styles = [...document.querySelectorAll("link[rel=stylesheet],style")].map(element => element.tagName === "LINK" ? `<link rel="stylesheet" href="${escape(element.href)}">` : element.outerHTML).join("\n");
  const contact = [brand.phone, brand.email].filter(Boolean).join(" | ");
  brand.logoUrl = new URL(brand.logoUrl, window.location.href).href;
  preview.document.open(); preview.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title>${styles}
    <style>body{margin:0!important;background:#fff!important;color:#172033!important;font-family:Arial,sans-serif!important;max-width:none!important;min-width:0!important;height:auto!important;overflow:visible!important}.document-shell{max-width:${receipt ? "80mm" : "190mm"};margin:8mm auto;width:100%;border-collapse:collapse}.document-shell>thead{display:table-header-group}.document-shell>tfoot{display:table-footer-group}.document-shell>thead>tr>td{padding-bottom:5mm}.document-brand{text-align:center;border-bottom:2px solid #143782;padding-bottom:4mm}.document-brand img{width:${receipt ? "58mm" : "85mm"};height:${receipt ? "18mm" : "25mm"};object-fit:contain;display:block;margin:0 auto 2mm}.document-brand strong{display:block;color:#143782;font-size:${receipt ? "13px" : "18px"}}.document-brand p{font-size:10px;margin:1mm 0}.document-brand h1{font-size:14px;margin:3mm 0 0}.document-foot{border-top:1px solid #143782;font-size:8px;color:#475569;padding-top:2mm}.print-content{font-size:11px}.print-content>div{max-height:none!important;overflow:visible!important;position:static!important}.print-content table{width:100%;border-collapse:collapse;font-size:10px}.print-content th,.print-content td{padding:2mm;border-bottom:1px solid #dce4ef;text-align:left;overflow-wrap:anywhere}.print-content th{background:#143782!important;color:white!important}.print-content thead{display:table-header-group}.print-content tr{break-inside:avoid}.print-content img,.print-content svg{max-width:100%}.print-content .overflow-x-auto,.print-content .max-h-64{overflow:visible!important;max-height:none!important}.print-content header{position:static!important}.print-content *{box-shadow:none!important} @media print{@page{margin:10mm}body *{visibility:visible!important}.document-shell{margin:0;max-width:100%}a[href]:after{content:none!important}}</style></head><body>
    <table class="document-shell"><thead><tr><td><div class="document-brand"><img src="${escape(brand.logoUrl)}" alt="ADMABS"><strong>${escape(brand.companyName)}</strong><p>HEAD OFFICE: ${escape(brand.address)}</p>${contact ? `<p>${escape(contact)}</p>` : ""}<h1>${escape(title)}</h1></div></td></tr></thead>
    <tbody><tr><td class="print-content">${content}</td></tr></tbody><tfoot><tr><td class="document-foot">Copyright ${new Date().getFullYear()} ${escape(brand.companyName)}. Computer-generated document.</td></tr></tfoot></table></body></html>`); preview.document.close();
  const brandImage = preview.document.querySelector(".document-brand img");
  brandImage.addEventListener("error", () => { const fallback = new URL("/admabs-app-icon.png", window.location.href).href; if (brandImage.src !== fallback) brandImage.src = fallback; });
  await Promise.all([...preview.document.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; setTimeout(resolve, 5000); })));
  await preview.document.fonts?.ready;
  preview.focus(); preview.print();
}
