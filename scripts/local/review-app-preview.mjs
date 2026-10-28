// Starts the real app with existing TEST authentication, plus an in-memory review provider.
import {configuration} from './database.mjs';
configuration();
if(process.env.NODE_ENV==='production')throw Error('Preview is development TEST only.');
process.env.ONSPA_TEST_REVIEW_PREVIEW='1';
await import('./run.mjs');
