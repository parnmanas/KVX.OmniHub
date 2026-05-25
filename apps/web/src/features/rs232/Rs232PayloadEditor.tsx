import { useEffect, useState } from "react";
import type { Rs232Payload } from "@omnihub/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface Props {
  value: Rs232Payload;
  onChange: (v: Rs232Payload) => void;
}

// Bauds the server accepts (matches dispatchRs232's allowedBauds list).
const BAUDS = [
  1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 76800, 115200, 230400,
  460800, 921600,
];

/**
 * In-place editor for an Rs232Payload. Designed to be embedded into the
 * generic AddFunctionModal / EditFunctionModal that shows different
 * editors per controlType.
 *
 * Bytes input modes:
 *   - "hex"   space-separated hex pairs:   0D 2A 70 6F 77 3D 6F 6E 23 0D
 *   - "ascii" plain string (CR/LF as \\r, \\n; STX as \\x02): \\r*pow=on#\\r
 * The editor parses + canonicalizes both directions so the operator can
 * paste from a manual in whichever form the manual shows.
 */
export function Rs232PayloadEditor({ value, onChange }: Props) {
  const [bytesMode, setBytesMode] = useState<"hex" | "ascii">("hex");
  const [bytesText, setBytesText] = useState<string>(() =>
    bytesMode === "hex" ? bytesToHex(value.bytes) : bytesToAscii(value.bytes),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  // Reseed local text when the upstream payload changes (e.g. when opening
  // the modal on a different function).
  useEffect(() => {
    setBytesText(
      bytesMode === "hex"
        ? bytesToHex(value.bytes)
        : bytesToAscii(value.bytes),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.bytes]);

  function patch<K extends keyof Rs232Payload>(
    key: K,
    val: Rs232Payload[K],
  ) {
    onChange({ ...value, [key]: val });
  }

  function commitBytes(text: string) {
    setBytesText(text);
    try {
      const bytes =
        bytesMode === "hex" ? parseHex(text) : parseAscii(text);
      setParseError(null);
      patch("bytes", bytes);
    } catch (e) {
      setParseError((e as Error).message);
    }
  }

  function toggleMode() {
    const next = bytesMode === "hex" ? "ascii" : "hex";
    setBytesMode(next);
    setBytesText(
      next === "hex" ? bytesToHex(value.bytes) : bytesToAscii(value.bytes),
    );
    setParseError(null);
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Baud</Label>
          <Select
            value={String(value.baud)}
            onChange={(e) => patch("baud", parseInt(e.target.value, 10))}
            className="h-8 text-xs"
          >
            {BAUDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <Select
            value={String(value.dataBits)}
            onChange={(e) =>
              patch("dataBits", parseInt(e.target.value, 10) as 7 | 8)
            }
            className="h-8 text-xs"
          >
            <option value="7">7</option>
            <option value="8">8</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Parity</Label>
          <Select
            value={value.parity}
            onChange={(e) =>
              patch("parity", e.target.value as Rs232Payload["parity"])
            }
            className="h-8 text-xs"
          >
            <option value="none">N (none)</option>
            <option value="even">E (even)</option>
            <option value="odd">O (odd)</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stop</Label>
          <Select
            value={String(value.stopBits)}
            onChange={(e) =>
              patch("stopBits", parseInt(e.target.value, 10) as 1 | 2)
            }
            className="h-8 text-xs"
          >
            <option value="1">1</option>
            <option value="2">2</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            Bytes ({value.bytes.length}개)
          </Label>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={toggleMode}
          >
            {bytesMode === "hex" ? "ASCII 입력으로" : "Hex 입력으로"}
          </button>
        </div>
        <textarea
          value={bytesText}
          onChange={(e) => commitBytes(e.target.value)}
          rows={3}
          className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
          placeholder={
            bytesMode === "hex"
              ? "예: 0D 2A 70 6F 77 3D 6F 6E 23 0D"
              : "예: \\r*pow=on#\\r"
          }
        />
        {parseError && (
          <p className="text-xs text-destructive">{parseError}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {bytesMode === "hex"
            ? "공백 구분 hex pair (00..FF). 0x 접두사도 OK."
            : "백슬래시 이스케이프: \\r=CR, \\n=LF, \\t=tab, \\x02=STX, \\x03=ETX, \\\\=백슬래시."}
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">응답 대기 시간 (ms, 0 = 응답 안 받음)</Label>
        <Input
          type="number"
          min={0}
          max={5000}
          step={50}
          value={value.responseTimeoutMs ?? 0}
          onChange={(e) =>
            patch(
              "responseTimeoutMs",
              Math.max(0, parseInt(e.target.value, 10) || 0),
            )
          }
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          query_ 명령은 200~500 권장. 그 외 단방향 명령은 0.
        </p>
      </div>
    </div>
  );
}

// ---------- parsers ----------

function bytesToHex(bytes: number[]): string {
  return bytes
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

function bytesToAscii(bytes: number[]): string {
  let s = "";
  for (const b of bytes) {
    if (b === 0x5c) s += "\\\\";
    else if (b === 0x0d) s += "\\r";
    else if (b === 0x0a) s += "\\n";
    else if (b === 0x09) s += "\\t";
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += `\\x${b.toString(16).padStart(2, "0")}`;
  }
  return s;
}

function parseHex(text: string): number[] {
  const tokens = text
    .replace(/0x/gi, "")
    .split(/[\s,]+/)
    .filter(Boolean);
  const out: number[] = [];
  for (const t of tokens) {
    if (!/^[0-9a-fA-F]{1,2}$/.test(t)) {
      throw new Error(`'${t}' 는 유효한 hex byte가 아닙니다`);
    }
    const v = parseInt(t, 16);
    if (v < 0 || v > 255) throw new Error(`${t}: 0..FF 범위를 벗어남`);
    out.push(v);
  }
  return out;
}

function parseAscii(text: string): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c !== "\\") {
      out.push(text.charCodeAt(i));
      i++;
      continue;
    }
    // escape sequence
    const e = text[i + 1];
    if (e === "r") {
      out.push(0x0d);
      i += 2;
    } else if (e === "n") {
      out.push(0x0a);
      i += 2;
    } else if (e === "t") {
      out.push(0x09);
      i += 2;
    } else if (e === "\\") {
      out.push(0x5c);
      i += 2;
    } else if (e === "x") {
      const hex = text.slice(i + 2, i + 4);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        throw new Error(`\\x 뒤에 hex 두 글자가 필요합니다 (지금: '\\x${hex}')`);
      }
      out.push(parseInt(hex, 16));
      i += 4;
    } else if (e === undefined) {
      throw new Error("문자열 끝에 '\\' 가 단독으로 있어요");
    } else {
      throw new Error(`알 수 없는 이스케이프: '\\${e}'`);
    }
  }
  return out;
}
