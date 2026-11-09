'use client';
type Metric = Record<string, unknown>;
const missing='Thiếu căn cứ đã lưu';
const numeric=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const display=(value:unknown)=>numeric(value)?value.toLocaleString('vi-VN'):missing;
export function EngineCalculationDetails({metric,suggested}:{metric?:Metric|null;suggested:unknown}) {
 const m=metric||{},forecast=(m.forecastBasis&&typeof m.forecastBasis==='object'?m.forecastBasis:{}) as Metric;
 const days=numeric(m.leadTime)&&numeric(m.safetyDays)?m.leadTime+m.safetyDays:null;
 const supply=numeric(m.stock)&&numeric(m.inTransit)?m.stock+m.inTransit:null;
 const hours=numeric(suggested)&&numeric(m.standardHours)?suggested*m.standardHours:null;
 const formula=numeric(m.dailyDemand)&&numeric(days)&&numeric(m.rop)&&Math.abs(m.dailyDemand*days-m.rop)<1e-9;
 return <>
  <section><h3>Forecast Kinh doanh · căn cứ đã lưu</h3><dl>
   {(['f30','f60','f90','d30','d60'] as const).map((key,index)=><div key={key}><dt>{['Forecast 30D','Forecast 60D','Forecast 90D','Daily Demand 30D','Daily Demand 60D'][index]}</dt><dd>{display(forecast[key])}</dd></div>)}
   <div className="highlight-row"><dt>Demand dùng cho SX</dt><dd>{display(m.dailyDemand)}{numeric(m.dailyDemand)?' SP/ngày':''}</dd></div>
  </dl></section>
  <section><h3>Nguồn cung và ngưỡng bổ sung</h3><dl>
   <div><dt>Tồn kho ERP</dt><dd>{display(m.stock)}</dd></div>
   <div><dt>Đang sản xuất/đang đi</dt><dd>{display(m.inTransit)}</dd></div>
   <div><dt>Demand Event tuần</dt><dd>{display(m.eventWeek)}</dd></div>
   <div><dt>Nguồn cung khả dụng</dt><dd>{display(supply)}</dd></div>
   <div><dt>Lead time + Safety</dt><dd>{numeric(days)?`${display(m.leadTime)} + ${display(m.safetyDays)} = ${display(days)} ngày`:missing}</dd></div>
   <div className="highlight-row"><dt>ROP</dt><dd>{formula?`${display(m.dailyDemand)} × ${display(days)} = ${display(m.rop)}`:`ROP đã lưu: ${display(m.rop)}`}{!formula&&<p>{missing} để trình bày công thức khớp kết quả.</p>}</dd></div>
  </dl></section>
  <section className="calc-result"><h3>Kết quả đề xuất</h3>
   <p>Nguồn cung được so sánh với ROP, cộng Demand Event và làm tròn theo MOQ {display(m.moq)}.</p>
   <div><span>SL cần bổ sung trước MOQ</span><b>{display(m.replenish)}</b></div>
   <div><span>Số lượng đề xuất tuần</span><b>{display(suggested)} SP</b></div>
   <p className="calc-reason"><b>Lý do:</b> {typeof m.reason==='string'&&m.reason?m.reason:missing}</p>
   <div><span>Tổng giờ công dự kiến</span><b>{display(hours)}{numeric(hours)?' giờ':''}</b></div>
  </section>
 </>;
}
