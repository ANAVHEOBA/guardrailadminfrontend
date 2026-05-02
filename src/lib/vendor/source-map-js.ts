import sourceMapJsModule from "../../../node_modules/.pnpm/node_modules/source-map-js/source-map.js";

type SourceMapJsModule = {
  SourceMapConsumer: typeof import("../../../node_modules/.pnpm/node_modules/source-map-js/lib/source-map-consumer.js").SourceMapConsumer;
  SourceMapGenerator: unknown;
  SourceNode: unknown;
};

export type RawSourceMap = Record<string, unknown>;

const sourceMapJs = sourceMapJsModule as SourceMapJsModule;

export const SourceMapConsumer = sourceMapJs.SourceMapConsumer;
export const SourceMapGenerator = sourceMapJs.SourceMapGenerator;
export const SourceNode = sourceMapJs.SourceNode;

export default sourceMapJs;
