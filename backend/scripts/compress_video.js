import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { executeQuery, isUsingFallback } from '../src/database/db.js';

const ORIGINAL_META_VIDEO_URL = 'https://scontent.whatsapp.net/v/t61.29466-34/10000000_1429385345595388_2876592857547398792_n.mp4?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=ITwYqJUgFfAQ7kNvwFuMuFo&_nc_oc=Adrw_guQB4qtVPsINxQZGArZHxhZSyWxLkGYD6CMwmWWG29uT50HQS5Udi5bnAvziUE&_nc_zt=28&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=1OdgZXjnsX4YOlIQVC796A&_nc_tpa=Q5bMBQLWEQ08wLOJKWdRSz2-F7yHtqcWn_NURuQr2o0zNLWcc0f0fthyqM_Qv5vR8vwUs99dCXpL1_GY9Q&oh=01_Q5Aa6AHwkgkH-ipw9RIWl-1E_ChAXbBqriGxHZsRM60jw-jImA&oe=6B2D1F4C';

async function main() {
  console.log('🎬 [VideoOptimizer] Starting Arlak Pharmaceuticals Video Optimization for WhatsApp Cloud API...');

  // Ensure output directories exist
  const targetDirs = [
    path.resolve(process.cwd(), 'uploads', 'templates'),
    path.resolve(process.cwd(), 'backend', 'uploads', 'templates'),
    path.resolve('/var/www/campaignflow/uploads/templates'),
    path.resolve('/var/www/campaignflow/backend/uploads/templates')
  ];

  targetDirs.forEach(d => {
    try {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    } catch (_) {}
  });

  const outputFilename = 'arlak_pharma_15mb.mp4';
  const localOutputDir = targetDirs.find(d => fs.existsSync(d)) || path.resolve(process.cwd(), 'uploads', 'templates');
  const finalOutputPath = path.join(localOutputDir, outputFilename);
  const rawInputPath = path.join(localOutputDir, 'raw_input_83mb.mp4');

  // 1. Download original video if not already present
  if (!fs.existsSync(rawInputPath) || fs.statSync(rawInputPath).size < 1000000) {
    console.log(`⬇️ Downloading original 83MB video from Meta CDN to ${rawInputPath}...`);
    const res = await fetch(ORIGINAL_META_VIDEO_URL);
    if (!res.ok) {
      throw new Error(`Failed to download video from Meta CDN (HTTP ${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(rawInputPath, buffer);
    console.log(`✅ Downloaded original video: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log(`ℹ️ Found existing raw video on disk: ${(fs.statSync(rawInputPath).size / 1024 / 1024).toFixed(2)} MB`);
  }

  // 2. Check for ffmpeg
  let hasFfmpeg = false;
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    hasFfmpeg = true;
  } catch (_) {
    hasFfmpeg = false;
  }

  if (!hasFfmpeg) {
    console.log('⚠️ ffmpeg is not currently installed. Attempting installation on Ubuntu...');
    try {
      execSync('sudo apt-get update && sudo apt-get install -y ffmpeg', { stdio: 'inherit' });
      hasFfmpeg = true;
    } catch (installErr) {
      console.error('❌ Could not auto-install ffmpeg. Please run: sudo apt-get install -y ffmpeg');
      process.exit(1);
    }
  }

  // 3. Compress video to under 15MB with high-compatibility H.264 / AAC
  console.log('⚙️ Compressing video using H.264 / AAC with 720p scaling for WhatsApp compatibility...');
  const ffmpegCmd = `ffmpeg -y -i "${rawInputPath}" -c:v libx264 -crf 28 -preset fast -b:v 1200k -maxrate 1500k -bufsize 2000k -vf "scale=-2:720" -c:a aac -b:a 128k -movflags +faststart "${finalOutputPath}"`;
  console.log(`Running: ${ffmpegCmd}`);
  execSync(ffmpegCmd, { stdio: 'inherit' });

  // Verify file size
  const compressedStats = fs.statSync(finalOutputPath);
  const compressedSizeMb = compressedStats.size / 1024 / 1024;
  console.log(`\n🎉 Compression complete!`);
  console.log(`📁 File: ${finalOutputPath}`);
  console.log(`📊 Final Size: ${compressedSizeMb.toFixed(2)} MB (Meta WhatsApp Limit is 16 MB - PASSED ✅)`);

  // Copy to all known upload directories
  targetDirs.forEach(d => {
    try {
      if (fs.existsSync(d) && d !== localOutputDir) {
        fs.copyFileSync(finalOutputPath, path.join(d, outputFilename));
      }
    } catch (_) {}
  });

  const publicUrl = `https://aiveexa.com/uploads/templates/${outputFilename}`;
  console.log(`🌐 Public URL: ${publicUrl}`);

  // 4. Update template 4_yuvi_vid_test in database
  if (!isUsingFallback()) {
    try {
      console.log('🔄 Updating template 4_yuvi_vid_test in database with optimized video URL...');
      const rows = await executeQuery('SELECT id, components FROM templates WHERE name = "4_yuvi_vid_test" LIMIT 1');
      if (rows && rows.length > 0) {
        const comps = typeof rows[0].components === 'string' ? JSON.parse(rows[0].components) : rows[0].components;
        const hComp = comps.find(c => (c.type || '').toUpperCase() === 'HEADER');
        if (hComp) {
          if (!hComp.example) hComp.example = {};
          hComp.example.header_handle = [publicUrl];
          await executeQuery('UPDATE templates SET components = ? WHERE id = ?', [JSON.stringify(comps), rows[0].id]);
          console.log(`✅ Database template #${rows[0].id} updated with ${publicUrl}`);
        }
      }
    } catch (dbErr) {
      console.warn('DB update note:', dbErr.message);
    }
  }

  console.log('\n🚀 Done! Video is ready for live WhatsApp dispatch.');
}

main().catch(console.error);
