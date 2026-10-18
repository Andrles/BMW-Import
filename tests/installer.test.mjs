import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,copyFile,symlink,access,readdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir,homedir} from 'node:os';
import path from 'node:path';
test('installer closes identified apps and safely trashes only older standard-folder copies',{skip:process.platform!=='darwin'},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bmw-installer-test-'));
 const source=new URL('../macos/InstallerMaintenance.swift',import.meta.url).pathname;
 try{
 const helper=path.join(dir,'installer-maintenance');execFileSync('/usr/bin/xcrun',['swiftc',source,'-o',helper,'-framework','Cocoa','-module-cache-path','/tmp/bmw-swift-cache']);
 for(const phase of ['preinstall','postinstall'])await copyFile(new URL('../macos/installer-scripts/'+phase,import.meta.url),path.join(dir,phase));
 const root=path.join(dir,'volume'),home=path.join(root,homedir().slice(1));await mkdir(home,{recursive:true});
 const run=phase=>spawnSync('/bin/bash',[path.join(dir,phase),'pkg','/',root],{encoding:'utf8'});
 const bundle=async(p,v,id='local.bmwimport.desktop')=>{await mkdir(path.join(p,'Contents/MacOS'),{recursive:true});await writeFile(path.join(p,'Contents/Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleExecutable</key><string>BMWImport</string><key>CFBundleShortVersionString</key><string>${v}</string></dict></plist>`);await copyFile('/usr/bin/true',path.join(p,'Contents/MacOS/BMWImport'));};
 const exists=async p=>{try{await access(p);return true;}catch{return false;}};
 const first=run('preinstall');assert.equal(first.status,0,'first installation: '+first.stderr);
 const target=path.join(root,'Applications/BMW Import.app');await bundle(target,'0.5.2');assert.equal(run('preinstall').status,0,'upgrade, app exited');
 await bundle(target,'0.7.0');assert.notEqual(run('preinstall').status,0,'downgrade refused');
 await bundle(target,'0.6.0','other.application');assert.notEqual(run('preinstall').status,0,'unrelated app target protected');await bundle(target,'0.6.0');
 const old=path.join(home,'Downloads/BMW Import old.app'),same=path.join(home,'Applications/BMW Import copy.app'),newer=path.join(home,'Desktop/BMW Import beta.app'),other=path.join(root,'Applications/Other.app'),project=path.join(home,'Documents/project/BMW Import.app');
 await bundle(old,'0.5.2');await bundle(same,'0.6.0');await bundle(newer,'0.7.0');await bundle(other,'0.1.0','other.app');await bundle(project,'0.5.0');
 const data=path.join(home,'Library/Application Support/BMW Import/quotes');await mkdir(data,{recursive:true});await writeFile(path.join(data,'keep.json'),'keep');
 const link=path.join(home,'Downloads/Alias.app');await symlink(project,link);
 const result=run('postinstall');assert.equal(result.status,0,result.stderr);assert.equal(await exists(old),false);assert.equal((await readdir(path.join(home,'.Trash'))).length,1);
 for(const p of [same,newer,other,project,link,target,path.join(data,'keep.json')])assert.equal(await exists(p),true,p);
 assert.equal(run('postinstall').status,0,'idempotent');
 await bundle(target,'0.5.2');assert.notEqual(run('postinstall').status,0,'failed upgrade cannot clean copies');
 // Exercise termination of a real NSApplication within the isolated installation root.
 const fixture=path.join(home,'Applications/Running.app');await bundle(fixture,'0.5.2');
 const swift=path.join(dir,'Fixture.swift');await writeFile(swift,'import Cocoa\nlet app=NSApplication.shared\napp.setActivationPolicy(.prohibited)\napp.run()\n');
 execFileSync('/usr/bin/xcrun',['swiftc',swift,'-o',path.join(fixture,'Contents/MacOS/BMWImport'),'-framework','Cocoa','-module-cache-path','/tmp/bmw-swift-cache']);
 const {spawn}=await import('node:child_process');const child=spawn(path.join(fixture,'Contents/MacOS/BMWImport'),[],{stdio:'ignore'});
 try{await new Promise(r=>setTimeout(r,700));assert.equal(child.exitCode,null);const r=run('preinstall');assert.equal(r.status,0,r.stderr);await new Promise(r=>setTimeout(r,150));assert.notEqual(child.exitCode,null,'running app gracefully exited');}finally{if(child.exitCode===null)child.kill();}
 }finally{await rm(dir,{recursive:true,force:true});}
});
