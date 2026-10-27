// Keep this project's signing identity stable. Never overwrite an existing key.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'sign','release');
const privatePath=path.join(folder,'private.pem'),certPath=path.join(folder,'certificate.pem');
if(process.argv.includes('--init')&&!fs.existsSync(privatePath)&&!fs.existsSync(certPath)){
 const X509Util=require('jsrsasign').KJUR.asn1.x509.X509Util;
 const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,
  publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const start=new Date(Date.now()-86400000),end=new Date();end.setUTCFullYear(end.getUTCFullYear()+20);
 const stamp=d=>d.toISOString().replace(/[-:]/g,'').slice(0,8)+d.toISOString().slice(11,19).replace(/:/g,'')+'Z';
 const cert=X509Util.newCertPEM({serial:{hex:'01'+crypto.randomBytes(15).toString('hex')},sigalg:'SHA256withRSA',
  issuer:{str:'/CN=QLz4/OU=Wrist Xiangqi/O=QLz4'},subject:{str:'/CN=QLz4/OU=Wrist Xiangqi/O=QLz4'},
  notbefore:stamp(start),notafter:stamp(end),sbjpubkey:keys.publicKey,cakey:keys.privateKey});
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(privatePath,keys.privateKey,{flag:'wx',mode:0o600});
 fs.writeFileSync(certPath,cert,{flag:'wx'});
 console.log('Created project release signing identity under sign/release (excluded from Git).');
}
if(!fs.existsSync(privatePath)||!fs.existsSync(certPath))throw new Error('Release signing is missing or incomplete. First-time setup: npm run signing:init. Restore the original sign/release files for existing releases.');
const cert=new crypto.X509Certificate(fs.readFileSync(certPath));
const key=crypto.createPrivateKey(fs.readFileSync(privatePath));
const pub=crypto.createPublicKey(key).export({format:'der',type:'spki'});
if(!pub.equals(cert.publicKey.export({format:'der',type:'spki'})))throw new Error('Signing key and certificate do not match');
if(Date.parse(cert.validTo)<=Date.now())throw new Error('Release certificate expired');
const toolkit=path.join(root,'node_modules/@aiot-toolkit/aiotpack/lib/compiler/javascript/vela/utils/signature/pem/certificate.pem');
if(fs.existsSync(toolkit)&&new crypto.X509Certificate(fs.readFileSync(toolkit)).fingerprint256===cert.fingerprint256)throw new Error('Refusing toolkit debug certificate for release');
console.log('Release certificate SHA256: '+cert.fingerprint256);
