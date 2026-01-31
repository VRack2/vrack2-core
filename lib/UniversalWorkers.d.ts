type UniversalWorkerOptions = {
    isolated?: boolean;
    scriptPath: string;
    workerData?: any;
};
export type WorkerMessageHandler = (message: any) => void;
export default class UniversalWorker {
    static isMain: boolean;
    static isForked: boolean;
    static isChild: boolean;
    /**
     * Получение данных сверху, которые были переданны при создании воркера
     * В случае использования worker_threads - workerData
     * Если же это форк - парсит устаноленнюу переменную окружения VRACK2_WORKER_DATA
    */
    static getWorkerData(): any;
    /**
     * Отправка данных наверх в родительский процесс
    */
    static sendMessage(message: any): void;
    /**
     * Позволяет подписаться на данные которые приходят сверху
    */
    static onMessage(handler: WorkerMessageHandler): void;
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
export {};
