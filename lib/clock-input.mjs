// Wall-clock values only: never parse these with the browser timezone.
export const validClockTime=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value));
export const clockTimePattern='(?:[01][0-9]|2[0-3]):[0-5][0-9]';
export function localDateTimeError(value,{min='',max='',required=true}={}){
 if(!value)return required?'Chọn ngày và giờ 24h (HH:mm).':'';
 if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))return 'Nhập ngày và giờ 24h hợp lệ (00:00–23:59).';
 const date=value.slice(0,10),parsed=new Date(`${date}T00:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return 'Ngày không hợp lệ.';
 if(min&&value<min)return 'Thời gian phải từ giới hạn bắt đầu trở đi.';
 if(max&&value>max)return 'Thời gian phải trước hoặc bằng giới hạn kết thúc.';
 return '';
}
