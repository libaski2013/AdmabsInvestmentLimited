import React from 'react';
import { createCompanyPdf, companyPdfTable } from '/src/documents/branding.js';
import CompanyLetterhead from '/src/documents/CompanyLetterhead.jsx';
import { printCompanyDocument } from '/src/documents/print.js';
const site={companyName:'TEST COMPANY LTD',address:'TEST OFFICE',phone:'TEST-PHONE',email:'test@example.invalid',logoUrl:'/admabs-app-icon.png'};
export default function DocumentFixture(){
  const download=async()=>{
    const pdf=await createCompanyPdf({site,title:'Document pagination check'});
    companyPdfTable(pdf,{title:'Long invoice rows',headers:['Reference','Description','Amount'],widths:[30,130,26],y:pdf.bodyTop,
      rows:Array.from({length:80},(_,i)=>[`TEST-${i+1}`,('Fictional long product description for safe pagination. ').repeat(8),'GHC 100.00'])});
    document.body.dataset.pdfPages=String(pdf.getNumberOfPages());pdf.finishCompanyDocument();pdf.save('TEST-branded-document.pdf');
  };
  return <><p>DO NOT PRINT THIS APPLICATION MENU</p><article id="print-fixture"><CompanyLetterhead site={site} title="Sample receipt"/><p>TEST INVOICE 123</p><label>Period <input type="date" defaultValue="2026-11-07"/></label><table><thead><tr><th>Item</th><th>Total</th></tr></thead><tbody><tr><td>TEST tyre</td><td>GHC 100.00</td></tr></tbody></table><button>DO NOT PRINT THIS BUTTON</button></article><button onClick={download}>Download branded fixture</button><button onClick={()=>printCompanyDocument(document.getElementById('print-fixture'),{site,title:'Sample receipt',receipt:true})}>Print branded fixture</button></>;
}
