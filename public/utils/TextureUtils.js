// Stub for GLTFExporter's KTX2 decompress import.
// This demo uses only uncompressed MeshStandardMaterial textures, so decompress is a no-op.
// Real three.js TextureUtils.js would perform Basis/KTX2 GPU decompression; not needed here.
export function decompress(texture) {
  return texture;
}
