#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
fmt = ROOT / "lib/format.mjs"
t = fmt.read_text()
old = '''export function wrap8xv(payloadInput, options = {}) {
  const payload = payloadInput instanceof Uint8Array ? payloadInput : new Uint8Array(payloadInput);
  if (payload.length > MAX_APPVAR_PAYLOAD) throw new Error(`AppVar payload is ${payload.length} bytes; safe limit is ${MAX_APPVAR_PAYLOAD}`);
  const variableDataLength = payload.length + 2;
  const name = sanitizeVarName(options.name);
  const data = new Writer().u16(0x000d).u16(variableDataLength).u8(0x15)
    .bytes(asciiBytes(name, 8)).bytes(new Uint8Array(8 - asciiBytes(name, 8).length))
    .u8(0).u8(options.archived === false ? 0 : 0x80).u16(variableDataLength)
    .u16(payload.length).bytes(payload).finish();
'''
new = '''export function wrap8xv(payloadInput, options = {}) {
  const payload = payloadInput instanceof Uint8Array ? payloadInput : new Uint8Array(payloadInput);
  if (payload.length > MAX_APPVAR_PAYLOAD) throw new Error(`AppVar payload is ${payload.length} bytes; safe limit is ${MAX_APPVAR_PAYLOAD}`);
  // The TI variable-entry length fields already describe the AppVar data size.
  // Do NOT prefix AppVar contents with another u16 length: CEleste scans the
  // calculator VAT for AppVars whose first four data bytes are exactly CELV.
  const variableDataLength = payload.length;
  const name = sanitizeVarName(options.name);
  const data = new Writer().u16(0x000d).u16(variableDataLength).u8(0x15)
    .bytes(asciiBytes(name, 8)).bytes(new Uint8Array(8 - asciiBytes(name, 8).length))
    .u8(0).u8(options.archived === false ? 0 : 0x80).u16(variableDataLength)
    .bytes(payload).finish();
'''
if new not in t:
    if old not in t:
        raise SystemExit("wrap8xv patch point not found")
    t = t.replace(old, new, 1)
old = '''  const version = r.u8(), archived = Boolean(r.u8() & 0x80), copyLength = r.u16();
  if (copyLength !== variableLength) throw new Error('TI variable length copies do not match');
  const payloadLength = r.u16(); if (payloadLength + 2 !== variableLength) throw new Error('AppVar payload length mismatch');
  const payload = r.take(payloadLength, 'AppVar payload'); if (r.remaining()) throw new Error('Unexpected trailing bytes in TI entry');
  return { name, version, archived, comment: safeText(bytes.slice(11, 53)).replace(/[\\0 ]+$/g, ''), payload };
'''
new = '''  const version = r.u8(), archived = Boolean(r.u8() & 0x80), copyLength = r.u16();
  if (copyLength !== variableLength) throw new Error('TI variable length copies do not match');
  let payload = r.take(variableLength, 'AppVar payload');
  if (r.remaining()) throw new Error('Unexpected trailing bytes in TI entry');
  // Studio builds before this fix incorrectly inserted a second little-endian
  // payload length inside AppVar data. Accept those files on import so users
  // can reopen and re-export them, but all new exports use raw CELV data.
  if (payload.length >= 6 && safeText(payload.slice(0, 4)) !== 'CELV') {
    const legacyLength = payload[0] | (payload[1] << 8);
    if (legacyLength + 2 === payload.length && safeText(payload.slice(2, 6)) === 'CELV') payload = payload.slice(2);
  }
  return { name, version, archived, comment: safeText(bytes.slice(11, 53)).replace(/[\\0 ]+$/g, ''), payload };
'''
if new not in t:
    if old not in t:
        raise SystemExit("unwrap8xv patch point not found")
    t = t.replace(old, new, 1)
fmt.write_text(t)

test = ROOT / "tests/format.test.mjs"
s = test.read_text()
marker = "test('8xv level round trip and checksum', () => {"
addition = '''test('exported AppVar data begins with CELV magic for calculator scanning', () => {
  const bytes = exportLevel8xv(level(), { name: 'CLMAGIC' });
  assert.equal(new TextDecoder().decode(bytes.slice(72, 76)), 'CELV');
  const variableLength = bytes[57] | (bytes[58] << 8);
  const copyLength = bytes[70] | (bytes[71] << 8);
  assert.equal(copyLength, variableLength);
  assert.equal(variableLength, encodeLevelPayload(level()).length);
});

'''
if addition not in s:
    if marker not in s:
        raise SystemExit("test insertion point not found")
    s = s.replace(marker, addition + marker, 1)
test.write_text(s)
print('Applied Studio AppVar/CELV wrapper fix.')
