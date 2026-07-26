import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const catalogPath = join(root, 'public', 'audio', 'default-voice', 'catalog.json');
const outputDir = join(root, 'public', 'audio', 'default-voice');

const apiKey = process.env.FISH_AUDIO_API_KEY;
if (!apiKey) {
  console.error('Set FISH_AUDIO_API_KEY environment variable first.');
  process.exit(1);
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf-8'));
const clips = catalog.clips;
const REFERENCE_ID = '61a845f9295546f09e9d17ce8a2b9f4f';
const FORCE = process.argv.includes('--force');

let generated = 0;
let skipped = 0;

for (const clip of clips) {
  const filePath = join(outputDir, clip.file);
  if (!FORCE) {
    try {
      await readFile(filePath);
      skipped++;
      continue;
    } catch { /* generate */ }
  }

  process.stdout.write(`[${generated + 1}/${clips.length}] ${clip.id}... `);
  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': 's2.1-pro-free'
      },
      body: JSON.stringify({
        text: clip.text,
        reference_id: REFERENCE_ID,
        format: 'mp3'
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.log(`FAILED (${response.status}): ${err.slice(0, 100)}`);
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, buffer);
    console.log(`OK (${buffer.length} bytes)`);
    generated++;
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
  }
}

console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${clips.length} total.`);
