async function createNamEngine(moduleArg={}){var Module=moduleArg;var ENVIRONMENT_IS_WEB=!!globalThis.window;var ENVIRONMENT_IS_WORKER=!!globalThis.WorkerGlobalScope;var ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer";if(ENVIRONMENT_IS_NODE){const{createRequire}=await import('node:module');var require=createRequire(import.meta.url);}var thisProgram="./this.program";var _scriptName=import.meta.url;var scriptDirectory="";function locateFile(path){if(Module["locateFile"]){return Module["locateFile"](path,scriptDirectory)}return scriptDirectory+path}var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){var fs=require("node:fs");if(_scriptName.startsWith("file:")){scriptDirectory=require("node:path").dirname(require("node:url").fileURLToPath(_scriptName))+"/";}readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename);return ret};readAsync=async(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename,binary?undefined:"utf8");return ret};if(process.argv.length>1){thisProgram=process.argv[1].replace(/\\/g,"/");}process.argv.slice(2);}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){try{scriptDirectory=new URL(".",_scriptName).href;}catch{}{if(ENVIRONMENT_IS_WORKER){readBinary=url=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)};}readAsync=async url=>{var response=await fetch(url,{credentials:"same-origin"});if(response.ok){return response.arrayBuffer()}throw new Error(response.status+" : "+response.url)};}}else;var out=console.log.bind(console);var err=console.error.bind(console);var wasmBinary;var ABORT=false;var isFileURI=filename=>filename.startsWith("file://");var runtimeInitialized=false;function getMemoryBuffer(){return wasmMemory.buffer}function updateMemoryViews(){if(HEAP8?.buffer?.resizable)return;var b=getMemoryBuffer();HEAP8=new Int8Array(b);Module["HEAPU8"]=HEAPU8=new Uint8Array(b);HEAPU32=new Uint32Array(b);Module["HEAPF32"]=new Float32Array(b);}function initRuntime(){runtimeInitialized=true;wasmExports["j"]();}function abort(what){what=`Aborted(${what})`;err(what);ABORT=true;what+=". Build with -sASSERTIONS for more info.";if(runtimeInitialized){___trap();}var e=new WebAssembly.RuntimeError(what);throw e}var wasmBinaryFile;function findWasmBinary(){if(Module["locateFile"]){return locateFile("nam-engine.wasm")}return new URL("nam-engine.wasm",import.meta.url).href}function getBinarySync(file){if(file==wasmBinaryFile&&wasmBinary){return new Uint8Array(wasmBinary)}if(readBinary){return readBinary(file)}throw "both async and sync fetching of the wasm failed"}async function getWasmBinary(binaryFile){if(!wasmBinary){try{var response=await readAsync(binaryFile);return new Uint8Array(response)}catch{}}return getBinarySync(binaryFile)}async function instantiateArrayBuffer(binaryFile,imports){try{var binary=await getWasmBinary(binaryFile);var instance=await WebAssembly.instantiate(binary,imports);return instance}catch(reason){err(`failed to asynchronously prepare wasm: ${reason}`);abort(reason);}}async function instantiateAsync(binary,binaryFile,imports){if(!binary&&!ENVIRONMENT_IS_NODE){try{var response=fetch(binaryFile,{credentials:"same-origin"});var instantiationResult=await WebAssembly.instantiateStreaming(response,imports);return instantiationResult}catch(reason){err(`wasm streaming compile failed: ${reason}`);err("falling back to ArrayBuffer instantiation");}}return instantiateArrayBuffer(binaryFile,imports)}function getWasmImports(){var imports={a:wasmImports};return imports}async function createWasm(){function receiveInstance(instance){wasmExports=instance.exports;assignWasmExports(wasmExports);updateMemoryViews();return wasmExports}function receiveInstantiationResult(result){return receiveInstance(result["instance"])}var info=getWasmImports();var instantiateWasm=Module["instantiateWasm"];if(instantiateWasm){return new Promise(resolve=>{instantiateWasm(info,inst=>resolve(receiveInstance(inst)));})}wasmBinaryFile??=findWasmBinary();var result=await instantiateAsync(wasmBinary,wasmBinaryFile,info);var exports=receiveInstantiationResult(result);return exports}var HEAP8;var __abort_js=()=>abort("");var stringToUTF8Array=(str,heap,outIdx,maxBytesToWrite)=>{if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.codePointAt(i);if(u<=127){if(outIdx>=endIdx)break;heap[outIdx++]=u;}else if(u<=2047){if(outIdx+1>=endIdx)break;heap[outIdx++]=192|u>>6;heap[outIdx++]=128|u&63;}else if(u<=65535){if(outIdx+2>=endIdx)break;heap[outIdx++]=224|u>>12;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63;}else {if(outIdx+3>=endIdx)break;heap[outIdx++]=240|u>>18;heap[outIdx++]=128|u>>12&63;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63;i++;}}heap[outIdx]=0;return outIdx-startIdx};var HEAPU8;var stringToUTF8=(str,outPtr,maxBytesToWrite)=>stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite);var HEAPU32;var getHeapMax=()=>536870912;var alignMemory=(size,alignment)=>Math.ceil(size/alignment)*alignment;var growMemory=size=>{var oldHeapSize=wasmMemory.buffer.byteLength;var pages=(size-oldHeapSize+65535)/65536|0;try{wasmMemory.grow(pages);updateMemoryViews();return 1}catch(e){}};var _emscripten_resize_heap=requestedSize=>{var oldSize=HEAPU8.length;requestedSize>>>=0;var maxHeapSize=getHeapMax();if(requestedSize>maxHeapSize){return false}for(var cutDown=1;cutDown<=4;cutDown*=2){var overGrownHeapSize=oldSize*(1+.2/cutDown);overGrownHeapSize=Math.min(overGrownHeapSize,requestedSize+100663296);var newSize=Math.min(maxHeapSize,alignMemory(Math.max(requestedSize,overGrownHeapSize),65536));var replacement=growMemory(newSize);if(replacement){return true}}return false};var ENV={};var getExecutableName=()=>thisProgram;var getEnvStrings=()=>{if(!getEnvStrings.strings){var lang=(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8";var env={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:lang,_:getExecutableName()};for(var x in ENV){if(ENV[x]===undefined)delete env[x];else env[x]=ENV[x];}var strings=[];for(var x in env){strings.push(`${x}=${env[x]}`);}getEnvStrings.strings=strings;}return getEnvStrings.strings};var _environ_get=(__environ,environ_buf)=>{var bufSize=0;var envp=0;for(var string of getEnvStrings()){var ptr=environ_buf+bufSize;HEAPU32[__environ+envp>>2]=ptr;bufSize+=stringToUTF8(string,ptr,Infinity)+1;envp+=4;}return 0};var lengthBytesUTF8=str=>{var len=0;for(var i=0;i<str.length;++i){var c=str.charCodeAt(i);if(c<=127){len++;}else if(c<=2047){len+=2;}else if(c>=55296&&c<=57343){len+=4;++i;}else {len+=3;}}return len};var _environ_sizes_get=(penviron_count,penviron_buf_size)=>{var strings=getEnvStrings();HEAPU32[penviron_count>>2]=strings.length;var bufSize=0;for(var string of strings){bufSize+=lengthBytesUTF8(string)+1;}HEAPU32[penviron_buf_size>>2]=bufSize;return 0};var _fd_close=fd=>52;var _fd_read=(fd,iov,iovcnt,pnum)=>52;function _fd_seek(fd,offset,whence,newOffset){return 70}var printCharBuffers=[null,[],[]];var UTF8Decoder=globalThis.TextDecoder&&new TextDecoder;var findStringEnd=(heapOrArray,idx,maxBytesToRead,ignoreNul)=>{var maxIdx=idx+maxBytesToRead;if(ignoreNul)return maxIdx;while(heapOrArray[idx]&&!(idx>=maxIdx))++idx;return idx};var UTF8ArrayToString=(heapOrArray,idx=0,maxBytesToRead,ignoreNul)=>{var endPtr=findStringEnd(heapOrArray,idx,maxBytesToRead,ignoreNul);if(endPtr-idx>16&&heapOrArray.buffer&&UTF8Decoder){return UTF8Decoder.decode(heapOrArray.subarray(idx,endPtr))}var str="";while(idx<endPtr){var u0=heapOrArray[idx++];if(!(u0&128)){str+=String.fromCharCode(u0);continue}var u1=heapOrArray[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}var u2=heapOrArray[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2;}else {u0=(u0&7)<<18|u1<<12|u2<<6|heapOrArray[idx++]&63;}if(u0<65536){str+=String.fromCharCode(u0);}else {var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023);}}return str};var printChar=(stream,curr)=>{var buffer=printCharBuffers[stream];if(!curr||curr===10){(stream===1?out:err)(UTF8ArrayToString(buffer));buffer.length=0;}else {buffer.push(curr);}};var UTF8ToString=(ptr,maxBytesToRead,ignoreNul)=>ptr?UTF8ArrayToString(HEAPU8,ptr,maxBytesToRead,ignoreNul):"";var _fd_write=(fd,iov,iovcnt,pnum)=>{var num=0;for(var i=0;i<iovcnt;i++){var ptr=HEAPU32[iov>>2];var len=HEAPU32[iov+4>>2];iov+=8;for(var j=0;j<len;j++){printChar(fd,HEAPU8[ptr+j]);}num+=len;}HEAPU32[pnum>>2]=num;return 0};{if(Module["print"])out=Module["print"];if(Module["printErr"])err=Module["printErr"];if(Module["wasmBinary"])wasmBinary=Module["wasmBinary"];}Module["UTF8ToString"]=UTF8ToString;Module["stringToUTF8"]=stringToUTF8;Module["lengthBytesUTF8"]=lengthBytesUTF8;var ___trap,wasmMemory;function assignWasmExports(wasmExports){Module["_nam_createInstance"]=wasmExports["k"];Module["_nam_destroyInstance"]=wasmExports["l"];Module["_nam_loadModel"]=wasmExports["m"];Module["_nam_unloadModel"]=wasmExports["n"];Module["_nam_hasModel"]=wasmExports["o"];Module["_nam_getBuffer"]=wasmExports["p"];Module["_nam_process"]=wasmExports["q"];Module["_nam_isSlimmable"]=wasmExports["r"];Module["_nam_setSlimmableSize"]=wasmExports["s"];Module["_nam_getSlimmableBreakpointCount"]=wasmExports["t"];Module["_nam_getSlimmableBreakpoint"]=wasmExports["u"];Module["_nam_hasLoudness"]=wasmExports["v"];Module["_nam_getLoudness"]=wasmExports["w"];Module["_nam_getExpectedSampleRate"]=wasmExports["x"];Module["_nam_getLastError"]=wasmExports["y"];Module["_nam_getVersion"]=wasmExports["z"];Module["_free"]=wasmExports["A"];Module["_malloc"]=wasmExports["B"];___trap=wasmExports["C"];wasmMemory=wasmExports["i"];wasmExports["__indirect_function_table"];}var wasmImports={h:__abort_js,g:_emscripten_resize_heap,b:_environ_get,c:_environ_sizes_get,d:_fd_close,e:_fd_read,f:_fd_seek,a:_fd_write};async function run(){if(ABORT)return;initRuntime();Module["onRuntimeInitialized"]?.();}var wasmExports;wasmExports=await createWasm();await run();
return Module}

/**
 * Message protocol between NamEngine (main thread) and the NAM worklet
 * processor (audio thread). Every request carries a requestId and receives
 * exactly one response.
 */
/** Name under which the processor is registered in the worklet scope. */
const NAM_PROCESSOR_NAME = 'nam-processor';

/**
 * NAM AudioWorkletProcessor.
 *
 * The wasm module is instantiated exactly once per AudioWorkletGlobalScope
 * (shared by every NAM node in the context) from bytes sent over the message
 * port, since the worklet scope has no fetch. Each processor owns one engine
 * instance id.
 *
 * This single-instantiation design is the core of the architecture: it avoids
 * WebKit recompiling the whole module on the audio thread (a ~500 MB
 * dirty-memory storm that crossed the iOS Jetsam limit in the previous
 * SharedArrayBuffer-based design).
 *
 * This file is bundled into a self-contained dist/engine/nam-worklet.js
 * (the Emscripten glue is inlined), so it can be served from any URL without
 * relative imports.
 */
/** Frames per render quantum (fixed by the Web Audio spec). */
const RENDER_QUANTUM_FRAMES = 128;
/** After a model swap I fade back in over ~21 ms to mask the discontinuity. */
const FADE_IN_FRAMES = 1024;
// One wasm module per worklet scope, created on the first node's init.
let modulePromise = null;
class NamProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.module = null;
        this.instanceId = 0;
        this.hasModel = false;
        this.destroyed = false;
        // Cached view into the instance's wasm-side audio buffer. Re-derived when
        // memory growth replaces the underlying ArrayBuffer.
        this.bufferPtr = 0;
        this.bufferView = null;
        // Frames left in the post-model-swap fade-in.
        this.fadeInRemaining = 0;
        this.port.onmessage = (event) => {
            void this.handleRequest(event.data);
        };
    }
    async handleRequest(request) {
        try {
            switch (request.type) {
                case 'init': {
                    // locateFile short-circuits the glue's `new URL(...)` fallback for
                    // the wasm path; Chromium's AudioWorkletGlobalScope has no URL
                    // constructor (the path is never fetched, wasmBinary is given).
                    modulePromise ?? (modulePromise = createNamEngine({
                        wasmBinary: request.wasmBytes,
                        locateFile: (path) => path,
                    }));
                    this.module = await modulePromise;
                    this.instanceId = this.module._nam_createInstance(sampleRate, RENDER_QUANTUM_FRAMES);
                    this.bufferPtr = this.module._nam_getBuffer(this.instanceId);
                    this.respond(request.requestId);
                    break;
                }
                case 'load-model': {
                    const module = this.requireModule();
                    const byteLength = module.lengthBytesUTF8(request.json) + 1;
                    const ptr = module._malloc(byteLength);
                    module.stringToUTF8(request.json, ptr, byteLength);
                    const ok = module._nam_loadModel(this.instanceId, ptr, request.slimSize);
                    module._free(ptr);
                    if (!ok) {
                        throw new Error(module.UTF8ToString(module._nam_getLastError()) ||
                            'model load failed');
                    }
                    // Loading may have grown wasm memory; the pointer is stable but the
                    // view must be re-derived.
                    this.bufferView = null;
                    this.hasModel = true;
                    this.fadeInRemaining = FADE_IN_FRAMES;
                    this.respond(request.requestId, this.readModelInfo(module));
                    break;
                }
                case 'unload-model': {
                    this.requireModule()._nam_unloadModel(this.instanceId);
                    this.hasModel = false;
                    this.respond(request.requestId);
                    break;
                }
                case 'set-slim-size': {
                    this.requireModule()._nam_setSlimmableSize(this.instanceId, request.slimSize);
                    this.fadeInRemaining = FADE_IN_FRAMES;
                    this.respond(request.requestId);
                    break;
                }
                case 'destroy': {
                    if (this.module !== null && this.instanceId > 0) {
                        this.module._nam_destroyInstance(this.instanceId);
                    }
                    this.instanceId = 0;
                    this.hasModel = false;
                    this.destroyed = true;
                    this.respond(request.requestId);
                    this.port.onmessage = null;
                    break;
                }
            }
        }
        catch (error) {
            const message = {
                type: 'response',
                requestId: request.requestId,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
            this.port.postMessage(message);
        }
    }
    requireModule() {
        if (this.module === null || this.instanceId <= 0) {
            throw new Error('worklet not initialized');
        }
        return this.module;
    }
    respond(requestId, modelInfo) {
        const message = {
            type: 'response',
            requestId,
            ok: true,
            ...(modelInfo !== undefined ? { modelInfo } : {}),
        };
        this.port.postMessage(message);
    }
    readModelInfo(module) {
        const id = this.instanceId;
        const breakpointCount = module._nam_getSlimmableBreakpointCount(id);
        const slimmableBreakpoints = [];
        for (let i = 0; i < breakpointCount; i++) {
            slimmableBreakpoints.push(module._nam_getSlimmableBreakpoint(id, i));
        }
        return {
            slimmable: module._nam_isSlimmable(id) === 1,
            slimmableBreakpoints,
            hasLoudness: module._nam_hasLoudness(id) === 1,
            loudness: module._nam_getLoudness(id),
            expectedSampleRate: module._nam_getExpectedSampleRate(id),
        };
    }
    /** Get the wasm-side audio buffer, re-derived after memory growth. */
    getBufferView(module) {
        if (this.bufferView === null ||
            this.bufferView.buffer !== module.HEAPF32.buffer) {
            const offset = this.bufferPtr >> 2;
            this.bufferView = module.HEAPF32.subarray(offset, offset + RENDER_QUANTUM_FRAMES);
        }
        return this.bufferView;
    }
    /**
     * Render one quantum. Allocation-free on the steady-state path: indexed
     * loops, no iterators, cached heap view (WebKit's worklet heap does not
     * collect garbage aggressively).
     */
    process(inputs, outputs) {
        if (this.destroyed)
            return false;
        const input = inputs[0];
        const output = outputs[0];
        if (!output || output.length === 0)
            return true;
        const outputChannel = output[0];
        const inputChannel = input && input.length > 0 ? input[0] : null;
        const frames = outputChannel.length;
        if (this.module === null ||
            !this.hasModel ||
            inputChannel === null ||
            frames > RENDER_QUANTUM_FRAMES) {
            // Pass-through (or silence when there is no input to pass).
            if (inputChannel !== null) {
                outputChannel.set(inputChannel);
            }
            else {
                outputChannel.fill(0);
            }
            return true;
        }
        const buffer = this.getBufferView(this.module);
        buffer.set(inputChannel);
        this.module._nam_process(this.instanceId, frames);
        // nam_process never allocates, so the view is still valid here.
        if (frames === RENDER_QUANTUM_FRAMES) {
            outputChannel.set(buffer);
        }
        else {
            for (let i = 0; i < frames; i++)
                outputChannel[i] = buffer[i];
        }
        if (this.fadeInRemaining > 0) {
            for (let i = 0; i < frames && this.fadeInRemaining > 0; i++) {
                const progress = 1 - this.fadeInRemaining / FADE_IN_FRAMES;
                outputChannel[i] *= progress;
                this.fadeInRemaining--;
            }
        }
        return true;
    }
}
registerProcessor(NAM_PROCESSOR_NAME, NamProcessor);
