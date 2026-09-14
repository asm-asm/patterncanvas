import config from '../access/config.mjs';
import {mountGate} from '../access/gate.mjs';
if(config.enabled)await mountGate({page:'success'});else document.body.textContent='有料版は準備中です。';
