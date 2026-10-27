import { scryptSync, randomBytes } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { root,configuration } from './database.mjs';
configuration();
const prompt=createInterface({input:process.stdin,output:process.stdout});
try {
 const login=(await prompt.question('Tên tài khoản TEST: ')).trim();
 console.log('Mật khẩu chỉ lưu dạng hash tại .local-data/auth.json, không đưa vào bàn giao. Dòng nhập có hiển thị trên terminal.');
 const password=await prompt.question('Mật khẩu TEST (đúng 4 chữ số): ');
 if(!/^[a-zA-Z0-9_-]{3,40}$/.test(login)||!/^\d{4}$/.test(password))throw new Error('Tên tài khoản hoặc độ dài mật khẩu không hợp lệ.');
 const salt=randomBytes(24).toString('hex');mkdirSync(resolve(root,'.local-data'),{recursive:true});
 writeFileSync(resolve(root,'.local-data/auth.json'),JSON.stringify({login,salt,hash:scryptSync(password,salt,64).toString('hex')}),{flag:'wx',mode:0o600});
 console.log('Đã tạo tài khoản TEST. Không có mật khẩu trong mã nguồn hoặc seed.');
}finally{prompt.close();}
