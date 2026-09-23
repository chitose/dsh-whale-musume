"""Japanese phoneme normalization shared in spirit with the offline voice pack."""

FIXES = (("ᶄ", "ky"), ("ᶃ", "gy"), ("ᶀ", "by"), ("ᶁ", "dy"), ("ᶆ", "my"),
         ("ᶈ", "py"), ("ᶉ", "ry"), ("ƫ", "ty"), ("K", "kw"), ("G", "gw"), ("g", "ɡ"))


def phonemize_japanese(text, g2p):
    try:
        _raw, tokens = g2p(text)
    except AssertionError:
        import pyopenjtalk
        _raw, tokens = g2p(pyopenjtalk.g2p(text, kana=True))
    phonemes = "".join((token.phonemes or "") + (token.whitespace or "") for token in tokens or [])
    for old, new in FIXES:
        phonemes = phonemes.replace(old, new)
    return phonemes
