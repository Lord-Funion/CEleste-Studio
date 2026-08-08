#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
fmt = ROOT / "lib/format.mjs"
t = fmt.read_text()
old = '''  // The TI variable-entry length fields already describe the AppVar data size.\n  // Do NOT prefix AppVar contents with another u16 length: CEleste scans the\n  // calculator VAT for AppVars whose first four data bytes are exactly CELV.\n  const variableDataLength = payload.length;\n  const name = sanitizeVarName(options.name);\n  const data = new Writer().u16(0x000d).u16(variableDataLength).u8(0x15)\n    .bytes(asciiBytes(name, 8)).bytes(new Uint8Array(8 - asciiBytes(name, 8).length))\n    .u8(0).u8(options.archived === false ? 0 : 0x80).u16(variableDataLength)\n    .bytes(payload).finish();\n'''
new = '''  // TI AppVar transfer files contain a two-byte entry-data length immediately\n  // before the actual AppVar bytes. The OS consumes this word when installing\n  // the variable, so fileioc sees the user payload beginning directly with CELV.\n  const variableDataLength = payload.length + 2;\n  const name = sanitizeVarName(options.name);\n  const data = new Writer().u16(0x000d).u16(variableDataLength).u8(0x15)\n    .bytes(asciiBytes(name, 8)).bytes(new Uint8Array(8 - asciiBytes(name, 8).length))\n    .u8(0).u8(options.archived === false ? 0 : 0x80).u16(variableDataLength)\n    .u16(payload.length).bytes(payload).finish();\n'''
if old not in t:
    raise SystemExit("wrap8xv patch point not found")
t = t.replace(old, new, 1)
old = '''  const version = r.u8(), archived = Boolean(r.u8() & 0x80), copyLength = r.u16();\n  if (copyLength !== variableLength) throw new Error('TI variable length copies do not match');\n  let payload = r.take(variableLength, 'AppVar payload');\n  if (r.remaining()) throw new Error('Unexpected trailing bytes in TI entry');\n  // Studio builds before this fix incorrectly inserted a second little-endian\n  // payload length inside AppVar data. Accept those files on import so users\n  // can reopen and re-export them, but all new exports use raw CELV data.\n  if (payload.length >= 6 && safeText(payload.slice(0, 4)) !== 'CELV') {\n    const legacyLength = payload[0] | (payload[1] << 8);\n    if (legacyLength + 2 === payload.length && safeText(payload.slice(2, 6)) === 'CELV') payload = payload.slice(2);\n  }\n  return { name, version, archived, comment: safeText(bytes.slice(11, 53)).replace(/[\\0 ]+$/g, ''), payload };\n'''
new = '''  const version = r.u8(), archived = Boolean(r.u8() & 0x80), copyLength = r.u16();\n  if (copyLength !== variableLength) throw new Error('TI variable length copies do not match');\n  const entryData = r.take(variableLength, 'AppVar entry data');\n  if (r.remaining()) throw new Error('Unexpected trailing bytes in TI entry');\n  let payload;\n  if (entryData.length >= 2) {\n    const payloadLength = entryData[0] | (entryData[1] << 8);\n    if (payloadLength + 2 === entryData.length) payload = entryData.slice(2);\n    // Compatibility with the short-lived malformed Studio build that omitted\n    // the required TI AppVar entry-data length and therefore appeared as ~17 KB\n    // on a calculator because the bytes \"CE\" were mistaken for that length.\n    else if (safeText(entryData.slice(0, 4)) === 'CELV') payload = entryData;\n    else throw new Error('AppVar entry-data length mismatch');\n  } else throw new Error('AppVar entry data is truncated');\n  return { name, version, archived, comment: safeText(bytes.slice(11, 53)).replace(/[\\0 ]+$/g, ''), payload };\n'''
if old not in t:
    raise SystemExit("unwrap8xv patch point not found")
t = t.replace(old, new, 1)
fmt.write_text(t)

test = ROOT / "tests/format.test.mjs"
s = test.read_text()
old = '''test('exported AppVar data begins with CELV magic for calculator scanning', () => {\n  const bytes = exportLevel8xv(level(), { name: 'CLMAGIC' });\n  assert.equal(new TextDecoder().decode(bytes.slice(72, 76)), 'CELV');\n  const variableLength = bytes[57] | (bytes[58] << 8);\n  const copyLength = bytes[70] | (bytes[71] << 8);\n  assert.equal(copyLength, variableLength);\n  assert.equal(variableLength, encodeLevelPayload(level()).length);\n});\n'''
new = '''test('exported AppVar has TI entry-data length before CELV payload', () => {\n  const original = level();\n  const payload = encodeLevelPayload(original);\n  const bytes = exportLevel8xv(original, { name: 'CLMAGIC' });\n  const variableLength = bytes[57] | (bytes[58] << 8);\n  const copyLength = bytes[70] | (bytes[71] << 8);\n  const entryPayloadLength = bytes[72] | (bytes[73] << 8);\n  assert.equal(copyLength, variableLength);\n  assert.equal(variableLength, payload.length + 2);\n  assert.equal(entryPayloadLength, payload.length);\n  assert.equal(new TextDecoder().decode(bytes.slice(74, 78)), 'CELV');\n});\n'''
if old not in s:
    raise SystemExit("AppVar regression test patch point not found")
s = s.replace(old, new, 1)
test.write_text(s)
print('Applied correct TI AppVar entry-data layout.')
