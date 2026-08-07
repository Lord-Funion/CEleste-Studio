import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  encodeLevelPayload,
  encodePackPayload,
  exportLevel8xv,
  exportPack8xv,
} from '../lib/format.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(here, '../../samples');
await mkdir(samplesDir, { recursive: true });

function room(seed) {
  const tiles = new Uint8Array(256);
  tiles.fill(37, 240);
  for (let y = 0; y < 16; y += 1) tiles[y * 16] = 37;
  tiles[200] = seed % 2 ? 38 : 37;
  return {
    id: 100 + seed,
    width: 16,
    height: 16,
    spawnX: 2,
    spawnY: 13,
    exitX: 13,
    exitY: 1,
    flags: 0,
    tiles,
    entities: [{ type: 18, x: 8, y: 13, flags: 0 }],
  };
}

function level(id, title) {
  return {
    id,
    title,
    author: 'Lord Funion',
    description: 'Generated compatibility fixture',
    difficulty: 2,
    rooms: [room(id), room(id + 1)],
  };
}

const one = level(1, 'First Climb');
const two = level(2, 'Second Climb');
const pack = {
  id: 99,
  title: 'Starter Pack',
  author: 'Lord Funion',
  description: 'Two sample levels',
  difficulty: 2,
  levels: [one, two],
};

await writeFile(path.join(samplesDir, 'FIRST.payload'), encodeLevelPayload(one));
await writeFile(path.join(samplesDir, 'STARTER.payload'), encodePackPayload(pack));
await writeFile(path.join(samplesDir, 'CL1.8xv'), exportLevel8xv(one, { name: 'CL1' }));
await writeFile(path.join(samplesDir, 'CPSTART.8xv'), exportPack8xv(pack, { name: 'CPSTART' }));
