// UniversalWorker.ts
import { ChildProcess, fork } from 'child_process';
import { Worker as WorkerThread, parentPort, workerData, isMainThread } from 'worker_threads';


type UniversalWorkerOptions = {
  isolated?: boolean;
  scriptPath: string;
  workerData?: any;
};

export type WorkerMessageHandler = (message: any) => void;

export default class UniversalWorker {

  static isMain = isMainThread &&  process.send === undefined
  static isForked = typeof process.send === 'function';
  static isChild = !isMainThread || typeof process.send === 'function';

  /**
   * Получение данных сверху, которые были переданны при создании воркера
   * В случае использования worker_threads - workerData
   * Если же это форк - парсит устаноленнюу переменную окружения VRACK2_WORKER_DATA
  */
  static getWorkerData(): any {
    if (!isMainThread) return workerData;
    if (UniversalWorker.isForked) return JSON.parse(process.env.VRACK2_WORKER_DATA || '{}');
    throw new Error('getWorkerData() called in main process');
  }

  /**
   * Отправка данных наверх в родительский процесс
  */
  static sendMessage(message: any): void {
    if (!isMainThread) return parentPort?.postMessage(message);
    if (UniversalWorker.isForked) { process.send?.(message); return }
    throw new Error('sendMessage() called in main process');
  }

  /**
   * Позволяет подписаться на данные которые приходят сверху
  */
  static onMessage(handler: WorkerMessageHandler): void {
    if (!isMainThread) parentPort?.on('message', handler);
    else if (UniversalWorker.isForked) process.on('message', handler);
    else throw new Error('onMessage() called in main process');
  }


  private impl: {
    send: (msg: any) => void;
    on: (event: 'message' | 'exit' | 'error', handler: (...args: any[]) => void) => void;
    kill: () => void;
  };

  /**
   * Создает новые воркер
   * 
   * Если параметр isolated = true будет создан форк 
   * иначе будет использоваться WorkerThread
  */
  constructor(options: UniversalWorkerOptions) {
    const { isolated = true, scriptPath, workerData } = options;

    if (isolated) {
      // child_process
      const proc = fork(scriptPath, [], {
        env: { ...process.env, VRACK2_WORKER_DATA: JSON.stringify(workerData) }
      });
      this.impl = {
        send: (msg) => proc.send(msg),
        on: (ev, handler) => proc.on(ev, handler),
        kill: () => proc.kill()
      };
    } else {
      // worker_threads
      const wt = new WorkerThread(scriptPath, { workerData });
      this.impl = {
        send: (msg) => wt.postMessage(msg),
        on: (ev, handler) => {
          if (ev === 'message') wt.on('message', handler);
          else if (ev === 'error') wt.on('error', handler);
          else if (ev === 'exit') wt.on('exit', handler as (code: number) => void);
        },
        kill: () => wt.terminate()
      };
    }
  }

  /**
   * Отправляет внутрь воркера обхект способный к сериализации
  */
  send(msg: any): void {
    this.impl.send(msg);
  }

  /**
   * Подписывает на события воркера
   * 
   * Доступно только message exit error
  */
  on(event: 'message' | 'exit' | 'error', handler: (...args: any[]) => void): void {
    this.impl.on(event, handler);
  }

  /**
   * Убивает процесс
  */
  kill() {
    this.impl.kill();
  }

  /**
   * @see kill
  */
  terminate() {
    this.impl.kill();
  }
}