Быстрый старт
=============

Если вы хотите вначале быстро запустить и попробовать свое первое приложение вне VRack2, это хороший вариант для вас.

Для начала создадим папку:

```bash
mkdir myvapp
```

Перейдем в нее и проинициализируем npm

```bash
cd ./myvapp
npm init
```

Можете просто нажимать Enter пока конфигуратор npm не закончит свою работу

Установить vrack2-core:

```bash
npm install vrack2-core
```

Создадим еще необходимые директории

```bash
mkdir ./devices
mkdir ./storage
mkdir ./structure
```


Создадим файл запуска нашего сервиса `index.js` с содержимым

```js
import { ImportManager, MainProcess } from "vrack2-core";
import { isMainThread, workerData } from "worker_threads";
// Класс MainProcess
let MainProcessPath = 'vrack2-core.MainProcess'
// Файл структуры сервиса
let processFile = './service.json'
// Идентификатор контейнера - должен быть уникален только в случае запуска нескольких контейнеров
let id = 'containerID'

async function run (){ 
    // Импортируем JSON file
    const service = await ImportManager.importJSON(processFile) 
    // Импортируем класс MainProcess
    const MainProcessClass = await ImportManager.importClass(MainProcessPath)
    // Создаем экземпляр
    const MainProcessEx = new MainProcessClass({ id, service })
    
    MainProcessEx.run()
}

// Запуск 
run()
```

Отредактируем файл `package.json` и добавим скрипт запуска

```json
"scripts": {
    "start": "node ./index",
}
```

Пришло время добавить набор устройств. Создадим папку:

```bash
mkdir ./devices/myvendor
```

Создадим файл `Interval.js` 

```bash
take ./devices/myvendor/Interval.js
```

Добавим содержимое:

```js

```

Создадим файл `Debug.js` 

```bash
take ./devices/myvendor/Debug.js
```

Добавим содержимое:

```js

```

Осталось добавить файл сервиса `service.json` с содержимым:

```JSON

```

Теперь можно запустить сервис:

```bash
npm run start
```