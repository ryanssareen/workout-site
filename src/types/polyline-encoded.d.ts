declare module 'polyline-encoded' {
  function decode(encoded: string): number[][];
  function encode(coordinates: number[][]): string;
  export { decode, encode };
  export default { decode, encode };
}
