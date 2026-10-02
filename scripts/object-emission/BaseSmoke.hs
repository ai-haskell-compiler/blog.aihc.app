module Main where

import Data.Char (toUpper)
import Data.List (sort)

main :: IO ()
main = do
  print (sum (map (\x -> x * x) [1 .. 100] :: [Int]))
  print (sort [8, 1, 5, 3, 2 :: Int])
  print ((2 ^ (100 :: Int)) :: Integer)
  print (1.25 + 2.5 :: Double)
  print (map toUpper "aihc base")
