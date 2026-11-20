// Export both cameras from the actual WebGL scene on each measured source PTS.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const trial = fileURLToPath(new URL("../../avatars/paulina/prov-70/v1/",import.meta.url));
const out = path.join(trial,"visning");
const url = "http://127.0.0.1:4317/prov-70/v1";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const width=880, height=550;
sharp.concurrency(4);
const probe=file => JSON.parse(execFileSync("ffprobe", ["-v","error","-select_streams","v:0",
  "-show_entries","frame=best_effort_timestamp_time,duration_time:stream=avg_frame_rate,width,height,nb_frames",
  "-show_frames","-of","json",file], {maxBuffer:8*1024*1024}));

async function writeNew(file, bytes) {
  try { await writeFile(file,bytes,{flag:"wx"}); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (hash(await readFile(file))!==hash(bytes)) throw new Error("En annan version finns på "+file);
  }
}

async function canvasImage(page, pts, angle, type) {
  const encoded=await page.evaluate(([t,yaw,mime])=>{
    window.paulinaTrial.showFrame(t,yaw);
    return document.getElementById("scene").toDataURL(mime,.95).split(",")[1];
  },[pts,angle,type]);
  return Buffer.from(encoded,"base64");
}

const temp=await mkdtemp(path.join(os.tmpdir(),"paulina-70-film-"));
const taskFiles=[];
let browser;
try {
  const evidence=JSON.parse(await readFile(path.join(out,"matning.json"),"utf8"));
  const video=path.join(trial,"runway/original.mp4");
  assert.equal(hash(await readFile(video)),evidence.sourceVideoSha256);
  const original=probe(video);
  const pts=original.frames.map(frame=>Number(frame.best_effort_timestamp_time));
  const times=pts.map(time=>time-pts[0]);
  assert.equal(times.length,evidence.sourceFrameCount);
  assert.ok(times.every((t,i)=>!i||t>times[i-1]));
  const timestamp=evidence.poseTimeSeconds;
  assert.ok(Math.abs(times[evidence.poseSourceFrame]-timestamp)<.0001);
  const connection=await fetch(url+"/modell.glb");
  assert.equal(connection.status,200);
  assert.equal(hash(Buffer.from(await connection.arrayBuffer())),evidence.sceneSha256);
  browser=await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:960,height:610},deviceScaleFactor:1});
  await page.goto(url);
  await page.addStyleTag({content:`#scene{width:${width}px;height:${height}px;aspect-ratio:auto}`});
  await page.waitForFunction(() => document.getElementById("scene").dataset.ready==="true");
  await page.waitForFunction(([w,h])=>{
    const c=document.getElementById("scene");
    return c.width===w && c.height===h;
  },[width,height]);
  const served=await page.evaluate(()=>window.paulinaTrial.report);
  assert.equal(served.sceneSha256,evidence.sceneSha256);
  await mkdir(out,{recursive:true});
  const frontStill=await canvasImage(page,timestamp,0,"image/png");
  const sideStill=await canvasImage(page,timestamp,70,"image/png");
  assert.notEqual(hash(frontStill),hash(sideStill));
  await writeNew(path.join(out,"pose-front.png"),frontStill);
  await writeNew(path.join(out,"pose-70.png"),sideStill);
  const margin=46, total=2*width;
  const title=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${margin}">
    <rect width="100%" height="100%" fill="#172923"/>
    <g fill="#f2eee4" font-family="Segoe UI, Arial, sans-serif" font-size="22">
      <text x="20" y="31">Paulina · front 0°</text><text x="${width+20}" y="31">Paulina · vänster sida 70°</text>
    </g></svg>`);
  const concat=["ffconcat version 1.0"];
  for (let i=0;i<times.length;i++) {
    const t=times[i];
    const first=await canvasImage(page,t,0,"image/jpeg");
    const second=await canvasImage(page,t,70,"image/jpeg");
    const name=String(i).padStart(6,"0")+".jpg";
    const filename=path.join(temp,name);
    taskFiles.push(filename);
    await sharp({create:{width:total,height:height+margin,channels:3,background:"#172923"}})
      .composite([{input:title,top:0,left:0},{input:first,top:margin,left:0},{input:second,top:margin,left:width}])
      .jpeg({quality:94,chromaSubsampling:"4:4:4"}).toFile(filename);
    concat.push("file '"+name+"'","option framerate 90000","duration "+((times[i+1]??evidence.durationSeconds)-t).toFixed(9));
    if ((i+1)%25===0) console.log(`Exporterade ${i+1}/${times.length} källrutor`);
  }
  const plan=path.join(temp,"tider.txt"), movie=path.join(temp,"blackjack.mp4");
  taskFiles.push(plan,movie);
  await writeFile(plan,concat.join("\n")+"\n");
  const meanStep=evidence.durationSeconds/times.length;
  const constant=times.every((time,i)=>Math.abs(time-i*meanStep)<.0003);
  const input=constant?["-framerate",original.streams[0].avg_frame_rate,"-i",path.join(temp,"%06d.jpg")]
    :["-f","concat","-safe","0","-i",plan,"-fps_mode","vfr","-enc_time_base","1/90000"];
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error",...input,"-c:v","libx264","-threads","4",
    "-crf","18","-preset","medium","-pix_fmt","yuv420p","-video_track_timescale","90000",
    "-movflags","+faststart",movie]);
  const restored=probe(movie);
  assert.equal(restored.frames.length,times.length);
  const maxPts=Math.max(...restored.frames.map((frame,i)=>Math.abs(Number(frame.best_effort_timestamp_time)-times[i])));
  assert.ok(maxPts<.001,"Bildtiden avviker med "+maxPts+" s");
  const delivered=await readFile(movie);
  await writeNew(path.join(out,"front-och-70.mp4"),delivered);
  const receipt={sceneSha256:evidence.sceneSha256,sourceVideoSha256:evidence.sourceVideoSha256,
    outputSha256:hash(delivered),frames:times.length,width:total,height:height+margin,
    nominalFrameRate:original.streams[0].avg_frame_rate,maximumPtsErrorSeconds:maxPts,
    selectedSourceFrame:evidence.poseSourceFrame,selectedTimeSeconds:timestamp,
    stills:{"pose-front.png":hash(frontStill),"pose-70.png":hash(sideStill)}};
  await writeNew(path.join(out,"rendering.json"),Buffer.from(JSON.stringify(receipt,null,2)+"\n"));
  console.log(JSON.stringify(receipt));
} finally {
  await browser?.close();
  for (const f of taskFiles) {
    try { await unlink(f); } catch(error){if(error.code!=="ENOENT") throw error;}
  }
  await rmdir(temp);
}
