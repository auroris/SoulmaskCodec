/**
 * `TextProperty` (FText) + `FTextValue`.
 *
 * UE4 FText wire format:
 *   uint32  Flags
 *   int8    HistoryType
 *
 *   HistoryType -1 (None / culture-invariant):
 *       int32   bHasCultureInvariantString
 *       [FString displayString]
 *
 *   HistoryType 0 (Base / localized):
 *       FString Namespace
 *       FString Key
 *       FString SourceString
 *
 *   HistoryType 1 (NamedFormat):
 *       FText   SourceFmt
 *       int32   NumArguments
 *       for each: FString Key, int8 ContentType, value-by-type
 *       Soulmask uses this for named placeholders like "X={X} Y={Y} Z={Z}"
 *       in ParamArrayTxt elements of JingYingRiZhiList.
 *
 *   HistoryType 2 (OrderedFormat):
 *       FText   SourceFmt
 *       int32   NumArguments
 *       for each: int8 ContentType + value-by-type (positional, {0}/{1}/...)
 *
 *   HistoryType 4 (AsNumber, FTextHistory_AsNumber):
 *       FFormatArgumentValue SourceValue (int8 type + value-by-type)
 *       uint32 bHasFormatOptions  ← legacy UE3-style 4-byte bool, NOT 1-byte
 *       [FNumberFormattingOptions FormatOptions]
 *       uint32 bHasCulture
 *       [FString TargetCulture]
 *       FNumberFormattingOptions = AlwaysSign(uint32) + UseGrouping(uint32) +
 *         RoundingMode(int8) + 4 x int32 digit-count fields.
 *
 *   HistoryType 11 (StringTableEntry, FTextHistory_StringTableEntry):
 *       FName   TableId        // Soulmask form: bare FString, no int32 Number
 *       FString Key
 *       Soulmask uses this for log entries that reference a centralized
 *       string table (e.g. GongHuiRiZhiData entries from BetterBonfires
 *       and other DLC mods).
 *
 *   All other types: remaining bytes captured in `_raw` for verbatim
 *   round-trip; the codec emits a warn (or throws under strict mode).
 *
 * ContentType codes (for HistoryType 1, 2, and 4's SourceValue):
 *   0=Int(int64)  1=UInt(uint64)  2=Float(f32)  3=Double(f64)
 *   4=Text(FText, recursive)  5=Gender(int8)
 *
 * @module wscodec/properties/text
 */

import { Property, registerProperty, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { FName } from '../primitives.mjs';
import { OpaqueValue } from './opaque.mjs';
import { b64encode, b64decode } from '../base64.mjs';

/**
 * Decoded `FText` value. Only the subset of fields relevant to the
 * `historyType` is populated; see the module description for the wire
 * shape per `historyType` value.
 */
export class FTextValue {
  /**
   * @param {Object} [fields]
   * @param {number} [fields.flags=0] - FText flags (uint32).
   * @param {number} [fields.historyType=-1] - One of -1, 0, 1, 2, 4, 11 (others captured as `_raw`).
   * @param {string} [fields.displayString] - historyType=-1.
   * @param {boolean} [fields.displayStringIsNull=false] - historyType=-1.
   * @param {string} [fields.namespace] - historyType=0.
   * @param {boolean} [fields.namespaceIsNull=false] - historyType=0.
   * @param {string} [fields.key] - historyType=0.
   * @param {boolean} [fields.keyIsNull=false] - historyType=0.
   * @param {string} [fields.sourceString] - historyType=0.
   * @param {boolean} [fields.sourceStringIsNull=false] - historyType=0.
   * @param {FTextValue} [fields.sourceFmt] - historyType=1 or 2.
   * @param {Array<Object>} [fields.arguments] - historyType=1 (named) or 2 (positional).
   * @param {Object} [fields.sourceValue] - historyType=4.
   * @param {Object|null} [fields.formatOptions] - historyType=4.
   * @param {string|null} [fields.culture] - historyType=4.
   * @param {boolean} [fields.cultureIsNull=false] - historyType=4.
   * @param {FName} [fields.tableId] - historyType=11.
   * @param {string} [fields.tableKey] - historyType=11.
   * @param {boolean} [fields.tableKeyIsNull=false] - historyType=11.
   * @param {Uint8Array} [fields._raw] - Verbatim bytes for unhandled `historyType` values.
   */
  constructor({
    flags = 0, historyType = -1,
    displayString, displayStringIsNull = false,
    namespace, namespaceIsNull = false,
    key, keyIsNull = false,
    sourceString, sourceStringIsNull = false,
    sourceFmt, arguments: args,
    sourceValue, formatOptions, culture, cultureIsNull = false,
    tableId, tableKey, tableKeyIsNull = false,
    _raw,
  } = {}) {
    this.flags = flags;
    this.historyType = historyType;
    if (historyType === -1) {
      this.displayString = displayString ?? null;
      this.displayStringIsNull = displayStringIsNull;
    } else if (historyType === 0) {
      this.namespace = namespace ?? '';
      this.namespaceIsNull = namespaceIsNull;
      this.key = key ?? '';
      this.keyIsNull = keyIsNull;
      this.sourceString = sourceString ?? null;
      this.sourceStringIsNull = sourceStringIsNull;
    } else if (historyType === 1) {
      this.sourceFmt = sourceFmt ?? null;
      this.arguments = args ?? [];          // [{key, keyIsNull, type, value}]
    } else if (historyType === 2) {
      this.sourceFmt = sourceFmt ?? null;
      this.arguments = args ?? [];          // [{type, value}]
    } else if (historyType === 4) {
      this.sourceValue = sourceValue ?? null;
      this.formatOptions = formatOptions ?? null;
      this.culture = culture ?? null;
      this.cultureIsNull = cultureIsNull;
    } else if (historyType === 11) {
      this.tableId = tableId ?? null;        // FName
      this.tableKey = tableKey ?? '';        // FString
      this.tableKeyIsNull = tableKeyIsNull;
    } else {
      this._raw = _raw ?? null;
    }
  }

  /**
   * Best displayable string for this FText, or null if none.
   *
   * @returns {string|null}
   */
  get text() {
    if (this.historyType === -1) return this.displayString;
    if (this.historyType === 0)  return this.sourceString ?? null;
    if (this.historyType === 1)  return this.sourceFmt?.text ?? null;
    if (this.historyType === 2)  return this.sourceFmt?.text ?? null;
    if (this.historyType === 4) {
      const v = this.sourceValue?.value;
      return v != null ? String(v) : null;
    }
    if (this.historyType === 11) return this.tableKey || null;
    return null;
  }

  /**
   * Read an FText. `sizeHint` is the byte budget when called as a top-level
   * TextProperty value or inside a finite-budget container; pass `Infinity`
   * when reading inside a self-delimiting context (array element, struct
   * field) and an unknown `historyType` cannot be captured.
   *
   * @param {Cursor} cursor
   * @param {number} sizeHint
   * @param {Object} [ctx]
   * @returns {FTextValue}
   */
  static fromReader(cursor, sizeHint, ctx) {
    const start = cursor.pos();
    const flags = cursor.readUint32();
    const historyType = cursor.readInt8();
    if (historyType === -1) {
      const bHas = cursor.readInt32();
      let displayString = null, displayStringIsNull = false;
      if (bHas) {
        const fs = cursor.readFString();
        displayString = fs.value;
        displayStringIsNull = fs.isNull;
      }
      return new FTextValue({ flags, historyType: -1, displayString, displayStringIsNull });
    }
    if (historyType === 0) {
      const nsFS = cursor.readFString();
      const kFS  = cursor.readFString();
      const ssFS = cursor.readFString();
      return new FTextValue({
        flags, historyType: 0,
        namespace:    nsFS.value, namespaceIsNull:    nsFS.isNull,
        key:          kFS.value,  keyIsNull:          kFS.isNull,
        sourceString: ssFS.value, sourceStringIsNull: ssFS.isNull,
      });
    }
    if (historyType === 1) {
      const sourceFmt = FTextValue.fromReader(cursor, Infinity, ctx);
      const numArgs = cursor.readInt32();
      const args = [];
      for (let i = 0; i < numArgs; i++) {
        const keyFS = cursor.readFString();
        const type = cursor.readInt8();
        args.push({ key: keyFS.value, keyIsNull: keyFS.isNull, type, value: _readContentValue(cursor, type, ctx) });
      }
      return new FTextValue({ flags, historyType: 1, sourceFmt, arguments: args });
    }
    if (historyType === 2) {
      const sourceFmt = FTextValue.fromReader(cursor, Infinity, ctx);
      const numArgs = cursor.readInt32();
      const args = [];
      for (let i = 0; i < numArgs; i++) {
        const type = cursor.readInt8();
        args.push({ type, value: _readContentValue(cursor, type, ctx) });
      }
      return new FTextValue({ flags, historyType: 2, sourceFmt, arguments: args });
    }
    if (historyType === 4) {
      const argType = cursor.readInt8();
      const argValue = _readContentValue(cursor, argType, ctx);
      const sourceValue = { type: argType, value: argValue };
      const bHasFormatOptions = cursor.readUint32();
      let formatOptions = null;
      if (bHasFormatOptions) {
        formatOptions = {
          alwaysSign:    cursor.readUint32(),
          useGrouping:   cursor.readUint32(),
          roundingMode:  cursor.readInt8(),
          minIntDigits:  cursor.readInt32(),
          maxIntDigits:  cursor.readInt32(),
          minFracDigits: cursor.readInt32(),
          maxFracDigits: cursor.readInt32(),
        };
      }
      const bHasCulture = cursor.readUint32();
      let culture = null, cultureIsNull = false;
      if (bHasCulture) {
        const cFS = cursor.readFString();
        culture = cFS.value;
        cultureIsNull = cFS.isNull;
      }
      return new FTextValue({ flags, historyType: 4, sourceValue, formatOptions, culture, cultureIsNull });
    }
    if (historyType === 11) {
      const tableId = FName.fromReader(cursor);
      const keyFS = cursor.readFString();
      return new FTextValue({
        flags, historyType: 11,
        tableId,
        tableKey: keyFS.value,
        tableKeyIsNull: keyFS.isNull,
      });
    }
    // Unknown historyType: capture remaining bytes for verbatim round-trip
    // when a finite size budget is available; otherwise throw so the
    // nearest finite-budget caller (TextProperty.fromReader has a try/catch
    // that falls back to OpaqueValue) can recover at the property level.
    if (!isFinite(sizeHint)) {
      throw new Error(`FText: unimplemented historyType ${historyType} with no size budget`);
    }
    warnOrThrow(ctx, `FTextValue: unimplemented historyType ${historyType} (captured remaining bytes verbatim)`);
    const remaining = sizeHint - (cursor.pos() - start);
    const raw = remaining > 0 ? cursor.readBytes(remaining).slice() : new Uint8Array(0);
    return new FTextValue({ flags, historyType, _raw: raw });
  }

  toBytes(writer) {
    writer.writeUint32(this.flags);
    writer.writeInt8(this.historyType);
    if (this.historyType === -1) {
      const has = this.displayString != null ? 1 : 0;
      writer.writeInt32(has);
      if (has) writer.writeFString(this.displayString, null, this.displayStringIsNull);
    } else if (this.historyType === 0) {
      writer.writeFString(this.namespace ?? '',    null, this.namespaceIsNull);
      writer.writeFString(this.key ?? '',          null, this.keyIsNull);
      writer.writeFString(this.sourceString ?? '', null, this.sourceStringIsNull);
    } else if (this.historyType === 1) {
      this.sourceFmt.toBytes(writer);
      writer.writeInt32(this.arguments.length);
      for (const arg of this.arguments) {
        writer.writeFString(arg.key ?? '', null, arg.keyIsNull);
        writer.writeInt8(arg.type);
        _writeContentValue(writer, arg.type, arg.value);
      }
    } else if (this.historyType === 2) {
      this.sourceFmt.toBytes(writer);
      writer.writeInt32(this.arguments.length);
      for (const arg of this.arguments) {
        writer.writeInt8(arg.type);
        _writeContentValue(writer, arg.type, arg.value);
      }
    } else if (this.historyType === 4) {
      writer.writeInt8(this.sourceValue.type);
      _writeContentValue(writer, this.sourceValue.type, this.sourceValue.value);
      // Legacy uint32 booleans.
      const hasFormatOptions = this.formatOptions != null;
      writer.writeUint32(hasFormatOptions ? 1 : 0);
      if (hasFormatOptions) {
        const f = this.formatOptions;
        writer.writeUint32(f.alwaysSign);
        writer.writeUint32(f.useGrouping);
        writer.writeInt8(f.roundingMode);
        writer.writeInt32(f.minIntDigits);
        writer.writeInt32(f.maxIntDigits);
        writer.writeInt32(f.minFracDigits);
        writer.writeInt32(f.maxFracDigits);
      }
      const hasCulture = this.culture != null;
      writer.writeUint32(hasCulture ? 1 : 0);
      if (hasCulture) writer.writeFString(this.culture, null, this.cultureIsNull);
    } else if (this.historyType === 11) {
      FName.from(this.tableId).toBytes(writer);
      writer.writeFString(this.tableKey ?? '', null, this.tableKeyIsNull);
    } else {
      if (this._raw) writer.writeBytes(this._raw);
    }
  }

  toJSON() {
    const j = { flags: this.flags, historyType: this.historyType };
    if (this.historyType === -1) {
      if (this.displayString != null) {
        j.displayString = this.displayString;
        if (this.displayStringIsNull) j.displayStringIsNull = true;
      } else {
        j.displayString = null;
      }
    } else if (this.historyType === 0) {
      j.namespace = this.namespace; if (this.namespaceIsNull) j.namespaceIsNull = true;
      j.key = this.key;             if (this.keyIsNull) j.keyIsNull = true;
      if (this.sourceString != null) {
        j.sourceString = this.sourceString;
        if (this.sourceStringIsNull) j.sourceStringIsNull = true;
      } else {
        j.sourceString = null;
      }
    } else if (this.historyType === 1) {
      j.sourceFmt = this.sourceFmt.toJSON();
      j.arguments = this.arguments.map(a => _namedArgToJSON(a));
    } else if (this.historyType === 2) {
      j.sourceFmt = this.sourceFmt.toJSON();
      j.arguments = this.arguments.map(a => _argToJSON(a));
    } else if (this.historyType === 4) {
      j.sourceValue = _argToJSON(this.sourceValue);
      j.formatOptions = this.formatOptions;
      if (this.culture != null) {
        j.culture = this.culture;
        if (this.cultureIsNull) j.cultureIsNull = true;
      } else {
        j.culture = null;
      }
    } else if (this.historyType === 11) {
      j.tableId = this.tableId instanceof FName ? this.tableId.toJSON() : this.tableId;
      j.tableKey = this.tableKey;
      if (this.tableKeyIsNull) j.tableKeyIsNull = true;
    } else {
      j._raw = this._raw ? b64encode(this._raw) : null;
    }
    return j;
  }

  static fromJSON(j) {
    const ht = j.historyType;
    if (ht === -1) {
      return new FTextValue({
        flags: j.flags, historyType: -1,
        displayString: j.displayString ?? null,
        displayStringIsNull: !!j.displayStringIsNull,
      });
    }
    if (ht === 0) {
      return new FTextValue({
        flags: j.flags, historyType: 0,
        namespace: j.namespace ?? '',       namespaceIsNull: !!j.namespaceIsNull,
        key: j.key ?? '',                   keyIsNull: !!j.keyIsNull,
        sourceString: j.sourceString ?? null, sourceStringIsNull: !!j.sourceStringIsNull,
      });
    }
    if (ht === 1) {
      return new FTextValue({
        flags: j.flags, historyType: 1,
        sourceFmt: FTextValue.fromJSON(j.sourceFmt),
        arguments: j.arguments.map(a => _namedArgFromJSON(a)),
      });
    }
    if (ht === 2) {
      return new FTextValue({
        flags: j.flags, historyType: 2,
        sourceFmt: FTextValue.fromJSON(j.sourceFmt),
        arguments: j.arguments.map(a => _argFromJSON(a)),
      });
    }
    if (ht === 4) {
      return new FTextValue({
        flags: j.flags, historyType: 4,
        sourceValue: _argFromJSON(j.sourceValue),
        formatOptions: j.formatOptions ?? null,
        culture: j.culture ?? null,
        cultureIsNull: !!j.cultureIsNull,
      });
    }
    if (ht === 11) {
      return new FTextValue({
        flags: j.flags, historyType: 11,
        tableId: FName.from(j.tableId),
        tableKey: j.tableKey ?? '',
        tableKeyIsNull: !!j.tableKeyIsNull,
      });
    }
    return new FTextValue({
      flags: j.flags, historyType: ht,
      _raw: j._raw ? b64decode(j._raw) : null,
    });
  }
}

/**
 * Property wrapping an `FTextValue`. When a decode failure occurs in
 * non-strict mode, `value` is an `OpaqueValue` instead so the surrounding
 * stream stays aligned.
 */
export class TextProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {FTextValue|OpaqueValue|null} [fields.value=null]
   */
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;
  }

  static fromReader(cursor, tag, sizeHint, ctx) {
    const start = cursor.pos();
    try {
      const v = FTextValue.fromReader(cursor, sizeHint, ctx);
      return new TextProperty({ tag, value: v });
    } catch (e) {
      cursor.seek(start);
      warnOrThrow(ctx, `TextProperty['${tag.name.value}']: decode failed: ${e.message}`);
      return new TextProperty({ tag, value: OpaqueValue.fromReader(cursor, sizeHint, `TextProperty decode failed: ${e.message}`) });
    }
  }

  _writeValue(w) { this.value.toBytes(w); }

  _writeJSON(j) { j.value = this.value.toJSON(); }

  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    const v = OpaqueValue.isOpaqueJSON(j.value)
      ? OpaqueValue.fromJSON(j.value)
      : FTextValue.fromJSON(j.value);
    return new TextProperty({ tag, value: v });
  }
}

registerProperty('TextProperty', TextProperty);

// ── helpers ─────────────────────────────────────────────────────────────────
function _readContentValue(cursor, type, ctx) {
  switch (type) {
    case 0: return cursor.readInt64().toString();
    case 1: return cursor.readUint64().toString();
    case 2: return cursor.readFloat32();
    case 3: return cursor.readFloat64();
    case 4: return FTextValue.fromReader(cursor, Infinity, ctx);
    case 5: return cursor.readInt8();
    default: throw new Error(`FText: unknown ContentType ${type}`);
  }
}

function _writeContentValue(writer, type, value) {
  switch (type) {
    case 0: writer.writeInt64(value);   return;
    case 1: writer.writeUint64(value);  return;
    case 2: writer.writeFloat32(value); return;
    case 3: writer.writeFloat64(value); return;
    case 4: value.toBytes(writer);      return;
    case 5: writer.writeInt8(value);    return;
    default: throw new Error(`FText: unknown ContentType ${type}`);
  }
}

function _argToJSON(a) {
  if (a.type === 4) return { type: 4, value: a.value.toJSON() };
  return { type: a.type, value: a.value };
}
function _argFromJSON(a) {
  if (a.type === 4) return { type: 4, value: FTextValue.fromJSON(a.value) };
  return { type: a.type, value: a.value };
}
function _namedArgToJSON(a) {
  const j = { key: a.key };
  if (a.keyIsNull) j.keyIsNull = true;
  j.type = a.type;
  j.value = a.type === 4 ? a.value.toJSON() : a.value;
  return j;
}
function _namedArgFromJSON(a) {
  return {
    key: a.key,
    keyIsNull: !!a.keyIsNull,
    type: a.type,
    value: a.type === 4 ? FTextValue.fromJSON(a.value) : a.value,
  };
}
