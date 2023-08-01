const fsPromises = require('fs/promises');
const path = require('path')

/**
 * bookmark 디렉토리에 .htm 혹은 .html 파일을 추가하면
 * 구글 크롬 브라우저 북마크 내보내기 파일로 판단하고
 * JSON 데이터로 변환 합니다
 */

async function rootFn() {
    const { rejectedFile, fulfilledFile } = await getFiles();

    console.log('rejectedFile', rejectedFile);
    rejectedFile.splice(0);

    const parseJsonArray = fulfilledFile.map(i => parseFile(i));
}

/**
 * @/bookmark 디렉토리의 .htm 또는 .html 파일을 읽고
 * rejectedFile, fulfilledFile 배열을 반환 합니다
 */
async function getFiles() {
    const bookmarkPath = path.join(__dirname, 'bookmark');

    const bookmarkDirFileList = await fsPromises.readdir(bookmarkPath, { encoding: 'utf-8' });
    const xmlFileFilter = bookmarkDirFileList.filter(function (fileName) {
        return ['.htm', '.html'].includes(path.extname(fileName));
    });

    const asyncReadFiles = await Promise.allSettled(xmlFileFilter.map(fileName => {
        const filePath = path.join(bookmarkPath, fileName);
        return fsPromises.readFile(filePath, { encoding: 'utf-8' });
    }).concat(Promise.reject(new Error('Hello'))));

    const { rejectedFile, fulfilledFile } = asyncReadFiles.reduce(function (result, item) {
        const { rejectedFile, fulfilledFile } = result;

        if (item.status === 'rejected') {
            rejectedFile.push(item.reason);
            return result;
        }

        if (item.status === 'fulfilled') {
            fulfilledFile.push(item.value);
            return result;
        }

        return result;
    }, { rejectedFile: [], fulfilledFile: [] });

    return { rejectedFile, fulfilledFile };
}


function parseFile(rawString) {
    const res = {};

    return res;
}

rootFn();