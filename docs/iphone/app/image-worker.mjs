import {quantize} from './model.mjs';
import {recommendColors} from './image-model.mjs';
self.onmessage=({data})=>{try{const {bytes,w,h,count}=data;self.postMessage({pattern:quantize(bytes,w,h,count),advice:recommendColors(bytes,w,h)});}catch(error){self.postMessage({error:error.message});}};
