"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMessage = exports.sendMessage = exports.getWorkerData = exports.isChild = exports.isForked = void 0;
// UniversalWorker.ts
const child_process_1 = require("child_process");
const worker_threads_1 = require("worker_threads");
class UniversalWorker {
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
exports.default = UniversalWorker;
/**
 * Определяет - является ли процесс форкнутым
 * Основанно на проверке метода process.send которая есть только у фокрнутого процесса
*/
exports.isForked = typeof process.send === 'function';
/**
 * Определяет - является ли данный инстанс дочерним - не важно используя worker_threads или fork
 * Проверяет !isMainThread || isForked
*/
exports.isChild = !worker_threads_1.isMainThread || exports.isForked;
/**
 * Получение данных сверху, которые были переданны при создании воркера
 * В случае использования worker_threads - workerData
 * Если же это форк - парсит устаноленнюу переменную окружения VRACK2_WORKER_DATA
*/
function getWorkerData() {
    if (!worker_threads_1.isMainThread)
        return worker_threads_1.workerData;
    if (exports.isForked)
        return JSON.parse(process.env.VRACK2_WORKER_DATA || '{}');
    throw new Error('getWorkerData() called in main process');
}
exports.getWorkerData = getWorkerData;
/**
 * Отправка данных наверх в родительский процесс
*/
function sendMessage(message) {
    if (!worker_threads_1.isMainThread)
        return worker_threads_1.parentPort?.postMessage(message);
    if (exports.isForked) {
        process.send?.(message);
        return;
    }
    throw new Error('sendMessage() called in main process');
}
exports.sendMessage = sendMessage;
/**
 * Позволяет подписаться на данные которые приходят сверху
*/
function onMessage(handler) {
    if (!worker_threads_1.isMainThread)
        worker_threads_1.parentPort?.on('message', handler);
    else if (exports.isForked)
        process.on('message', handler);
    else
        throw new Error('onMessage() called in main process');
}
exports.onMessage = onMessage;
