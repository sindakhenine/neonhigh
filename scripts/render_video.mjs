#!/usr/bin/env node
/**
 * Deterministic frame-accurate 60-second HD MP4 renderer for VICE HORIZONS.
 * Uses local Google Chrome + WebGL (SwiftShader) + parallel worker pages -> ffmpeg H.264 + AAC.
 *
 * Usage:
 *   node scripts/render_video.mjs --preview   (renders 9 inspection keyframes to tmp_render/previews/)
 *   node scripts/render_video.mjs --full      (renders complete 60.0s 1280x720 30fps MP4 to public/vice-horizons-60s.mp4)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const TMP_DIR = path.join(ROOT, 'tmp_render');
const PREVIEW_DIR = path.join(TMP_DIR, 'previews');
const AUDIO_WAV = path.join(TMP_DIR, 'vice-horizons-audio.wav');
const OUTPUT_MP4 = path.join(ROOT, 'public', 'vice-horizons-60s.mp4');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DURATION = 60;
const TOTAL_FRAMES = FPS * DURATION; // 1800
const WORKERS = 4;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
};

function startStaticServer(dir) {
  const rootDir = path.resolve(dir);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      let filePath = path.resolve(rootDir, rel);
      if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(rootDir, 'index.html');
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });
}

async function openCinemaPage(browser, port) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  await page.goto(`http://127.0.0.1:${port}/?render=1`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__CINEMA_READY__ === true, { timeout: 30000 });
  return page;
}

async function seekAndCapture(page, timeSec, type = 'jpeg') {
  await page.evaluate(
    (t) =>
      new Promise((resolve) => {
        window.__CINEMA_SEEK__(t);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
    timeSec
  );
  if (type === 'png') {
    return page.screenshot({ type: 'png' });
  }
  return page.screenshot({ type: 'jpeg', quality: 94 });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}:\n${stderr.slice(-1200)}`));
    });
  });
}

async function renderPreviews(port) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  const browser = await launchBrowser();
  const page = await openCinemaPage(browser, port);

  const times = [
    { name: '01_act1_golden_coast_4s.png', t: 4.0 },
    { name: '02_act2_ocean_drive_12s.png', t: 12.2 },
    { name: '03_act2_launch_flame_19s.png', t: 19.2 },
    { name: '04_act3_causeway_chase_23s.png', t: 23.0 },
    { name: '05_act3_bridge_front_29s.png', t: 29.0 },
    { name: '06_act4_heat5_pursuit_35s.png', t: 35.0 },
    { name: '07_act4_reverse_chopper_40s.png', t: 40.5 },
    { name: '08_act5_neon_overdrive_47s.png', t: 47.4 },
    { name: '09_act6_horizon_finale_56s.png', t: 56.0 },
  ];

  const t0 = Date.now();
  for (const item of times) {
    const fStart = Date.now();
    const buf = await seekAndCapture(page, item.t, 'png');
    const outPath = path.join(PREVIEW_DIR, item.name);
    fs.writeFileSync(outPath, buf);
    console.log(`Captured ${item.name} (${Date.now() - fStart} ms)`);
  }
  console.log(`Preview capture complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await browser.close();
}

async function renderSegment(workerId, startFrame, endFrame, port) {
  const segPath = path.join(TMP_DIR, `seg_${workerId}.mp4`);
  const browser = await launchBrowser();
  const page = await openCinemaPage(browser, port);

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-r',
      String(FPS),
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      segPath,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );

  let ffErr = '';
  ffmpeg.stderr.on('data', (d) => (ffErr += d.toString()));

  const count = endFrame - startFrame;
  const tStart = Date.now();

  for (let f = startFrame; f < endFrame; f++) {
    const tSec = f / FPS;
    const jpg = await seekAndCapture(page, tSec, 'jpeg');
    if (!ffmpeg.stdin.write(jpg)) {
      await new Promise((r) => ffmpeg.stdin.once('drain', r));
    }
    const done = f - startFrame + 1;
    if (done % 75 === 0 || done === count) {
      const elapsed = (Date.now() - tStart) / 1000;
      const fpsRate = (done / elapsed).toFixed(2);
      console.log(
        `[Worker ${workerId}] ${done}/${count} frames (${((done / count) * 100).toFixed(0)}%, ${fpsRate} fps)`
      );
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker ${workerId} ffmpeg failed (${code}): ${ffErr.slice(-800)}`));
    });
  });

  await browser.close();
  return segPath;
}

async function renderFullVideo(port) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_MP4), { recursive: true });

  const t0 = Date.now();
  const chunkSize = Math.ceil(TOTAL_FRAMES / WORKERS);
  console.log(
    `Rendering ${TOTAL_FRAMES} frames (${DURATION}s @ ${FPS}fps, ${WIDTH}x${HEIGHT}) across ${WORKERS} parallel workers...`
  );

  const tasks = [];
  for (let w = 0; w < WORKERS; w++) {
    const startF = w * chunkSize;
    const endF = Math.min(TOTAL_FRAMES, startF + chunkSize);
    if (startF < endF) {
      tasks.push(renderSegment(w, startF, endF, port));
    }
  }

  const segPaths = await Promise.all(tasks);
  const concatList = path.join(TMP_DIR, 'concat.txt');
  fs.writeFileSync(
    concatList,
    segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  );

  console.log('Concatenating segments & muxing 48kHz stereo soundtrack into final MP4...');
  await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatList,
    '-i',
    AUDIO_WAV,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    '-shortest',
    OUTPUT_MP4,
  ]);

  const sizeMb = (fs.statSync(OUTPUT_MP4).size / (1024 * 1024)).toFixed(2);
  console.log(
    `Rendered ${OUTPUT_MP4} (${sizeMb} MB) in ${((Date.now() - t0) / 1000).toFixed(1)}s!`
  );
}

async function main() {
  const mode = process.argv.includes('--full') ? 'full' : 'preview';
  const { server, port } = await startStaticServer(DIST_DIR);
  try {
    if (mode === 'preview') {
      await renderPreviews(port);
    } else {
      await renderFullVideo(port);
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
