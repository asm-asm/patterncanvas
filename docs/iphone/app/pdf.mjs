// A minimal PDF writer: one JPEG image per page, drawn to fill the page. No fonts, no libraries, works offline.
// pages: [{widthMm, heightMm, jpeg: Uint8Array, pixelWidth, pixelHeight}] → Uint8Array (application/pdf)
export function buildPdf(pages,{title='編み図'}={}){
 if(!pages.length)throw Error('ページがありません');
 const enc=new TextEncoder(),chunks=[],offsets=[];let length=0;
 const push=part=>{const bytes=typeof part==='string'?enc.encode(part):part;chunks.push(bytes);length+=bytes.length;};
 const object=(id,body,stream)=>{offsets[id]=length;push(`${id} 0 obj\n${body}\n`);if(stream){push('stream\n');push(stream);push('\nendstream\n');}push('endobj\n');};
 const pt=mm=>(mm*72/25.4).toFixed(2);
 // 1 catalog, 2 pages, 3 info, then per page: page, content, image
 const first=4,kids=pages.map((_,i)=>`${first+i*3} 0 R`).join(' ');
 // Header, then a comment of high bytes so tools treat the file as binary.
 push('%PDF-1.4\n%');push(new Uint8Array([0xe2,0xe3,0xcf,0xd3,0x0a]));
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');
 object(2,`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
 object(3,`<< /Title ${utf16(title)} /Producer (PatternCanvas) /Creator ${utf16('編みものノート')} >>`);
 pages.forEach((page,i)=>{
  const id=first+i*3,w=pt(page.widthMm),h=pt(page.heightMm),content=enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
  object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`);
  object(id+1,`<< /Length ${content.length} >>`,content);
  object(id+2,`<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`,page.jpeg);
 });
 const count=first+pages.length*3,xref=length;
 push(`xref\n0 ${count}\n0000000000 65535 f \n`+Array.from({length:count-1},(_,i)=>`${String(offsets[i+1]).padStart(10,'0')} 00000 n \n`).join(''));
 push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 const out=new Uint8Array(length);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;
}
// PDF text strings outside Latin-1 are written as UTF-16BE with a byte-order mark, in hex.
function utf16(text){let hex='FEFF';for(const ch of text){const c=ch.codePointAt(0);const units=c>0xffff?[0xd800+((c-0x10000)>>10),0xdc00+((c-0x10000)&0x3ff)]:[c];for(const u of units)hex+=u.toString(16).padStart(4,'0').toUpperCase();}return `<${hex}>`;}
