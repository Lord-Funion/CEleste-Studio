const MAGIC = new Uint8Array([0x43, 0x45, 0x4c, 0x56]); // CELV
const VERSION = 2;
const MIN_VERSION = 1;
const ROTATION_PLANE_BYTES = 64;
const ROTATION_ENCODING_2BPP = 1;
export const ENTITY_ROTATION_SHIFT = 6;
export const ENTITY_ROTATION_MASK = 0xc0;
export const ENTITY_FLAG_MASK = 0x3f;
const KIND_LEVEL = 1;
const KIND_PACK = 2;
const HEADER_SIZE = 34;
const MAX_APPVAR_PAYLOAD = 65000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const constants = Object.freeze({
  MAGIC: 'CELV', VERSION, MIN_VERSION, KIND_LEVEL, KIND_PACK, HEADER_SIZE, MAX_APPVAR_PAYLOAD, ROTATION_PLANE_BYTES, ROTATION_ENCODING_2BPP,
});

class Writer {
  constructor() { this.parts = []; this.length = 0; }
  bytes(value) {
    const v = value instanceof Uint8Array ? value : new Uint8Array(value);
    this.parts.push(v); this.length += v.length; return this;
  }
  u8(v) { return this.bytes(Uint8Array.of(v & 0xff)); }
  u16(v) { return this.bytes(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff)); }
  u32(v) { return this.bytes(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)); }
  finish() {
    const out = new Uint8Array(this.length); let p = 0;
    for (const part of this.parts) { out.set(part, p); p += part.length; }
    return out;
  }
}

class Reader {
  constructor(bytes) { this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); this.pos = 0; }
  require(n, label = 'data') { if (this.pos + n > this.bytes.length) throw new Error(`Truncated ${label} at byte ${this.pos}`); }
  u8() { this.require(1); return this.bytes[this.pos++]; }
  u16() { this.require(2); const v = this.bytes[this.pos] | (this.bytes[this.pos + 1] << 8); this.pos += 2; return v; }
  u32() { this.require(4); const b = this.bytes; const p = this.pos; this.pos += 4; return (b[p] | (b[p+1] << 8) | (b[p+2] << 16) | (b[p+3] << 24)) >>> 0; }
  take(n, label) { this.require(n, label); const v = this.bytes.slice(this.pos, this.pos + n); this.pos += n; return v; }
  remaining() { return this.bytes.length - this.pos; }
}

function asciiBytes(text, max) {
  const clean = String(text ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '?').slice(0, max);
  return textEncoder.encode(clean);
}

function safeText(bytes) { return textDecoder.decode(bytes); }

export function fnv1a(text) {
  let hash = 0x811c9dc5;
  const data = textEncoder.encode(String(text));
  for (const b of data) { hash ^= b; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
}

export function crc32(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function rleEncode(input) {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
  const out = [];
  for (let i = 0; i < bytes.length;) {
    const value = bytes[i]; let count = 1;
    while (i + count < bytes.length && bytes[i + count] === value && count < 255) count++;
    out.push(count, value); i += count;
  }
  return Uint8Array.from(out);
}

export function rleDecode(input, expectedLength) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out = new Uint8Array(expectedLength); let p = 0;
  if (bytes.length % 2) throw new Error('Invalid RLE byte count');
  for (let i = 0; i < bytes.length; i += 2) {
    const count = bytes[i]; const value = bytes[i + 1];
    if (!count || p + count > expectedLength) throw new Error('RLE expands beyond room size');
    out.fill(value, p, p + count); p += count;
  }
  if (p !== expectedLength) throw new Error(`RLE expanded to ${p} bytes, expected ${expectedLength}`);
  return out;
}

function normalizeRoom(room, index = 0) {
  const width = room.width ?? 16, height = room.height ?? 16;
  const size = width * height;
  const tiles = room.tiles instanceof Uint8Array ? room.tiles : Uint8Array.from(room.tiles ?? []);
  const rotations = room.rotations instanceof Uint8Array ? room.rotations : Uint8Array.from(room.rotations ?? new Uint8Array(size));
  if (tiles.length !== size) throw new Error(`Room ${index + 1} has ${tiles.length} tiles; expected ${size}`);
  if (rotations.length !== size) throw new Error(`Room ${index + 1} has ${rotations.length} rotations; expected ${size}`);
  for (const r of rotations) if (r > 3) throw new Error(`Room ${index + 1} has invalid rotation ${r}`);
  return {
    id: (room.id ?? fnv1a(`room-${index}`)) >>> 0,
    width, height,
    spawnX: room.spawnX ?? 1, spawnY: room.spawnY ?? Math.max(0, height - 2),
    exitX: room.exitX ?? Math.max(0, width - 2), exitY: room.exitY ?? 1,
    flags: room.flags ?? 0,
    tiles, rotations,
    entities: (room.entities ?? []).map(e => ({ type: e.type & 0xff, x: e.x & 0xff, y: e.y & 0xff, flags: e.flags ?? 0 })),
  };
}


function packRotations(rotations) {
  const out = new Uint8Array(ROTATION_PLANE_BYTES);
  for (let i = 0; i < 256; i++) out[i >> 2] |= (rotations[i] & 3) << ((i & 3) * 2);
  return out;
}
function unpackRotations(bytes) {
  if (bytes.length !== ROTATION_PLANE_BYTES) throw new Error('Invalid rotation plane length');
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = (bytes[i >> 2] >> ((i & 3) * 2)) & 3;
  return out;
}

function encodeRoom(room, index) {
  room = normalizeRoom(room, index);
  const compressed = rleEncode(room.tiles);
  const body = new Writer()
    .u8(room.width).u8(room.height)
    .u8(room.spawnX).u8(room.spawnY).u8(room.exitX).u8(room.exitY)
    .u8(room.flags).u8(ROTATION_ENCODING_2BPP)
    .u16(compressed.length).u16(room.entities.length).u32(room.id)
    .bytes(compressed).bytes(packRotations(room.rotations));
  for (const entity of room.entities) body.u8(entity.type).u8(entity.x).u8(entity.y).u8(entity.flags);
  const payload = body.finish();
  if (payload.length > 65535) throw new Error('Room record exceeds 65535 bytes');
  return new Writer().u16(payload.length).bytes(payload).finish();
}

function decodeRoom(reader, index, version) {
  const length = reader.u16(); const end = reader.pos + length;
  if (end > reader.bytes.length) throw new Error(`Room ${index + 1} record is truncated`);
  const width = reader.u8(), height = reader.u8();
  if (!width || !height || width > 32 || height > 32) throw new Error(`Unsupported room dimensions ${width}x${height}`);
  const spawnX = reader.u8(), spawnY = reader.u8(), exitX = reader.u8(), exitY = reader.u8();
  const flags = reader.u8(); const rotationEncoding = reader.u8();
  const tileLength = reader.u16(), entityCount = reader.u16(), id = reader.u32();
  const tiles = rleDecode(reader.take(tileLength, 'room tiles'), width * height);
  let rotations = new Uint8Array(width * height);
  if (version >= 2) {
    if (rotationEncoding === ROTATION_ENCODING_2BPP) rotations = unpackRotations(reader.take(ROTATION_PLANE_BYTES, 'room rotations'));
    else if (rotationEncoding !== 0) throw new Error(`Unsupported rotation encoding ${rotationEncoding}`);
  }
  const entities = [];
  for (let i = 0; i < entityCount; i++) entities.push({ type: reader.u8(), x: reader.u8(), y: reader.u8(), flags: reader.u8() });
  if (reader.pos !== end) throw new Error(`Room ${index + 1} record length mismatch`);
  return { id, width, height, spawnX, spawnY, exitX, exitY, flags, tiles, rotations, entities };
}

function encodeMetadata(item) {
  const title = asciiBytes(item.title || 'Untitled', 63);
  const author = asciiBytes(item.author || 'Unknown', 31);
  const description = asciiBytes(item.description || '', 255);
  return { title, author, description, bytes: new Writer().bytes(title).bytes(author).bytes(description).finish() };
}

function encodeHeader(kind, item, itemCount, body, metadata) {
  const id = (item.id ?? fnv1a(`${item.title}|${item.author}`)) >>> 0;
  return new Writer().bytes(MAGIC).u8(VERSION).u8(kind).u16(item.flags ?? 0)
    .u32(HEADER_SIZE + body.length).u32(crc32(body)).u32(id).u16(itemCount)
    .u8(item.difficulty ?? 0).u8(0)
    .u8(metadata.title.length).u8(metadata.author.length).u16(metadata.description.length)
    .u16(0x0101).u32(0).finish();
}

export function encodeLevelPayload(level) {
  const rooms = level.rooms ?? [];
  if (!rooms.length) throw new Error('A level must contain at least one room');
  const meta = encodeMetadata(level);
  const records = rooms.map(encodeRoom);
  const body = new Writer().bytes(meta.bytes);
  for (const record of records) body.bytes(record);
  const bodyBytes = body.finish();
  return new Writer().bytes(encodeHeader(KIND_LEVEL, level, rooms.length, bodyBytes, meta)).bytes(bodyBytes).finish();
}

export function encodePackPayload(pack) {
  const levels = pack.levels ?? [];
  if (!levels.length) throw new Error('A pack must contain at least one level');
  const meta = encodeMetadata(pack);
  const body = new Writer().bytes(meta.bytes);
  for (const level of levels) {
    const bytes = encodeLevelPayload(level);
    body.u32(bytes.length).bytes(bytes);
  }
  const bodyBytes = body.finish();
  return new Writer().bytes(encodeHeader(KIND_PACK, pack, levels.length, bodyBytes, meta)).bytes(bodyBytes).finish();
}

export function decodePayload(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const r = new Reader(bytes);
  if (safeText(r.take(4, 'magic')) !== 'CELV') throw new Error('Not a CEleste level payload');
  const version = r.u8(); if (version < MIN_VERSION || version > VERSION) throw new Error(`Unsupported CEleste level format version ${version}`);
  const kind = r.u8(); if (kind !== KIND_LEVEL && kind !== KIND_PACK) throw new Error(`Unsupported payload kind ${kind}`);
  const flags = r.u16(), totalLength = r.u32(), checksum = r.u32(), id = r.u32(), itemCount = r.u16();
  const difficulty = r.u8(); r.u8();
  const titleLength = r.u8(), authorLength = r.u8(), descriptionLength = r.u16(), minGameVersion = r.u16(); r.u32();
  if (totalLength !== bytes.length) throw new Error(`Payload length mismatch: header ${totalLength}, actual ${bytes.length}`);
  const body = bytes.slice(HEADER_SIZE);
  if (crc32(body) !== checksum) throw new Error('CEleste payload CRC32 mismatch');
  const title = safeText(r.take(titleLength, 'title'));
  const author = safeText(r.take(authorLength, 'author'));
  const description = safeText(r.take(descriptionLength, 'description'));
  const common = { id, title, author, description, difficulty, flags, minGameVersion, version };
  if (kind === KIND_LEVEL) {
    const rooms = [];
    for (let i = 0; i < itemCount; i++) rooms.push(decodeRoom(r, i, version));
    if (r.remaining()) throw new Error(`Unexpected ${r.remaining()} trailing level bytes`);
    return { kind: 'level', ...common, rooms };
  }
  const levels = [];
  for (let i = 0; i < itemCount; i++) {
    const length = r.u32(); const nested = r.take(length, `level ${i + 1}`); const level = decodePayload(nested);
    if (level.kind !== 'level') throw new Error('Pack contains a non-level record');
    levels.push(level);
  }
  if (r.remaining()) throw new Error(`Unexpected ${r.remaining()} trailing pack bytes`);
  return { kind: 'pack', ...common, levels };
}

function sanitizeVarName(name) {
  const clean = String(name || 'CELVL001').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return (clean || 'CELVL001').padEnd(1, 'A');
}

export function makeVarName(item, kind = 'level') {
  const prefix = kind === 'pack' ? 'CP' : 'CL';
  return sanitizeVarName(prefix + ((item.id ?? fnv1a(item.title || 'Untitled')) >>> 0).toString(36).toUpperCase()).slice(0, 8);
}

export function wrap8xv(payloadInput, options = {}) {
  const payload = payloadInput instanceof Uint8Array ? payloadInput : new Uint8Array(payloadInput);
  if (payload.length > MAX_APPVAR_PAYLOAD) throw new Error(`AppVar payload is ${payload.length} bytes; safe limit is ${MAX_APPVAR_PAYLOAD}`);
  // TI AppVar transfer files contain a two-byte entry-data length immediately
  // before the actual AppVar bytes. The OS consumes this word when installing
  // the variable, so fileioc sees the user payload beginning directly with CELV.
  const variableDataLength = payload.length + 2;
  const name = sanitizeVarName(options.name);
  const data = new Writer().u16(0x000d).u16(variableDataLength).u8(0x15)
    .bytes(asciiBytes(name, 8)).bytes(new Uint8Array(8 - asciiBytes(name, 8).length))
    .u8(0).u8(options.archived === false ? 0 : 0x80).u16(variableDataLength)
    .u16(payload.length).bytes(payload).finish();
  const header = new Uint8Array(55);
  header.set(textEncoder.encode('**TI83F*'), 0); header.set([0x1a, 0x0a, 0x00], 8);
  const comment = asciiBytes(options.comment || 'CEleste custom level', 42); header.set(comment, 11);
  header[53] = data.length & 0xff; header[54] = (data.length >>> 8) & 0xff;
  let sum = 0; for (const b of data) sum = (sum + b) & 0xffff;
  return new Writer().bytes(header).bytes(data).u16(sum).finish();
}

export function unwrap8xv(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 76) throw new Error('File is too small to be an AppVar');
  if (safeText(bytes.slice(0, 8)) !== '**TI83F*') throw new Error('Invalid TI variable signature');
  if (bytes[8] !== 0x1a || bytes[9] !== 0x0a) throw new Error('Invalid TI variable secondary signature');
  const sectionLength = bytes[53] | (bytes[54] << 8);
  if (55 + sectionLength + 2 !== bytes.length) throw new Error('TI data-section length mismatch');
  const section = bytes.slice(55, 55 + sectionLength);
  const expectedSum = bytes[55 + sectionLength] | (bytes[56 + sectionLength] << 8);
  let actualSum = 0; for (const b of section) actualSum = (actualSum + b) & 0xffff;
  if (actualSum !== expectedSum) throw new Error('TI file checksum mismatch');
  const r = new Reader(section);
  const headerLength = r.u16(); if (headerLength !== 0x000d) throw new Error(`Unsupported TI entry header length ${headerLength}`);
  const variableLength = r.u16(); const type = r.u8(); if (type !== 0x15) throw new Error(`TI variable type 0x${type.toString(16)} is not an AppVar`);
  const rawName = r.take(8, 'variable name'); const name = safeText(rawName.slice(0, rawName.indexOf(0) < 0 ? 8 : rawName.indexOf(0)));
  const version = r.u8(), archived = Boolean(r.u8() & 0x80), copyLength = r.u16();
  if (copyLength !== variableLength) throw new Error('TI variable length copies do not match');
  const entryData = r.take(variableLength, 'AppVar entry data');
  if (r.remaining()) throw new Error('Unexpected trailing bytes in TI entry');
  let payload;
  if (entryData.length >= 2) {
    const payloadLength = entryData[0] | (entryData[1] << 8);
    if (payloadLength + 2 === entryData.length) payload = entryData.slice(2);
    // Compatibility with the short-lived malformed Studio build that omitted
    // the required TI AppVar entry-data length and therefore appeared as ~17 KB
    // on a calculator because the bytes "CE" were mistaken for that length.
    else if (safeText(entryData.slice(0, 4)) === 'CELV') payload = entryData;
    else throw new Error('AppVar entry-data length mismatch');
  } else throw new Error('AppVar entry data is truncated');
  return { name, version, archived, comment: safeText(bytes.slice(11, 53)).replace(/[\0 ]+$/g, ''), payload };
}

export function exportLevel8xv(level, options = {}) {
  const payload = encodeLevelPayload(level);
  return wrap8xv(payload, { name: options.name || makeVarName(level, 'level'), comment: options.comment || `CEleste: ${level.title}`, archived: options.archived });
}

export function exportPack8xv(pack, options = {}) {
  const payload = encodePackPayload(pack);
  return wrap8xv(payload, { name: options.name || makeVarName(pack, 'pack'), comment: options.comment || `CEleste pack: ${pack.title}`, archived: options.archived });
}

export function import8xv(input) {
  const outer = unwrap8xv(input); return { ...outer, data: decodePayload(outer.payload) };
}

function validationFootprint(entity) {
  const x = entity.x, y = entity.y;
  if (entity.type === 64 || entity.type === 96) return [{x,y},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}];
  if (entity.type === 86) return [{x,y:y-1},{x:x+1,y:y-1},{x,y},{x:x+1,y}];
  if (entity.type === 11 || entity.type === 12) return [{x,y},{x:x+1,y}];
  return [{x,y}];
}

export function validateLevel(level) {
  const errors = [], warnings = [];
  if (!String(level.title || '').trim()) errors.push('Level title is required.');
  if (!level.rooms?.length) errors.push('The level has no rooms.');
  if ((level.rooms?.length ?? 0) > 32) errors.push('The calculator runtime supports at most 32 rooms per level.');
  (level.rooms ?? []).forEach((room, i) => {
    const label = `Room ${i + 1}`;
    if (room.width !== 16 || room.height !== 16) errors.push(`${label}: calculator custom levels must be 16x16.`);
    if (!(room.tiles instanceof Uint8Array) || room.tiles.length !== room.width * room.height) errors.push(`${label}: tile array size is invalid.`);
    if (!(room.rotations instanceof Uint8Array) || room.rotations.length !== room.width * room.height) errors.push(`${label}: rotation array size is invalid.`);
    else for (const rotation of room.rotations) if (rotation > 3) { errors.push(`${label}: invalid tile rotation ${rotation}.`); break; }
    if (room.spawnX < 0 || room.spawnX >= room.width || room.spawnY < 0 || room.spawnY >= room.height) errors.push(`${label}: player spawn is outside the room.`);
    if ((room.entities?.length ?? 0) > 48) errors.push(`${label}: more than 48 gameplay entities exceeds the calculator runtime limit.`);
    for (const id of room.tiles ?? []) if (id > 127) errors.push(`${label}: tile ID ${id} is outside the PICO-8 atlas.`);

    const occupied = new Map();
    let keyCount = 0, chestCount = 0;
    for (const entity of room.entities ?? []) {
      if (![8,11,12,18,20,22,23,26,28,64,86,96,118].includes(entity.type)) errors.push(`${label}: unsupported gameplay entity type ${entity.type}.`);
      if (entity.type === 8) keyCount++;
      if (entity.type === 20) chestCount++;
      const footprint = validationFootprint(entity);
      for (const cell of footprint) {
        if (cell.x < 0 || cell.x >= room.width || cell.y < 0 || cell.y >= room.height) {
          errors.push(`${label}: ${entity.type} at ${entity.x},${entity.y} does not fit its complete footprint inside the room.`);
          break;
        }
        const key = `${cell.x},${cell.y}`;
        if (occupied.has(key)) errors.push(`${label}: gameplay pieces overlap at ${key} (IDs ${occupied.get(key)} and ${entity.type}).`);
        else occupied.set(key, entity.type);
      }
      if ((entity.type === 64 || entity.type === 20) && (entity.flags & 1)) warnings.push(`${label}: ${entity.type === 64 ? 'fake wall' : 'locked chest'} at ${entity.x},${entity.y} is configured empty (no strawberry).`);
      if (entity.type === 96 && (entity.flags & 2)) warnings.push(`${label}: big chest at ${entity.x},${entity.y} is configured for three dashes.`);
    }
    if (chestCount && !keyCount) warnings.push(`${label}: contains ${chestCount} locked chest(s) but no key.`);
    if (keyCount && !chestCount) warnings.push(`${label}: contains a key but no locked chest.`);
    for (const key of occupied.keys()) {
      const [x,y] = key.split(',').map(Number);
      if (room.tiles?.[y * room.width + x]) warnings.push(`${label}: terrain exists underneath the complete gameplay piece footprint at ${key}; Studio normally clears this automatically.`);
    }
  });
  try { const size = encodeLevelPayload(level).length; if (size > MAX_APPVAR_PAYLOAD) errors.push(`Encoded level is ${size} bytes, over the AppVar limit.`); }
  catch (error) { errors.push(error.message); }
  return { errors, warnings, valid: errors.length === 0 };
}

export function validatePack(pack) {
  const errors = [], warnings = [], ids = new Set();
  if (!pack.levels?.length) errors.push('The pack has no levels.');
  for (const [i, level] of (pack.levels ?? []).entries()) {
    const result = validateLevel(level);
    errors.push(...result.errors.map(e => `Level ${i + 1}: ${e}`));
    warnings.push(...result.warnings.map(e => `Level ${i + 1}: ${e}`));
    if (ids.has(level.id)) errors.push(`Level ${i + 1}: duplicate level ID ${level.id}.`); ids.add(level.id);
  }
  try { const size = encodePackPayload(pack).length; if (size > MAX_APPVAR_PAYLOAD) errors.push(`Encoded pack is ${size} bytes, over the single-AppVar limit.`); }
  catch (error) { errors.push(error.message); }
  return { errors, warnings, valid: errors.length === 0 };
}
