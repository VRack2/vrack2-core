"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// UniversalWorker.ts
const child_process_1 = require("child_process");
const worker_threads_1 = require("worker_threads");
class UniversalWorker {
    /**
     * Получение данных сверху, которые были переданны при создании воркера
     * В случае использования worker_threads - workerData
     * Если же это форк - парсит устаноленнюу переменную окружения VRACK2_WORKER_DATA
    */
    static getWorkerData() {
        if (!worker_threads_1.isMainThread)
            return worker_threads_1.workerData;
        if (UniversalWorker.isForked)
            return JSON.parse(process.env.VRACK2_WORKER_DATA || '{}');
        throw new Error('getWorkerData() called in main process');
    }
    /**
     * Отправка данных наверх в родительский процесс
    */
    static sendMessage(message) {
        if (!worker_threads_1.isMainThread)
            return worker_threads_1.parentPort?.postMessage(message);
        if (UniversalWorker.isForked) {
            process.send?.(message);
            return;
        }
        throw new Error('sendMessage() called in main process');
    }
    /**
     * Позволяет подписаться на данные которые приходят сверху
    */
    static onMessage(handler) {
        if (!worker_threads_1.isMainThread)
            worker_threads_1.parentPort?.on('message', handler);
        else if (UniversalWorker.isForked)
            process.on('message', handler);
        else
            throw new Error('onMessage() called in main process');
    }
    /**
     * Создает новые воркер
     *
     * Если параметр isolated = true будет создан форк
     * иначе будет использоваться WorkerThread
    */
    constructor(options) {
        const { isolated = true, scriptPath, workerData } = options;
        if (isolated) {
            // child_process
            const proc = (0, child_process_1.fork)(scriptPath, [], {
                env: { ...process.env, VRACK2_WORKER_DATA: JSON.stringify(workerData) }
            });
            this.impl = {
                send: (msg) => proc.send(msg),
                on: (ev, handler) => proc.on(ev, handler),
                kill: () => proc.kill()
            };
        }
        else {
            // worker_threads
            const wt = new worker_threads_1.Worker(scriptPath, { workerData });
            this.impl = {
                send: (msg) => wt.postMessage(msg),
                on: (ev, handler) => {
                    if (ev === 'message')
                        wt.on('message', handler);
                    else if (ev === 'error')
                        wt.on('error', handler);
                    else if (ev === 'exit')
                        wt.on('exit', handler);
                },
                kill: () => wt.terminate()
            };
        }
    }
    /**
     * Отправляет внутрь воркера обхект способный к сериализации
    */
    send(msg) {
        this.impl.send(msg);
    }
    /**
     * Подписывает на события воркера
     *
     * Доступно только message exit error
    */
    on(event, handler) {
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
UniversalWorker.isMain = worker_threads_1.isMainThread && process.send === undefined;
UniversalWorker.isForked = typeof process.send === 'function';
UniversalWorker.isChild = !worker_threads_1.isMainThread || typeof process.send === 'function';
exports.default = UniversalWorker;
