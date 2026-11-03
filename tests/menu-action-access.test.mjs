import test from 'node:test';
import assert from 'node:assert/strict';
import {hasMenuPermission,entityPermissionMenu,productionMenuRights,workflowActionAllowed,productionMenus} from '../lib/menu-action-access.mjs';
import {permissionProfiles,withBusinessViews} from '../lib/user-permission-profiles.mjs';
import {additivePermissionCatalog} from '../lib/additive-permission-catalog.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctProduction} from '../scripts/local/production-corrections.mjs';
const named={htndiem:'KHSX',nttvy:'KHSX',cnphuong:'QLSX',ntnphung:'QLSX',dhtin:'QLSX',ltphong:'KHO',httung:'KHO',nttnghiem:'KHO',tpnhi:'KHO'};
for(const [login,department] of Object.entries(named))test(`${login}: department profile edits only assigned menus, cross-department views do not grant edits`,()=>{
 const grants=permissionProfiles[department].grants,actor={login,grants:withBusinessViews(grants)};
 for(const group of additivePermissionCatalog)for(const menu of group.menus){
  const scope=`${group.group} / ${menu.label}`;
  assert.equal(hasMenuPermission(actor,scope,['Xem']),true);
  for(const action of ['Thêm','Sửa','Xác nhận','Hủy xác nhận','Hủy','Xóa'])assert.equal(hasMenuPermission(actor,scope,[action]),grants.includes(`${scope} / ${action}`),`${scope} / ${action}`);
 }
});
test('personal grants stay usable without granting sibling menus, including warehouse and production',()=>{
 for(const [own,other] of [['Quản lý kho / Nhập kho','Quản lý kho / Xuất kho'],[productionMenus.schedule,productionMenus.work],[productionMenus.progress,productionMenus.correction]]){
 const actor={login:'custom',grants:withBusinessViews([`${own} / Sửa`])};assert.equal(hasMenuPermission(actor,own,['Sửa']),true);assert.equal(hasMenuPermission(actor,other,['Sửa']),false);
 }
 assert.equal(entityPermissionMenu('versions'),null);assert.equal(entityPermissionMenu('unknown'),null);
 assert.equal(entityPermissionMenu('warehouse_in'),'Quản lý kho / Nhập kho');
 assert.equal(entityPermissionMenu('sku'),'Dữ liệu cơ bản / SKU Master');
 assert.equal(hasMenuPermission({isAdmin:true},productionMenus.work,['Thêm']),true);
});
test('view-only and sibling grants cannot call production mutations or correction handlers',async()=>{
 for(const grants of [withBusinessViews([]),withBusinessViews([`${productionMenus.schedule} / Sửa`]),withBusinessViews(['Quản lý sản xuất / Capacity tuần / Xác nhận'])]){
 const actor={login:'restricted',grants};
 await assert.rejects(mutateProductionWorkflow(null,{action:'start'},actor),{status:403});
 await assert.rejects(correctProduction(null,{sourceTimeCorrection:true},actor),{status:403});
 await assert.rejects(correctProduction(null,{operation:'adjust-report-hours'},actor),{status:403});
 }
 const actor={login:'work-only',grants:[`${productionMenus.work} / Thêm`]};
 for(const action of ['schedule','warehouse-duty','approve-hours','line-movement'])await assert.rejects(mutateProductionWorkflow(null,{action},actor),{status:403});
 assert.deepEqual(productionMenuRights(actor),{work:true,manager:false,confirm:false,correct:false});
 const hr={grants:[`${productionMenus.schedule} / Ghi vắng mặt`]};assert.equal(workflowActionAllowed(hr,{action:'line-absence'}),true);assert.equal(workflowActionAllowed(hr,{action:'warehouse-duty'}),false);
});
test('real HTTP rejects sibling warehouse rights and production rights used for master edits',async()=>{
 const {mkdtempSync,mkdirSync}=await import('node:fs');const {resolve}=await import('node:path');
 const {openDatabase,migrate,root}=await import('../scripts/local/database.mjs');
 const {passwordRecord}=await import('../worker/password-auth.mjs');const {siteApi}=await import('../worker/site-api.mjs');
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'menu-rights-')));
 try{await migrate(c.db);const env={DB:c.db,FILES:c.bucket},login='limited-menu',testPassword=crypto.randomUUID();const pass=await passwordRecord(testPassword);
 await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,role:'USER',active:true,department:'KHO'}),'test','test').run();
 await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,pass.hash,pass.salt,pass.iterations,'test').run();
 await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('permissions',login,JSON.stringify({login,active:true,permissionMode:'CUSTOM',permissions:'Quản lý kho / Nhập kho / Sửa · Quản lý sản xuất / Capacity tuần / Xác nhận'}),'test','test').run();
 const request=(path,body,cookie='')=>new Request('https://test.invalid'+path,{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json',cookie},body:JSON.stringify(body)});
 const auth=await siteApi(request('/api/auth/login',{login,password:testPassword}),env);assert.equal(auth.status,200);const cookie=auth.headers.get('set-cookie').split(';')[0];
 for(const [path,body] of [['/api/records',{entity:'warehouse_out',key:'forbidden',payload:{status:'Nháp'},expectedRevision:null}],['/api/inventory-import',{action:'confirm'}],['/api/production-report',{action:'review',reportId:'forbidden'}],['/api/production-workflow',{action:'start'}],['/api/production-correction',{action:'apply',sourceTimeCorrection:true}]]){
 const result=await siteApi(request(path,body,cookie),env);assert.equal(result.status,403,path);
 }
 assert.equal((await c.db.prepare("SELECT COUNT(*) n FROM app_records WHERE record_key='forbidden'").first()).n,0);
 }finally{await c.close();}
});
test('actual toolbar callback blocks import, mark-planned, warehouse sibling and production sibling mutations',async()=>{
 const {readFileSync}=await import('node:fs');const {default:ts}=await import('typescript');const {default:vm}=await import('node:vm');
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const marker='<ToolbarPermissions.Provider value={(name,label)=>{';const start=source.indexOf(marker)+marker.length,end=source.indexOf('}}><BusinessSkuContext.Provider',start);
 assert.ok(start>marker.length&&end>start);
 const code=ts.transpileModule('result=(name,label)=>{'+source.slice(start,end)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const actor={kind:'account',login:'warehouse',grants:withBusinessViews(['Quản lý kho / Nhập kho / Sửa','Quản lý sản xuất / Capacity tuần / Sửa'])};
 const scope={session:actor,view:'warehouse',activeChild:'warehouse-out',childGrantLabels:{'warehouse:warehouse-out':'Quản lý kho / Xuất kho','planning:demand':'Kế hoạch sản xuất / Demand_event'},normalizedGrant:v=>String(v).toLowerCase().replaceAll('_',' ').trim(),hasMenuPermission,isDataExportAction:()=>false};vm.runInNewContext(code,scope);
 for(const [name,label] of [['WarehouseContent','Sửa'],['ProductionManagement','Thêm'],['ProductionManagement','Lưu'],['DemandEventViewV3','Nhập dữ liệu lịch sử'],['DemandEventViewV3','Đánh dấu đã lập kế hoạch']])assert.equal(scope.result(name,label),false,`${name} ${label}`);
 assert.equal(scope.result('DemandEventViewV3','Tra cứu'),true);
});
