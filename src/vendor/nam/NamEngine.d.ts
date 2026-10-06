/**
 * NamEngine: main-thread API for the NAM wasm engine.
 *
 * One engine per AudioContext. The engine registers the worklet module and
 * fetches the wasm binary once; every NamNode created from it shares the
 * single wasm module instantiated inside the AudioWorkletGlobalScope.
 * No SharedArrayBuffer, no cross-origin isolation requirement, one small
 * growable heap.
 */
import { NamModelInfo, NamWorkletRequest } from './protocol';
export type { NamModelInfo } from './protocol';
export interface NamEngineAssets {
    /**
     * Base URL for the engine assets (nam-worklet.js, nam-engine.wasm), e.g.
     * '/nam/'. When omitted, assets are resolved relative to this module's URL
     * (works out of the box with bundlers that support
     * `new URL(..., import.meta.url)` asset handling, e.g. webpack 5 / Vite).
     */
    assetBaseUrl?: string | URL;
}
export interface NamLoadOptions {
    /**
     * Raw NAM-core slimmable size in [0.0, 1.0], applied when the model is
     * slimmable (e.g. A2 models). NAM core selects the first submodel whose
     * max_value is greater than this value: with submodel thresholds
     * [0.5, 1.0], any value below 0.5 selects the smaller submodel and values
     * from 0.5 up select the full one. Omit for the full model. Non-slimmable
     * models ignore it.
     */
    slimSize?: number;
}
declare const AudioWorkletNodeBase: typeof AudioWorkletNode;
/**
 * An AudioWorkletNode running one NAM instance (mono in, mono out).
 * Connect it into a Web Audio graph like any other node.
 */
export declare class NamNode extends AudioWorkletNodeBase {
    private pending;
    private disposed;
    /** @internal Use NamEngine.createNode(). */
    constructor(context: BaseAudioContext);
    /** @internal */
    request(message: NamWorkletRequest, transfer?: Transferable[]): Promise<NamModelInfo | undefined>;
    /**
     * Load a model from the contents of a .nam file, replacing any current
     * model. The model is parsed on the audio thread; rendering through this
     * node pauses for the duration (typically 100-300 ms) and fades back in
     * click-free.
     */
    loadModel(json: string, options?: NamLoadOptions): Promise<NamModelInfo>;
    /** Unload the model; the node passes audio through unchanged. */
    unloadModel(): Promise<void>;
    /**
     * Re-slim the loaded model without reparsing (slimmable models only).
     * @param slimSize Raw NAM-core slimmable size in [0.0, 1.0].
     */
    setSlimSize(slimSize: number): Promise<void>;
    /**
     * Destroy the node's wasm instance, disconnect it from the graph, and stop
     * its processor. The node cannot be used afterwards.
     */
    dispose(): Promise<void>;
}
/**
 * Loads the NAM wasm engine into an AudioContext and creates NamNodes.
 */
export declare class NamEngine {
    readonly context: BaseAudioContext;
    private readonly wasmBytes;
    private constructor();
    /**
     * Attach the engine to an AudioContext: registers the worklet module and
     * fetches the wasm binary (both once per context; repeated calls return
     * the same engine).
     */
    static attach(context: BaseAudioContext, assets?: NamEngineAssets): Promise<NamEngine>;
    /**
     * Create a NamNode ready for model loading. The first node instantiates
     * the wasm module inside the worklet scope; later nodes share it.
     */
    createNode(): Promise<NamNode>;
}
/**
 * A small LRU pool of NamNodes keyed by an arbitrary id (e.g. a player id).
 *
 * Mounting a UI player costs nothing; a node is only created when it first
 * plays. Re-acquiring an existing key reuses its node (with its model still
 * loaded, for instant replay); acquiring a new key when the pool is full
 * evicts and disposes the least-recently-used node.
 */
export declare class NamNodePool {
    private readonly engine;
    private readonly maxNodes;
    private readonly onEvict?;
    private entries;
    /**
     * @param engine Engine to create nodes from.
     * @param maxNodes Maximum simultaneous nodes (default 1).
     * @param onEvict Called just before an evicted node is disposed, so callers
     *                can disconnect it from their graph.
     */
    constructor(engine: NamEngine, maxNodes?: number, onEvict?: ((node: NamNode, key: string) => void) | undefined);
    /** Acquire (create or reuse) the node for a key, evicting LRU if needed. */
    acquire(key: string): Promise<NamNode>;
    /** Dispose one node by key. */
    release(key: string): Promise<void>;
    /** Dispose all nodes. */
    disposeAll(): Promise<void>;
}
