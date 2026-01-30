type UniversalWorkerOptions = {
    isolated?: boolean;
    scriptPath: string;
    workerData?: any;
};
export default class UniversalWorker {
    private impl;
    /**
     * Создает новые воркер
     *
     * Если параметр isolated = true будет создан форк
     * иначе будет использоваться WorkerThread
    */
    constructor(options: UniversalWorkerOptions);
    /**
     * Отправляет внутрь воркера обхект способный к сериализации
    */
    send(msg: any): void;
    /**
     * Подписывает на события воркера
     *
     * Доступно только message exit error
    */
    on(event: 'message' | 'exit' | 'error', handler: (...args: any[]) => void): void;
    /**
     * Убивает процесс
    */
    kill(): void;
    /**
     * @see kill
    */
    terminate(): void;
}
export type WorkerMessageHandler = (message: any) => void;
/**
 * Определяет - является ли процесс форкнутым
 * Основанно на проверке метода process.send которая есть только у фокрнутого процесса
*/
export declare const isForked: boolean;
/**
 * Определяет - является ли данный инстанс дочерним - не важно используя worker_threads или fork
 * Проверяет !isMainThread || isForked
*/
export declare const isChild: boolean;
/**
 * Получение данных сверху, которые были переданны при создании воркера
 * В случае использования worker_threads - workerData
 * Если же это форк - парсит устаноленнюу переменную окружения VRACK2_WORKER_DATA
*/
export declare function getWorkerData(): any;
/**
 * Отправка данных наверх в родительский процесс
*/
export declare function sendMessage(message: any): void;
/**
 * Позволяет подписаться на данные которые приходят сверху
*/
export declare function onMessage(handler: WorkerMessageHandler): void;
export {};
