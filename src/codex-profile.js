import {createRuntime} from './codex-runtime.js';
import {verifiedBinary,sandboxLaunch,checkSandbox} from './codex-sandbox.js';
import {mkdir,readFile,writeFile,mkdtemp,rm,chmod,lstat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {AppError,requireValue} from './domain.js';
// Reviewed Codex CLI versions. Keep in step with codexBinaryHashes in codex-sandbox.js.
export const supportedVersions=['0.154.0','0.155.1'];
export const disabledFeatures=['shell_tool','unified_exec','unified_exec_tty','code_mode','code_mode_host','code_mode_only','code_mode_prewarm','apps','enable_mcp_apps','browser_use','browser_use_external','browser_use_full_cdp_access','computer_use','in_app_browser','in_app_local_automation','in_app_chat','in_app_dictation','image_generation','view_image','plugins','remote_plugin','plugin_sharing','hooks','skill_search','skill_mcp_dependency_install','multi_agent','multi_agent_v2','tool_suggest','goals','sleep_tool','request_permissions_tool','memories','shell_snapshot','shell_snapshot_v2','workspace_dependencies','worktrees','auth_elicitation','tool_call_mcp_elicitation','standalone_web_search','network_proxy','unbounded_connection_retries'];
export const profileConfig=`forced_login_method = "chatgpt"
cli_auth_credentials_store = "file"
web_search = "disabled"
project_doc_max_bytes = 0
[history]
persistence = "none"
[analytics]
enabled = false
[features]
skip_host_skill_discovery = true
${disabledFeatures.map(f=>f+' = false').join('\n')}
`;
export function processEnvironment(profile,env=process.env){
  // Do not inherit API tokens, proxy settings, Node injection hooks or Codex host state.
  const clean={};for(const key of ['PATH','HOME','USER','LOGNAME','TMPDIR','SYSTEMROOT','WINDIR'])if(env[key])clean[key]=env[key];
  return {...clean,CODEX_HOME:profile,RUST_LOG:'off',NO_COLOR:'1'};
}
export async function prepareProfile(profile){
  const path=resolve(profile);requireValue(basename(path)==='.coach-codex','Use a dedicated directory named .coach-codex',503);await mkdir(path,{recursive:true,mode:0o700});requireValue(!(await lstat(path)).isSymbolicLink(),'Codex profile must not be a symlink',503);await chmod(path,0o700);
  for(const name of ['config.toml','auth.json']){try{const stat=await lstat(join(path,name));requireValue(stat.isFile()&&!stat.isSymbolicLink(),'Codex profile files must be regular files',503);await chmod(join(path,name),0o600);}catch(error){if(error.code!=='ENOENT')throw error;}}
  const config=join(path,'config.toml');
  try{requireValue(await readFile(config,'utf8')===profileConfig,'Coach Codex profile differs from the isolated configuration; use a fresh dedicated directory',503);}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(config,profileConfig,{mode:0o600,flag:'wx'});}
  return path;
}
export async function runtimeProfile({profile,binary='codex',verifyVersion=true}){
  const home=await prepareProfile(profile),env=processEnvironment(home);
  if(verifyVersion)binary=await verifiedBinary(binary);
  if(verifyVersion){let version;try{version=(await promisify(execFile)(binary,['--version'],{env,timeout:5000,maxBuffer:10000})).stdout.trim();}catch{throw new AppError('Codex CLI unavailable; install the supported version',503);}
    requireValue(supportedVersions.some(v=>version===`codex-cli ${v}`),`Codex CLI version is not one of the reviewed builds (${supportedVersions.join(', ')})`,503);
    let features;try{features=(await promisify(execFile)(binary,['features','list'],{env,timeout:5000,maxBuffer:50000})).stdout;}catch{throw new AppError('Codex isolation feature check failed',503);}
    const states=new Map(features.trim().split('\n').map(line=>{const parts=line.trim().split(/\s+/);return [parts[0],parts.at(-1)];}));
    requireValue(disabledFeatures.every(f=>states.get(f)===(f==='unified_exec'?'true':'false'))&&states.get('skip_host_skill_discovery')==='true','Codex tool isolation settings were not honored',503);
  }
  const runtime=await createRuntime(home);const {directory}=runtime;const cwd=join(directory,'empty');await mkdir(cwd);
  const args=['--strict-config','-c',`log_dir=${JSON.stringify(join(directory,'logs'))}`,'-c',`sqlite_home=${JSON.stringify(join(directory,'state'))}`,'app-server','--listen','stdio://'];
  if(verifyVersion){const probe=await mkdtemp(join(tmpdir(),'coach-private-probe-'));try{const privateFile=join(probe,'synthetic.txt');await writeFile(privateFile,'OUTSIDE_SYNTHETIC_PROBE');await checkSandbox({profileDirectory:home,runtimeDirectory:directory,privateFile});}catch(error){await rm(directory,{recursive:true,force:true});throw error;}finally{await rm(probe,{recursive:true,force:true});}}
  const launch=verifyVersion?await sandboxLaunch({binary,profileDirectory:home,runtimeDirectory:directory,args}):{binary,args};
  return {home,directory,cwd,env,rawBinary:binary,binary:launch.binary,args:launch.args,register:runtime.register,cleanup:runtime.cleanup};
}
