# wscodec/properties/delegate

Source: [`src/properties/delegate.mjs`](../src/properties/delegate.mjs)

<a name="module_wscodec/properties/delegate"></a>

## wscodec/properties/delegate
Delegate / MulticastDelegate property family.Wire format (per UE source):  [int32 NumDelegates]  For each: [UObject ref] [FName FunctionName]The UObject-ref encoding inside a delegate is archive-dependent and wedon't have ground-truth Soulmask data to verify it. We preserve thebytes verbatim, sharing `OpaqueProperty`'s byte-carrying machinery.Subclasses keep type names distinct for `tag.type` round-trip throughthe registry; only `fromReader` differs (a more specific warn messagethan `OpaqueProperty`'s "unknown type" path).


* [wscodec/properties/delegate](#module_wscodec/properties/delegate)
    * [.DelegateProperty](#module_wscodec/properties/delegate.DelegateProperty)
        * [.fromReader(cursor, tag, sizeHint, [ctx])](#module_wscodec/properties/delegate.DelegateProperty.fromReader) ⇒ <code>DelegateProperty</code>
    * [.MulticastDelegateProperty](#module_wscodec/properties/delegate.MulticastDelegateProperty)
    * [.MulticastInlineDelegateProperty](#module_wscodec/properties/delegate.MulticastInlineDelegateProperty)
    * [.MulticastSparseDelegateProperty](#module_wscodec/properties/delegate.MulticastSparseDelegateProperty)

<a name="module_wscodec/properties/delegate.DelegateProperty"></a>

### wscodec/properties/delegate.DelegateProperty
Base class for delegate-family properties. Captures the value bytesverbatim (no structured decode) and surfaces a warn/throw via`warnOrThrow`.

**Kind**: static class of [<code>wscodec/properties/delegate</code>](#module_wscodec/properties/delegate)  
<a name="module_wscodec/properties/delegate.DelegateProperty.fromReader"></a>

#### DelegateProperty.fromReader(cursor, tag, sizeHint, [ctx]) ⇒ <code>DelegateProperty</code>
**Kind**: static method of [<code>DelegateProperty</code>](#module_wscodec/properties/delegate.DelegateProperty)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 
| tag | <code>PropertyTag</code> | 
| sizeHint | <code>number</code> | 
| [ctx] | <code>Object</code> | 

<a name="module_wscodec/properties/delegate.MulticastDelegateProperty"></a>

### wscodec/properties/delegate.MulticastDelegateProperty
Multicast delegate. Same byte-preserving behavior as `DelegateProperty`.

**Kind**: static class of [<code>wscodec/properties/delegate</code>](#module_wscodec/properties/delegate)  
<a name="module_wscodec/properties/delegate.MulticastInlineDelegateProperty"></a>

### wscodec/properties/delegate.MulticastInlineDelegateProperty
Inline multicast delegate. Same byte-preserving behavior as `DelegateProperty`.

**Kind**: static class of [<code>wscodec/properties/delegate</code>](#module_wscodec/properties/delegate)  
<a name="module_wscodec/properties/delegate.MulticastSparseDelegateProperty"></a>

### wscodec/properties/delegate.MulticastSparseDelegateProperty
Sparse multicast delegate. Same byte-preserving behavior as `DelegateProperty`.

**Kind**: static class of [<code>wscodec/properties/delegate</code>](#module_wscodec/properties/delegate)
