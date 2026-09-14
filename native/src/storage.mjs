import {validate} from '../../docs/iphone/app/model.mjs';
export function createProjectStore({read,write,mirror}){
  let queue=Promise.resolve();
  return {
    async readProject(){
      let cached=null;try{cached=mirror.getItem('patterncanvas-iphone-v1');}catch{}
      const candidates=[cached,await read('project.json'),await read('project.previous.json')].filter(Boolean);
      if(!candidates.length)return null;
      const valid=candidates.flatMap(raw=>{try{const p=validate(JSON.parse(raw));return [{raw,date:p.updatedAt}];}catch{return [];}}).sort((a,b)=>b.date-a.date);
      if(!valid.length)throw Error('保存データを読み込めませんでした');
      return valid[0].raw;
    },
    writeProject(data){
      validate(JSON.parse(data));
      try{mirror.setItem('patterncanvas-iphone-v1',data);}catch{}
      const task=queue.catch(()=>{}).then(async()=>{
        const previous=await read('project.json');
        let validPrevious=false;try{if(previous){validate(JSON.parse(previous));validPrevious=true;}}catch{}
        if(validPrevious)await write('project.previous.json',previous);
        await write('project.json',data);
      });queue=task;return task;
    }
  };
}
