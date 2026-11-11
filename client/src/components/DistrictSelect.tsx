import {TASHKENT_CITY_DISTRICTS,TASHKENT_REGION_DISTRICTS} from '../lib/districts';
export function DistrictSelect({value,onChange,label='Yetkazish tumani'}:{value:string;onChange:(v:string)=>void;label?:string}){
 return <label className="block text-sm">{label}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} className="block mt-2 w-full p-3 border rounded-xl"><option value="">Tanlang (boshqa hududni manzilda yozing)</option><optgroup label="Toshkent shahri">{TASHKENT_CITY_DISTRICTS.map(d=><option key={d}>{d}</option>)}</optgroup><optgroup label="Toshkent viloyati">{TASHKENT_REGION_DISTRICTS.map(d=><option key={d}>{d}</option>)}</optgroup></select></label>;
}
