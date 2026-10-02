{-# LANGUAGE ImportQualifiedPost #-}

-- Parsing and instruction selection are outside the measured interval.
import Aihc.Arm64.Assemble qualified as Arm
import Aihc.Arm64.Lir qualified as Arm
import Aihc.Arm64.Text qualified as Arm
import Aihc.Amd64.Assemble qualified as X86
import Aihc.Amd64.Lir qualified as X86
import Aihc.Amd64.Text qualified as X86
import Aihc.Lir.Parser (parseModule, renderParseError)
import Control.Exception (evaluate)
import Data.ByteString.Lazy qualified as BL
import Data.Text qualified as T
import Data.Text.IO qualified as TIO
import GHC.Clock (getMonotonicTimeNSec)
import System.Environment (getArgs)
import System.Mem (performGC)
import System.Process (callProcess)

checked :: Show e => Either e a -> IO a
checked = either (fail . show) pure

-- Keep the preflight traversal separate from the timed printer.
-- NOINLINE prevents reuse of its rendered text in the measured action.
{-# NOINLINE forceX86 #-}
forceX86 :: [X86.Amd64Statement] -> Int
forceX86 = T.length . X86.renderAmd64Statements

{-# NOINLINE forceArm #-}
forceArm :: [Arm.Arm64Statement] -> Int
forceArm = T.length . Arm.renderArm64Statements

measure :: String -> FilePath -> FilePath -> IO () -> IO () -> IO ()
measure target mode output direct text = do
  performGC
  start <- getMonotonicTimeNSec
  if mode == "direct" then direct else text
  printed <- getMonotonicTimeNSec
  if mode == "direct" then pure () else
    callProcess "clang" ["-target", target, "-c", "-x", "assembler", output ++ ".s", "-o", output]
  end <- getMonotonicTimeNSec
  bytes <- BL.length <$> BL.readFile output
  putStrLn $ show (fromIntegral (printed - start) / 1e6 :: Double) ++ " " ++
    show (fromIntegral (end - printed) / 1e6 :: Double) ++ " " ++ show bytes

main :: IO ()
main = do
  [target, mode, input, output] <- getArgs
  source <- TIO.readFile input
  lir <- either (fail . renderParseError) pure (parseModule source)
  if target == "arm64-apple-macos" then do
    statements <- checked (Arm.compileLirStatements lir)
    _ <- evaluate (forceArm statements)
    measure target mode output
      (checked (Arm.assembleMachO statements) >>= BL.writeFile output)
      (TIO.writeFile (output ++ ".s") (Arm.renderArm64Statements statements))
  else do
    statements <- checked (X86.compileLirStatements lir)
    _ <- evaluate (forceX86 statements)
    measure target mode output
      (checked (X86.assembleElf statements) >>= BL.writeFile output)
      (TIO.writeFile (output ++ ".s") (T.pack ".intel_syntax noprefix\n" <> X86.renderAmd64Statements statements))
