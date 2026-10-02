"""Adapt the pinned fixture printer for valid, comparable Mach-O assembly."""
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:])
text = source.read_text()
old_to = '"fmov " <> float\' wide float <> ", " <> reg general'
new_to = '"fmov " <> float\' wide float <> ", " <> reg (if wide then general else wordName general)'
old_from = '"fmov " <> reg general <> ", " <> float\' wide float'
new_from = '"fmov " <> reg (if wide then general else wordName general) <> ", " <> float\' wide float'
assert old_to in text and old_from in text, 'Use the pinned c24d8798 AIHC source'
text = text.replace(old_to, new_to).replace(old_from, new_from)
destination.parent.mkdir(parents=True, exist_ok=True)
# Expand constant loads with the same shortest sequence as the object encoder.
# The fixture printer's LDR pseudo-instruction can create extra literal pools.
old_ldr = '"ldr " <> reg register <> ", =" <> hex literal'
assert old_ldr in text
text = text.replace(old_ldr, 'immediateText register literal')
old_mov = 'ArmMov destination source -> "mov " <> reg destination <> ", " <> valueText source'
assert old_mov in text
text = text.replace(old_mov, '''ArmMov destination source -> case source of
      Arm64ImmediateValue literal -> immediateText destination literal
      _ -> "mov " <> reg destination <> ", " <> valueText source''')
text = text.replace('import Data.List (intercalate)', 'import Data.List (intercalate, minimumBy)\nimport Data.Ord (comparing)')
text += '''
-- Match the encoder's shortest constant-load sequence and its tie order.
immediateText :: Arm64Register -> Integer -> String
immediateText register value = intercalate "\\n\\t" (minimumBy (comparing length) candidates)
  where
    width = if register >= W0 && register <= W30 || register == WZR then 32 else 64
    bits = value `mod` (2 ^ width)
    fields = [(shift, (bits `div` (2 ^ shift)) `mod` 65536) | shift <- [0, 16 .. width - 16]]
    wide mnemonic immediate shift = mnemonic <> " " <> reg register <> ", #" <> show immediate
      <> if shift == 0 then "" else ", lsl #" <> show shift
    sequenceFor mnemonic filler firstField = case filter ((/= filler) . snd) fields of
      [] -> [wide mnemonic (firstField filler) 0]
      (shift, field) : rest -> wide mnemonic (firstField field) shift
        : [wide "movk" part position | (position, part) <- rest]
    candidates = [sequenceFor "movz" 0 id, sequenceFor "movn" 65535 (65535 -)]
      <> [["orr " <> reg register <> ", " <> (if width == 32 then "wzr" else "xzr") <> ", #" <> hex bits]
         | Just _ <- [logicalImmediate width value]]
'''
# Relocatable pointer data belongs in __DATA, not the read-only __TEXT segment.
old_section = 'ReadOnlySection -> indent ".section __TEXT,__const"'
assert old_section in text
text = text.replace(old_section, 'ReadOnlySection -> indent ".section __DATA,__const"')
# Only numbered branch labels are temporary. Named data symbols can be GOT targets.
text = text.replace('nameText symbol', 'assemblyName symbol').replace('nameText target', 'assemblyName target')
text += '\nassemblyName :: Name -> Text\nassemblyName name = case name of\n  LocalName _ value | T.isPrefixOf ".L" value -> T.drop 1 value\n  _ -> nameText name\n'
destination.write_text(text)
