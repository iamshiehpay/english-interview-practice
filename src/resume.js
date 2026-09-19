import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireValue,nonempty,AppError} from './domain.js';
const exec = promisify(execFile);
export function practiceResume({text,name='貼上的履歷'}) {
  requireValue(nonempty(text) && text.length <= 50000,'請提供履歷文字（最多 50,000 字）。');
  return {id:randomUUID(),name:basename(String(name)).slice(0,160),text:text.trim(),savedAt:new Date().toISOString()};
}
export async function extractResume({name,base64}) {
  const ext=extname(String(name)).toLowerCase();
  requireValue(['.pdf','.docx','.txt'].includes(ext),'請上傳 PDF、DOCX 或 TXT 履歷。');
  requireValue(typeof base64==='string' && base64.length<=7_000_000 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64),'檔案格式無法讀取，或超過 5 MB。');
  const bytes=Buffer.from(base64,'base64');
  requireValue(bytes.length>0 && bytes.length<=5_000_000,'履歷檔案需小於 5 MB。');
  requireValue(ext!=='.pdf'||bytes.subarray(0,5).toString()==='%PDF-','不是有效的 PDF 檔案。');
  requireValue(ext!=='.docx'||bytes.subarray(0,2).toString()==='PK','不是有效的 DOCX 檔案。');
  const dir=await mkdtemp(join(tmpdir(),'coach-resume-'));
  try {
    const file=join(dir,'resume'+ext);await writeFile(file,bytes,{mode:0o600});
    let text;
    if(ext==='.txt')text=bytes.toString('utf8');
    else if(ext==='.pdf')text=(await exec(process.env.PDFTOTEXT_BIN||'pdftotext',['-layout',file,'-'],{timeout:15000,maxBuffer:1_000_000})).stdout;
    else text=(await exec('/usr/bin/textutil',['-convert','txt','-stdout',file],{timeout:15000,maxBuffer:1_000_000})).stdout;
    requireValue(nonempty(text),'沒有辨識到文字。掃描圖片履歷請先轉成文字，或直接貼上內容。');
    requireValue(text.length<=50000,'履歷文字超過 50,000 字，請精簡後貼上。');
    return {name:basename(name),text:text.trim()};
  } catch(error) {
    if(error instanceof AppError)throw error;
    throw new AppError('履歷辨識失敗。請改貼文字；PDF 需安裝 pdftotext，DOCX 使用 macOS textutil。');
  } finally {await rm(dir,{recursive:true,force:true});}
}
