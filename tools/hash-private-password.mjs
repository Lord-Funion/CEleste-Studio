import {createHash} from 'node:crypto';

const password=process.argv.slice(2).join(' ');
if(!password){
  console.error('Usage: node tools/hash-private-password.mjs "new password"');
  process.exit(2);
}
console.log(createHash('sha256').update(password,'utf8').digest('hex'));
