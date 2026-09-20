import {realpath,readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {requireValue} from './domain.js';
const exec=promisify(execFile);
// SHA-256 of each reviewed, trusted Codex macOS build. Add a build here only
// after reviewing it; the sandbox refuses any binary not on this list.
export const codexBinaryHashes=[
  '4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc', // codex-cli 0.154.0
  '8eaf1ad12fe6bf89b1710330f58900014322c7c5af677e43be116d8ac5fc0a9e', // codex-cli 0.155.1
];
export async function verifiedBinary(binary){
 requireValue(process.platform==='darwin','Subscription provider requires reviewed macOS isolation',503);
 const path=await realpath(binary==='codex'?join(homedir(),'.local/bin/codex'):binary);
 requireValue(codexBinaryHashes.includes(createHash('sha256').update(await readFile(path)).digest('hex')),'Codex executable does not match any reviewed macOS build',503);return path;
}
export function sandboxPolicy({binary,profileDirectory,runtimeDirectory}){
 requireValue(basename(profileDirectory)==='.coach-codex'&&profileDirectory!==homedir(),'Use a dedicated directory named .coach-codex for subscription credentials/settings',503);
 requireValue(basename(runtimeDirectory).startsWith('coach-codex-run-'),'Invalid disposable runtime directory',503);
 const quote=JSON.stringify;
 const readable=`(literal ${quote(join(homedir(),'.CFUserTextEncoding'))}) (literal ${quote(join(homedir(),'Library/Preferences/com.apple.security.plist'))}) (literal ${quote(join(dirname(dirname(binary)),'codex-package.json'))}) (literal "/") (subpath "/System") (subpath "/usr/lib") (subpath "/usr/share") (subpath "/Library/Apple") (subpath "/private/etc") (subpath "/dev") (literal ${quote(binary)}) (subpath ${quote(profileDirectory)}) (subpath ${quote(runtimeDirectory)})`;
 return `(version 1)
(allow default)
(deny process-fork)
(deny process-exec (require-not (literal ${quote(binary)})))
(deny network-inbound)
(deny file-read-data (require-not (require-any ${readable})))
(deny file-write* (require-not (require-any (subpath ${quote(profileDirectory)}) (subpath ${quote(runtimeDirectory)}) (literal "/dev/null"))))
`;
}
export async function sandboxLaunch({binary,profileDirectory,runtimeDirectory,args}){
 const profile=sandboxPolicy({binary,profileDirectory:await realpath(profileDirectory),runtimeDirectory:await realpath(runtimeDirectory)});
 const path=join(runtimeDirectory,'sandbox.sb');await writeFile(path,profile,{mode:0o600});
 return {binary:'/usr/bin/sandbox-exec',args:['-f',path,binary,...args]};
}
export async function checkSandbox({profileDirectory,runtimeDirectory,privateFile}){
 const paths={profileDirectory:await realpath(profileDirectory),runtimeDirectory:await realpath(runtimeDirectory)};
 const allowedFile=join(runtimeDirectory,'allowed-probe.txt');await writeFile(allowedFile,'ALLOWED_SYNTHETIC_PROBE');
 const positive=await exec('/usr/bin/sandbox-exec',['-p',sandboxPolicy({binary:'/bin/cat',...paths}),'/bin/cat',allowedFile],{timeout:3000});requireValue(positive.stdout==='ALLOWED_SYNTHETIC_PROBE','macOS sandbox positive control failed',503);
 let denied=false;try{await exec('/usr/bin/sandbox-exec',['-p',sandboxPolicy({binary:'/bin/cat',...paths}),'/bin/cat',privateFile],{timeout:3000});}catch(e){denied=e.code===1&&/Operation not permitted/.test(e.stderr||'');}
 requireValue(denied,'macOS sandbox did not deny the private-file probe',503);
 const shell=await exec('/usr/bin/sandbox-exec',['-p',sandboxPolicy({binary:'/bin/bash',...paths}),'/bin/bash','-c','printf SHELL_BUILTIN'],{timeout:3000});requireValue(shell.stdout==='SHELL_BUILTIN','Sandbox shell positive control failed',503);
 denied=false;try{await exec('/usr/bin/sandbox-exec',['-p',sandboxPolicy({binary:'/bin/bash',...paths}),'/bin/bash','-c','/usr/bin/true & wait'],{timeout:3000});}catch(e){denied=typeof e.code==='number'&&e.code!==0;}
 requireValue(denied,'macOS sandbox did not deny child-process creation',503);
}
