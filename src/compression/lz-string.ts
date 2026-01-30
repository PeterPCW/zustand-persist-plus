/**
 * LZ-String compression for zustand persistence
 */

import LZString from 'lz-string'
import type { CompressionOptions } from '../types/index.js'

/**
 * Default compression configuration
 */
const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  algorithm: 'lz-string',
  minSize: 1024,
  level: 6
}

/**
 * Compress a string using LZ-String
 */
export function compress(
  data: string,
  _options: CompressionOptions = {}
): string {
  return LZString.compressToUTF16(data)
}

/**
 * Decompress a string using LZ-String
 */
export function decompress(
  compressedData: string,
  _options: CompressionOptions = {}
): string {
  const decompressed = LZString.decompressFromUTF16(compressedData)
  
  if (decompressed === null) {
    throw new Error('Failed to decompress data')
  }
  
  return decompressed
}

/**
 * Compress and encode for storage (base64-safe)
 */
export function compressToBase64(
  data: string,
  _options: CompressionOptions = {}
): string {
  return LZString.compressToEncodedURIComponent(data)
}

/**
 * Decompress from base64-safe string
 */
export function decompressFromBase64(
  compressedData: string,
  _options: CompressionOptions = {}
): string {
  const decompressed = LZString.decompressFromEncodedURIComponent(compressedData)
  
  if (decompressed === null) {
    throw new Error('Failed to decompress data')
  }
  
  return decompressed
}

/**
 * Compress an object (JSON -> compress)
 */
export function compressObject<T>(
  obj: T,
  options: CompressionOptions = {}
): string {
  const jsonString = JSON.stringify(obj)
  return compress(jsonString, options)
}

/**
 * Decompress to an object (decompress -> JSON -> object)
 */
export function decompressObject<T>(
  compressedData: string,
  options: CompressionOptions = {}
): T {
  const jsonString = decompress(compressedData, options)
  return JSON.parse(jsonString)
}

/**
 * Check if compression would be beneficial
 */
export function shouldCompress(
  data: string,
  minSize: number = 1024
): boolean {
  return data.length >= minSize
}

/**
 * Create middleware options for compression
 */
export function withCompression(
  options: Partial<CompressionOptions> = {}
): CompressionOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options
  }
}

/**
 * Compress if beneficial, otherwise return original
 */
export function smartCompress(
  data: string,
  options: CompressionOptions = {}
): string {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  if (!shouldCompress(data, config.minSize)) {
    return data
  }
  
  const compressed = compress(data, config)
  
  // Only use compression if it actually reduces size
  if (compressed.length < data.length) {
    return compressed
  }
  
  return data
}

/**
 * Decompress if the data appears to be compressed
 */
export function smartDecompress(
  data: string,
  options: CompressionOptions = {}
): string {
  // Check if data appears compressed (LZ-String compressed data has specific patterns)
  const isCompressed = (
    data.includes('\x1f\x8b') || // gzip magic number
    (data.length > 20 && /[\x00-\x1f]/.test(data)) // Binary-like content
  ) || data.length < 100 // Short compressed strings might not decompress well

  // Only attempt decompression if data appears compressed
  if (!isCompressed) {
    return data
  }

  try {
    // Try to decompress, if it fails return original
    const decompressed = decompress(data, options)
    return decompressed
  } catch {
    return data
  }
}
