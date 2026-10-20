import type { ReportMetric, ReportTone } from './report-model';

export type ReportRGB=[number,number,number];
export const REPORT_PALETTE:Record<ReportTone,{ink:ReportRGB;soft:ReportRGB;hex:string}>={
  blue:{ink:[37,99,235],soft:[237,245,255],hex:'#2563eb'},
  green:{ink:[5,150,105],soft:[235,249,242],hex:'#059669'},
  red:{ink:[225,29,72],soft:[255,240,244],hex:'#e11d48'},
  violet:{ink:[109,40,217],soft:[245,240,255],hex:'#6d28d9'},
  amber:{ink:[180,83,9],soft:[255,248,232],hex:'#b45309'},
  slate:{ink:[100,116,139],soft:[242,245,249],hex:'#64748b'},
};
export const REPORT_TONES:ReportTone[]=['blue','green','violet','amber','red','slate'];
export const reportMetricTone=(metric:ReportMetric,index:number)=>metric.tone||REPORT_TONES[index%REPORT_TONES.length];
