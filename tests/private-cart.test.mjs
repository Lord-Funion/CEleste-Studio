import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOriginalCelesteCart} from '../lib/private-cart.mjs';
import {minimalCelesteCart} from './minimal-celeste-fixture.mjs';

test('accepts the structural Celeste cart layout used by the production patcher',()=>{
  const cart=minimalCelesteCart();
  assert.equal(validateOriginalCelesteCart(cart),cart);
});

test('rejects generic PICO-8 carts before they enter browser-local storage',()=>{
  const generic='pico-8 cartridge // http://www.pico-8.com\nversion 42\n__lua__\nfunction _init() end\n__gfx__\n00\n__gff__\n00\n__map__\n00\n';
  assert.throws(()=>validateOriginalCelesteCart(generic),/compatible Celeste|missing function/);
});
