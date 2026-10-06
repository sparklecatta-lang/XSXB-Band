/** Pool of module Workers running the NAM wasm on whole buffers, so captures render in parallel. */
interface Job { worker: number; resolve: (output: Float32Array<ArrayBuffer>) => void; reject: (error: Error) => void }

export class NamWorkerPool {
  private workers: Worker[] = [];
  private busy: number[] = [];
  private jobs = new Map<number, Job>();
  private nextJob = 1;

  constructor(private url: URL, private size: number) {}

  private worker(index: number) {
    if (!this.workers[index]) {
      const worker = new Worker(this.url, { type: 'module', name: `nam-${index}` });
      // A worker that fails to load or crashes rejects its jobs instead of leaving playback waiting forever.
      worker.onerror = (event) => {
        event.preventDefault();
        for (const [id, job] of this.jobs) if (job.worker === index) { this.jobs.delete(id); job.reject(new Error(`NAM 工作线程出错：${event.message || '无法加载'}`)); }
        this.busy[index] = 0;
        worker.terminate();
        delete this.workers[index];
      };
      worker.onmessage = ({ data }: MessageEvent<{ jobId: number; output?: Float32Array<ArrayBuffer>; error?: string }>) => {
        const job = this.jobs.get(data.jobId);
        if (!job) return;
        this.jobs.delete(data.jobId);
        this.busy[index]--;
        if (data.error || !data.output) job.reject(new Error(`NAM 渲染失败：${data.error ?? '无输出'}`));
        else job.resolve(data.output);
      };
      this.workers[index] = worker;
      this.busy[index] = 0;
    }
    return this.workers[index];
  }

  /** Runs `input` (mono DI) through the capture; the input buffer is transferred to the worker. */
  process(modelUrl: string, input: Float32Array<ArrayBuffer>, sampleRate: number): Promise<Float32Array<ArrayBuffer>> {
    let index = 0;
    for (let i = 0; i < this.size; i++) {
      this.worker(i);
      if (this.busy[i] < this.busy[index]) index = i;
    }
    const jobId = this.nextJob++;
    this.busy[index]++;
    return new Promise((resolve, reject) => {
      this.jobs.set(jobId, { worker: index, resolve, reject });
      this.workers[index].postMessage({ jobId, modelUrl, sampleRate, input }, [input.buffer]);
    });
  }
}
