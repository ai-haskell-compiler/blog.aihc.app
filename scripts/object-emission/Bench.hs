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
import Control.Monad (forM)
import Data.ByteString qualified as BS
import Data.ByteString.Lazy qualified as BL
import Data.Text qualified as T
import Data.Text.IO qualified as TIO
import GHC.Clock (getMonotonicTimeNSec)
import System.Environment (getArgs)
import System.Directory (createDirectoryIfMissing, doesDirectoryExist, listDirectory)
import System.FilePath ((</>), takeDirectory, takeExtension)
import Data.List (sort)
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

main :: IO ()
main = do
  [target, mode, input, output] <- getArgs
  directory <- doesDirectoryExist input
  inputs <- if directory then files input else pure [input]
  results <- forM (zip [0 :: Int ..] inputs) $ \(index, path) -> do
    source <- TIO.readFile path
    let object = if directory then output </> show index ++ ".o" else output
    createDirectoryIfMissing True (takeDirectory object)
    if T.null (T.strip source) then do
      start <- getMonotonicTimeNSec
      BS.writeFile object BS.empty
      end <- getMonotonicTimeNSec
      pure (end - start, 0, 0)
    else do
      lir <- either (fail . renderParseError) pure (parseModule source)
      (direct, text) <- if target == "arm64-apple-macos" then do
        statements <- checked (Arm.compileLirStatements lir)
        _ <- evaluate (forceArm statements)
        pure (checked (Arm.assembleMachO statements) >>= BL.writeFile object,
              TIO.writeFile (object ++ ".s") (Arm.renderArm64Statements statements))
      else do
        statements <- checked (X86.compileLirStatements lir)
        _ <- evaluate (forceX86 statements)
        pure (checked (X86.assembleElf statements) >>= BL.writeFile object,
              TIO.writeFile (object ++ ".s") (T.pack ".intel_syntax noprefix\n" <> X86.renderAmd64Statements statements))
      performGC
      start <- getMonotonicTimeNSec
      if mode == "direct" then direct else text
      printed <- getMonotonicTimeNSec
      if mode == "direct" then pure () else
        callProcess "clang" ["-target", target, "-c", "-x", "assembler", object ++ ".s", "-o", object]
      end <- getMonotonicTimeNSec
      size <- BL.length <$> BL.readFile object
      pure (printed - start, end - printed, size)
  let emit = sum [value | (value, _, _) <- results]
      assembler = sum [value | (_, value, _) <- results]
      bytes = sum [value | (_, _, value) <- results]
  putStrLn $ show (fromIntegral emit / 1e6 :: Double) ++ " " ++
    show (fromIntegral assembler / 1e6 :: Double) ++ " " ++ show bytes

files :: FilePath -> IO [FilePath]
files directory = do
  names <- sort <$> listDirectory directory
  paths <- forM names $ \name -> do
    let path = directory </> name
    nested <- doesDirectoryExist path
    if nested then files path else pure [path | takeExtension path == ".lir"]
  pure (concat paths)
