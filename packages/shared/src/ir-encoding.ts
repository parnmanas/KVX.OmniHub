// Server-side IR encoding.
//
// Why this exists: the firmware used to dispatch on protocol name (NEC,
// SAMSUNG, LG, LG2, …) and call IRremoteESP8266's per-protocol sender.
// That meant any new protocol required reflashing every ESP32 in the
// field. Instead we encode (protocol, value, bits) → microsecond timing
// array on the server and send just the raw burst + carrier kHz to the
// firmware. New protocols become a pure server change.
//
// Timing constants below mirror IRremoteESP8266's ir_<Proto>.cpp so that
// captures learned on-device round-trip correctly.

import type { IrPayload, IrProtocol } from "./equipment.js";

export interface EncodedBurst {
  raw: number[]; // alternating mark/space durations in microseconds, mark first
  khz: number; // carrier frequency
}

// Parse a hex value, accepting optional "0x" prefix.
function parseHex(s: string): bigint {
  return BigInt(s.startsWith("0x") || s.startsWith("0X") ? s : "0x" + s);
}

// Push one "1" bit (mark + long space) or "0" bit (mark + short space).
function pushBit(
  out: number[],
  bit: number,
  bitMark: number,
  oneSpace: number,
  zeroSpace: number,
): void {
  out.push(bitMark, bit ? oneSpace : zeroSpace);
}

// Push `nbits` of `value`, MSB first.
function pushMsbFirst(
  out: number[],
  value: bigint,
  nbits: number,
  bitMark: number,
  oneSpace: number,
  zeroSpace: number,
): void {
  for (let i = nbits - 1; i >= 0; i--) {
    const bit = Number((value >> BigInt(i)) & 1n);
    pushBit(out, bit, bitMark, oneSpace, zeroSpace);
  }
}

// ============================================================================
// Per-protocol encoders. Timing values are from IRremoteESP8266.
// ============================================================================

// NEC: 9000/4500 header, 560 bit mark, 1690 one space, 560 zero space.
function encodeNEC(value: bigint, bits: number): EncodedBurst {
  const raw: number[] = [9000, 4500];
  pushMsbFirst(raw, value, bits, 560, 1690, 560);
  raw.push(560); // trailing mark
  return { raw, khz: 38 };
}

// SAMSUNG: 4500/4500 header, 560 bit mark, 1690 one space, 560 zero space.
function encodeSAMSUNG(value: bigint, bits: number): EncodedBurst {
  const raw: number[] = [4500, 4500];
  pushMsbFirst(raw, value, bits, 560, 1690, 560);
  raw.push(560);
  return { raw, khz: 38 };
}

// LG (28-bit) — IRremoteESP8266 ir_LG.cpp.
// Header 8500/4250, bit mark 600, one space 1600, zero space 550, trailing 600.
// For 32-bit, IRremoteESP8266 routes through sendSAMSUNG; we mirror that.
function encodeLG(value: bigint, bits: number): EncodedBurst {
  if (bits >= 32) return encodeSAMSUNG(value, bits);
  const raw: number[] = [8500, 4250];
  pushMsbFirst(raw, value, bits, 600, 1600, 550);
  raw.push(600);
  return { raw, khz: 38 };
}

// LG2 (28-bit) variant — header 3000/9700, bit mark 480, one space 1580,
// zero space 550, trailing 480.
function encodeLG2(value: bigint, bits: number): EncodedBurst {
  if (bits >= 32) return encodeLG(value, bits);
  const raw: number[] = [3000, 9700];
  pushMsbFirst(raw, value, bits, 480, 1580, 550);
  raw.push(480);
  return { raw, khz: 38 };
}

// SONY: 2400/600 header, one mark 1200, zero mark 600, both spaces 600.
// 40 kHz carrier (not 38!). LSB first per Sony spec, but IRremoteESP8266
// matches the on-air bit order to its decoded representation, so we send
// the value MSB first to round-trip cleanly with the library decoder.
function encodeSONY(value: bigint, bits: number): EncodedBurst {
  const raw: number[] = [2400, 600];
  for (let i = bits - 1; i >= 0; i--) {
    const bit = Number((value >> BigInt(i)) & 1n);
    raw.push(bit ? 1200 : 600, 600);
  }
  return { raw, khz: 40 };
}

// ============================================================================
// Dispatch
// ============================================================================

const ENCODERS: Partial<Record<
  IrProtocol,
  (value: bigint, bits: number) => EncodedBurst
>> = {
  NEC: encodeNEC,
  SAMSUNG: encodeSAMSUNG,
  LG: encodeLG,
  LG2: encodeLG2,
  // LG_AC is the stateful AC marker — same wire format as LG2.
  LG_AC: encodeLG2,
  SONY: encodeSONY,
};

/**
 * Convert an IrPayload into a raw microsecond burst the firmware can
 * transmit directly via sendRaw().
 *
 * - If the payload already has raw data, returns it verbatim (carrier
 *   defaults to 38 kHz — captured rawTiming is carrier-agnostic).
 * - If decoded is present and the protocol is supported, encodes it.
 * - Returns null if neither raw nor a supported decoded value is present;
 *   the caller should refuse to send.
 */
export function encodeIrPayload(payload: IrPayload): EncodedBurst | null {
  // Raw is always preferred when present — it's an exact capture.
  if (Array.isArray(payload.raw) && payload.raw.length > 0) {
    return { raw: payload.raw, khz: 38 };
  }
  if (!payload.decoded) return null;
  const enc = ENCODERS[payload.protocol];
  if (!enc) return null;
  const value = parseHex(payload.decoded.value);
  return enc(value, payload.decoded.bits);
}

/** Names of protocols the server can encode. Useful for diagnostics/UI. */
export function supportedEncodedProtocols(): IrProtocol[] {
  return Object.keys(ENCODERS) as IrProtocol[];
}
