"""Give the pinned AMD64 fixture printer explicit operand widths for Clang."""
import sys
from pathlib import Path
source, destination = map(Path, sys.argv[1:])
text = source.read_text()
for constructor, mnemonic, bits in [('AmdMovsxd','movsxd',32),('AmdMovsxByte','movsx',8),('AmdMovsxWord','movsx',16),('AmdMovzx','movzx',8),('AmdMovzxWord','movzx',16)]:
    old=f'{constructor} destination source -> two "{mnemonic}" destination source'
    assert old in text
    text=text.replace(old,f'{constructor} destination source -> "{mnemonic} " <> reg destination <> ", " <> sizedRm {bits} source')
text=text.replace('Amd64RmMemory place -> memory place','Amd64RmMemory place -> "qword ptr " <> memory place')
text=text.replace('"mov " <> memory destination <> ", " <> storeSource source','"mov " <> (case source of Amd64StoreImmediate _ -> "qword ptr " <> memory destination; _ -> memory destination) <> ", " <> storeSource source')
for name,bits in [('Byte',8),('Word',16)]:
    text=text.replace(f'AmdStore{name} destination source -> "mov " <> memory destination <> ", " <> reg source',f'AmdStore{name} destination source -> "mov " <> memory destination <> ", " <> sizedReg {bits} source')
text=text.replace('"set" <> cond condition <> " " <> rm destination','"set" <> cond condition <> " " <> sizedRm 8 destination')
text=text.replace('"movd " <> xmm destination <> ", " <> reg source','"movd " <> xmm destination <> ", " <> sizedReg 32 source')
text=text.replace('"movd " <> reg destination <> ", " <> xmm source','"movd " <> sizedReg 32 destination <> ", " <> xmm source')
text+='''
sizedRm :: Int -> Amd64Rm -> String
sizedRm bits operand = case operand of
  Amd64RmRegister register -> sizedReg bits register
  Amd64RmMemory place -> (case bits of 8 -> "byte"; 16 -> "word"; 32 -> "dword"; _ -> "qword") <> " ptr " <> memory place

sizedReg :: Int -> Amd64Register -> String
sizedReg bits register = case lookup register registerNames of
  Just names -> case bits of 8 -> names !! 0; 16 -> names !! 1; 32 -> names !! 2; _ -> names !! 3
  Nothing -> error "Unknown AMD64 register"
  where
    registerNames =
'''
wide=['RAX','RCX','RDX','RBX','RSP','RBP','RSI','RDI']+[f'R{i}' for i in range(8,16)]
dword=['EAX','ECX','EDX','EBX','ESP','EBP','ESI','EDI']+[f'R{i}D' for i in range(8,16)]
byte=['AL','CL','DL','BL','SPL','BPL','SIL','DIL']+[f'R{i}B' for i in range(8,16)]
word=['ax','cx','dx','bx','sp','bp','si','di']+[f'r{i}w' for i in range(8,16)]
entries=[]
for a,b,c,d in zip(wide,dword,byte,word):
    names='['+', '.join('"'+v+'"' for v in [c.lower(),d,b.lower(),a.lower()])+']'
    entries += [f'({v}, {names})' for v in (a,b,c)]
text+='      [ '+ '\n      , '.join(entries)+'\n      ]\n'
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(text)
