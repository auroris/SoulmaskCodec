[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / peekLooksLikePropertyTag

# Function: peekLooksLikePropertyTag()

> **peekLooksLikePropertyTag**(`cursor`): `boolean`

Defined in: [property-stream.mjs:138](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property-stream.mjs#L138)

Peek the next bytes of `cursor` (without advancing): do they look like
the start of a PropertyTag (an FString that names a property)?

Used inside Map<_,Struct> entry values where the wire shape is ambiguous —
the same 4 bytes could be the SaveNum of a property-name FString or the
first uint32 of an FGuid. A property name FString is:
  - int32 SaveNum > 0 and reasonably small (≤ 64 chars in Soulmask)
  - SaveNum bytes of ANSI body whose last byte is NUL
  - body chars (minus NUL) are identifier-safe: A-Z, a-z, 0-9, _

Random GUID bytes effectively never satisfy this: the first uint32 is
~uniform over [0, 2^32), and even when it lands in a plausible-length
range the printable-ASCII + NUL-terminator check eliminates the false
positives.

Limitation: only matches ANSI property names (SaveNum > 0). Every
Soulmask property name observed in world.db is ASCII; UTF-16 property
names inside Map<_,Struct> would need an additional branch.

## Parameters

### cursor

[`Cursor`](../../io/classes/Cursor.md)

## Returns

`boolean`
