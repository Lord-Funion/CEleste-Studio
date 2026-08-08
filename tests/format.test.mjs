import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeLevelPayload, encodePackPayload, decodePayload, exportLevel8xv, exportPack8xv,
  import8xv, rleEncode, rleDecode, crc32, validateLevel
} from '../lib/format.mjs';

function room(seed = 0) {
  const tiles = new Uint8Array(256);
  tiles.fill(37, 240, 256);
  for (let i = 0; i < 16; i++) tiles[i * 16] = 37;
  tiles[200] = seed ? 38 : 37;
  const rotations = new Uint8Array(256);
  return { id: 100 + seed, width: 16, height: 16, spawnX: 2, spawnY: 13, exitX: 14, exitY: 1, flags: 0, tiles, rotations, entities: [{ type: 18, x: 8, y: 13, flags: 0 }] };
}
function level(id = 7) { return { id, title: `Test ${id}`, author: 'Finn', description: 'Round trip', difficulty: 2, rooms: [room(id), room(id + 1)] }; }

test('RLE round trip', () => {
  const data = Uint8Array.from([1,1,1,2,3,3,4,4,4,4]);
  assert.deepEqual(rleDecode(rleEncode(data), data.length), data);
});

test('CRC32 known vector', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('level payload round trip', () => {
  const original = level(); const decoded = decodePayload(encodeLevelPayload(original));
  assert.equal(decoded.kind, 'level'); assert.equal(decoded.title, original.title); assert.equal(decoded.rooms.length, 2);
  assert.deepEqual(decoded.rooms[0].tiles, original.rooms[0].tiles);
});

test('entity flags survive payload and 8xv round trips', () => {
  const original = level();
  original.rooms[0].entities = [
    { type: 8, x: 2, y: 8, flags: 0 },
    { type: 20, x: 6, y: 8, flags: 1 },       // empty locked chest
    { type: 64, x: 10, y: 8, flags: 0 },      // fake wall with strawberry
    { type: 96, x: 4, y: 11, flags: 2 }       // three-dash big chest
  ];
  const payload = decodePayload(encodeLevelPayload(original));
  assert.deepEqual(payload.rooms[0].entities.map(e => [e.type,e.flags]), [[8,0],[20,1],[64,0],[96,2]]);
  const wrapped = import8xv(exportLevel8xv(original, { name: 'CLFLAG' })).data;
  assert.deepEqual(wrapped.rooms[0].entities.map(e => [e.type,e.flags]), [[8,0],[20,1],[64,0],[96,2]]);
});

test('pack payload round trip', () => {
  const pack = { id: 44, title: 'Pack', author: 'Finn', description: 'Two levels', difficulty: 3, levels: [level(1), level(2)] };
  const decoded = decodePayload(encodePackPayload(pack));
  assert.equal(decoded.kind, 'pack'); assert.equal(decoded.levels.length, 2); assert.equal(decoded.levels[1].title, 'Test 2');
});

test('exported AppVar has TI entry-data length before CELV payload', () => {
  const original = level();
  const payload = encodeLevelPayload(original);
  const bytes = exportLevel8xv(original, { name: 'CLMAGIC' });
  const variableLength = bytes[57] | (bytes[58] << 8);
  const copyLength = bytes[70] | (bytes[71] << 8);
  const entryPayloadLength = bytes[72] | (bytes[73] << 8);
  assert.equal(copyLength, variableLength);
  assert.equal(variableLength, payload.length + 2);
  assert.equal(entryPayloadLength, payload.length);
  assert.equal(new TextDecoder().decode(bytes.slice(74, 78)), 'CELV');
});

test('8xv level round trip and checksum', () => {
  const bytes = exportLevel8xv(level(), { name: 'CLTEST' }); const imported = import8xv(bytes);
  assert.equal(imported.name, 'CLTEST'); assert.equal(imported.archived, true); assert.equal(imported.data.kind, 'level');
  const damaged = bytes.slice(); damaged[damaged.length - 3] ^= 1;
  assert.throws(() => import8xv(damaged), /checksum/i);
});

test('8xv pack round trip', () => {
  const pack = { id: 55, title: 'Pack', author: 'Finn', levels: [level(3), level(4)] };
  assert.equal(import8xv(exportPack8xv(pack)).data.levels.length, 2);
});

test('validation catches invalid spawn', () => {
  const bad = level(); bad.rooms[0].spawnX = 90;
  assert.equal(validateLevel(bad).valid, false);
});

test('validation accepts complete key/chest/fake-wall/big-chest puzzle', () => {
  const good = level();
  good.rooms[0].entities = [
    { type: 8, x: 2, y: 8, flags: 0 },
    { type: 20, x: 5, y: 8, flags: 0 },
    { type: 64, x: 9, y: 7, flags: 0 },
    { type: 96, x: 4, y: 11, flags: 2 }
  ];
  for (const e of good.rooms[0].entities) {
    const cells = e.type === 64 || e.type === 96
      ? [[e.x,e.y],[e.x+1,e.y],[e.x,e.y+1],[e.x+1,e.y+1]]
      : [[e.x,e.y]];
    for (const [x,y] of cells) good.rooms[0].tiles[y*16+x] = 0;
  }
  const result = validateLevel(good);
  assert.equal(result.valid, true);
  assert.match(result.warnings.join('\n'), /three dashes/i);
});

test('validation accepts Climb Chest entity 129', () => {
  const good = level();
  good.rooms[0].entities = [{ type: 129, x: 6, y: 8, flags: 0 }];
  good.rooms[0].tiles[8*16+6] = 0;
  const result = validateLevel(good);
  assert.equal(result.valid, true);
});

test('validation rejects compound piece outside room', () => {
  const bad = level();
  bad.rooms[0].entities = [{ type: 64, x: 15, y: 15, flags: 0 }];
  const result = validateLevel(bad);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /footprint/i);
});

test('validation rejects overlapping logical pieces', () => {
  const bad = level();
  bad.rooms[0].entities = [
    { type: 64, x: 8, y: 8, flags: 0 },
    { type: 96, x: 9, y: 9, flags: 0 }
  ];
  const result = validateLevel(bad);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /overlap/i);
});

test('validation warns about locked chest without key', () => {
  const puzzle = level();
  puzzle.rooms[0].entities = [{ type: 20, x: 5, y: 8, flags: 0 }];
  puzzle.rooms[0].tiles[8*16+5] = 0;
  const result = validateLevel(puzzle);
  assert.equal(result.valid, true);
  assert.match(result.warnings.join('\n'), /no key/i);
});


test('arbitrary tile rotations survive CELV v2 and 8xv round trips', () => {
  const original=level();
  original.rooms[0].rotations[34]=1; original.rooms[0].rotations[35]=2; original.rooms[0].rotations[36]=3;
  const decoded=decodePayload(encodeLevelPayload(original));
  assert.equal(decoded.version,2);
  assert.equal(decoded.rooms[0].tiles[34],original.rooms[0].tiles[34]);
  assert.deepEqual(Array.from(decoded.rooms[0].rotations.slice(34,37)),[1,2,3]);
  const wrapped=import8xv(exportLevel8xv(original,{name:'CLROTATE'})).data;
  assert.deepEqual(Array.from(wrapped.rooms[0].rotations.slice(34,37)),[1,2,3]);
});

test('entity rotation shares flags without breaking gameplay options', () => {
  const original=level();
  original.rooms[0].entities=[
    {type:20,x:5,y:8,flags:(1<<6)},
    {type:64,x:9,y:8,flags:1|(2<<6)},
    {type:96,x:4,y:11,flags:2|(3<<6)}
  ];
  const decoded=decodePayload(encodeLevelPayload(original));
  assert.deepEqual(decoded.rooms[0].entities.map(e=>e.flags),[64,129,194]);
});
