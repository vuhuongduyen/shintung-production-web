import {apiFetch} from './data-sync';
// Production screens always use actual records; old example preferences are ignored.
export function productionApiFetch(path:string,init?:RequestInit) {
  return apiFetch(path,init);
}
