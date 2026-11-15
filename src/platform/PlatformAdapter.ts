export type RuntimePlatform='browser'|'capacitor'|'tauri';
export interface PlatformAdapter {
  readonly platform:RuntimePlatform;
  readonly native:boolean;
  exportText(filename:string,contents:string):Promise<boolean>;
  importText():Promise<string|null>;
}

/** Platform services stay at the edge; game systems keep the same logic and save schema. */
export class WebPlatformAdapter implements PlatformAdapter {
  readonly platform:RuntimePlatform;
  get native():boolean{return this.platform!=='browser';}
  constructor(){const w=window as Window&{__TAURI_INTERNALS__?:unknown};
    this.platform=w.__TAURI_INTERNALS__?'tauri':Capacitor.isNativePlatform()?'capacitor':'browser';}
  async exportText(filename:string,contents:string):Promise<boolean>{
    if(this.platform==='capacitor'){
      const path=`exports/${Date.now()}-${filename}`;
      try{await Filesystem.writeFile({path,data:contents,directory:Directory.Cache,recursive:true});const file=await Filesystem.getUri({path,directory:Directory.Cache});await Share.share({title:'Ottoman sefer kaydı',text:'Sefer kaydı JSON dosyası',url:file.uri,dialogTitle:'Kaydı dışa aktar'});return true;}
      catch(error){console.error('Native save export failed:',error);return false;}
      finally{void Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>undefined);}
    }
    const file=new File([contents],'ottoman-save.json',{type:'application/json'});
    const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=filename;link.style.display='none';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
  }
  importText():Promise<string|null>{return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const file=input.files?.[0];if(!file){resolve(null);return;}try{resolve(await file.text());}catch{resolve(null);}};input.click();});}
}
export const platformAdapter:PlatformAdapter=new WebPlatformAdapter();
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

