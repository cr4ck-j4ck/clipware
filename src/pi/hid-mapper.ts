// src/pi/hid-mapper.ts
// Maps ASCII to USB HID codes.
// References: https://gist.github.com/MightyPork/6da26e382a7ad91b5496ee55fdc73db2

export const Modifiers = {
  NONE: 0x00,
  L_CTRL: 0x01,
  L_SHIFT: 0x02,
  L_ALT: 0x04,
  L_META: 0x08,
  R_CTRL: 0x10,
  R_SHIFT: 0x20,
  R_ALT: 0x40,
  R_META: 0x80
};

export interface HIDReport {
  modifier: number;
  keycode: number;
}

// A simple ASCII to HID map (US Keyboard Layout).
// We only map standard printable ASCII for basic text injection.
export function charToHID(char: string): HIDReport | null {
  const code = char.charCodeAt(0);
  
  // Special handling
  if (char === '\n') return { modifier: Modifiers.NONE, keycode: 0x28 }; // Enter
  if (char === '\t') return { modifier: Modifiers.NONE, keycode: 0x2B }; // Tab
  if (char === ' ') return { modifier: Modifiers.NONE, keycode: 0x2C }; // Space

  // Lowercase letters (a-z)
  if (code >= 97 && code <= 122) {
    return { modifier: Modifiers.NONE, keycode: code - 97 + 0x04 };
  }
  // Uppercase letters (A-Z)
  if (code >= 65 && code <= 90) {
    return { modifier: Modifiers.L_SHIFT, keycode: code - 65 + 0x04 };
  }
  
  // Numbers (1-9, 0)
  if (code >= 49 && code <= 57) { // 1-9
    return { modifier: Modifiers.NONE, keycode: code - 49 + 0x1E };
  }
  if (code === 48) { // 0
    return { modifier: Modifiers.NONE, keycode: 0x27 };
  }

  // Symbols and punctuation
  const exactMap: Record<string, HIDReport> = {
    '-': { modifier: Modifiers.NONE, keycode: 0x2D },
    '=': { modifier: Modifiers.NONE, keycode: 0x2E },
    '[': { modifier: Modifiers.NONE, keycode: 0x2F },
    ']': { modifier: Modifiers.NONE, keycode: 0x30 },
    '\\': { modifier: Modifiers.NONE, keycode: 0x31 },
    ';': { modifier: Modifiers.NONE, keycode: 0x33 },
    '\'': { modifier: Modifiers.NONE, keycode: 0x34 },
    '`': { modifier: Modifiers.NONE, keycode: 0x35 },
    ',': { modifier: Modifiers.NONE, keycode: 0x36 },
    '.': { modifier: Modifiers.NONE, keycode: 0x37 },
    '/': { modifier: Modifiers.NONE, keycode: 0x38 },

    // Shifted symbols
    '!': { modifier: Modifiers.L_SHIFT, keycode: 0x1E }, // 1
    '@': { modifier: Modifiers.L_SHIFT, keycode: 0x1F }, // 2
    '#': { modifier: Modifiers.L_SHIFT, keycode: 0x20 }, // 3
    '$': { modifier: Modifiers.L_SHIFT, keycode: 0x21 }, // 4
    '%': { modifier: Modifiers.L_SHIFT, keycode: 0x22 }, // 5
    '^': { modifier: Modifiers.L_SHIFT, keycode: 0x23 }, // 6
    '&': { modifier: Modifiers.L_SHIFT, keycode: 0x24 }, // 7
    '*': { modifier: Modifiers.L_SHIFT, keycode: 0x25 }, // 8
    '(': { modifier: Modifiers.L_SHIFT, keycode: 0x26 }, // 9
    ')': { modifier: Modifiers.L_SHIFT, keycode: 0x27 }, // 0
    '_': { modifier: Modifiers.L_SHIFT, keycode: 0x2D }, // -
    '+': { modifier: Modifiers.L_SHIFT, keycode: 0x2E }, // =
    '{': { modifier: Modifiers.L_SHIFT, keycode: 0x2F }, // [
    '}': { modifier: Modifiers.L_SHIFT, keycode: 0x30 }, // ]
    '|': { modifier: Modifiers.L_SHIFT, keycode: 0x31 }, // \
    ':': { modifier: Modifiers.L_SHIFT, keycode: 0x33 }, // ;
    '"': { modifier: Modifiers.L_SHIFT, keycode: 0x34 }, // '
    '~': { modifier: Modifiers.L_SHIFT, keycode: 0x35 }, // `
    '<': { modifier: Modifiers.L_SHIFT, keycode: 0x36 }, // ,
    '>': { modifier: Modifiers.L_SHIFT, keycode: 0x37 }, // .
    '?': { modifier: Modifiers.L_SHIFT, keycode: 0x38 }, // /
  };

  if (char in exactMap) {
    return exactMap[char];
  }

  // Unsupported or unmapped character
  return null;
}

export function buildReportBuffer(report: HIDReport): Buffer {
  // A standard USB HID keyboard report is 8 bytes.
  // Byte 0: Modifier keys
  // Byte 1: Reserved (usually 0)
  // Byte 2-7: Keycodes (up to 6 keys pressed simultaneously)
  const buf = Buffer.alloc(8, 0);
  buf[0] = report.modifier;
  buf[2] = report.keycode;
  return buf;
}

export function buildEmptyReportBuffer(): Buffer {
  return Buffer.alloc(8, 0);
}
