import type { ArticleImage } from "@/lib/types";

export function ArticleImageWidthFields({image,onChange,label="画像"}:{image:ArticleImage;onChange:(image:ArticleImage)=>void;label?:string}) {
  const desktop=image.widthPercent??100,mobile=image.mobileWidthPercent??desktop;
  return <fieldset className="article-image-width-fields">
    <legend>{label}の横幅</legend>
    <label>PC <output>{desktop}%</output><input aria-label={label+"のPC幅"} type="range" min={10} max={100} value={desktop} onChange={e=>onChange({...image,widthPercent:Number(e.target.value)})}/></label>
    <label>スマホ <output>{mobile}%</output><input aria-label={label+"のスマホ幅"} type="range" min={10} max={100} value={mobile} onChange={e=>onChange({...image,mobileWidthPercent:Number(e.target.value)})}/></label>
    <small>{image.mobileWidthPercent===undefined?"スマホはPCと同じ幅を使用中":"スマホの幅を個別に設定中"}</small>
    {image.mobileWidthPercent!==undefined?<button type="button" onClick={()=>{const next={...image};delete next.mobileWidthPercent;onChange(next);}}>スマホをPCと同じ幅に戻す</button>:null}
  </fieldset>;
}
