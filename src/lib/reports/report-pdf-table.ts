import type { ReportTable,ReportValue } from './report-model';

export type PdfReportTable=ReportTable&{columnWidths?:Record<number,number>};
const unknown=(value:ReportValue)=>['','-','Not shown','Not available'].includes(String(value).trim());

/** Presentation only: preserve item quantities and raw order IDs while avoiding
 * repeated pupil/order cells and columns that contain no recorded information. */
export function preparePdfReportTable(table:ReportTable):PdfReportTable {
  if(table.title!=='Fully paid orders still to check for pickup'||table.columns.length!==9||!table.rows.length)return table;
  const groups=new Map<string,ReportValue[][]>();
  table.rows.forEach((row,index)=>{const key=unknown(row[1])?`unknown-${index}`:JSON.stringify([row[0],row[1]]);const items=groups.get(key)||[];items.push(row);groups.set(key,items);});
  const showSize=table.rows.some(row=>!unknown(row[3])),showOrdered=table.rows.some(row=>!unknown(row[4]));
  const showCollected=table.rows.some(row=>!unknown(row[5])),showNeeded=table.rows.some(row=>!unknown(row[6]));
  const showPayment=table.rows.some(row=>!unknown(row[7])),showPickup=table.rows.some(row=>!unknown(row[8]));
  const missing=[!showSize?'sizes':'',!showOrdered?'ordered quantities':'',!showCollected?'collected quantities':'',!showNeeded?'remaining quantities':'',!showPayment?'payment dates':'',!showPickup?'expected pickup dates':''].filter(Boolean);
  const columns=['Pupil / admission','Order reference','Uniforms and quantities',...(showPayment?['Payment date']:[]),...(showPickup?['Expected pickup']:[])];
  const rows=[...groups.values()].map(items=>{
    const uniforms=items.map(row=>[
      String(row[2]),
      showSize?`size: ${unknown(row[3])?'not shown':row[3]}`:'',
      showOrdered?`ordered: ${unknown(row[4])?'not shown':row[4]}`:'',
      showCollected?`collected: ${unknown(row[5])?'not shown':row[5]}`:'',
      showNeeded?`still needed: ${unknown(row[6])?'not shown':row[6]}`:'',
    ].filter(Boolean).join('; ')).join('\n');
    const distinct=(index:number)=>[...new Set(items.map(row=>String(row[index])))].join('\n');
    return [items[0][0],items[0][1],uniforms,...(showPayment?[distinct(7)]:[]),...(showPickup?[distinct(8)]:[])];
  });
  const dates=Number(showPayment)+Number(showPickup),widths:Record<number,number>={0:37,1:33,2:172-70-dates*25};
  for(let index=3;index<columns.length;index++)widths[index]=25;
  return {...table,columns,rows,columnWidths:widths,moneyColumns:undefined,percentColumns:undefined,total:undefined,
    description:`${table.description||''} ${table.rows.length} item entries are grouped into ${groups.size} orders; each item and its recorded quantities remain listed.${missing.length?` Not recorded anywhere in this list: ${missing.join(', ')}.`:''}`.trim()};
}
