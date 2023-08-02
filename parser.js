const fsPromises = require('fs/promises');
const path = require('path')

/**
    Interface Group {
        type: "group",

        header : null | {
            "type": "heading",
            "$attr": {
                ADD_DATE: string,
                LAST_MODIFIED: string,
                PERSONAL_TOOLBAR_FOLDER ?: "true"
            },
            $text: string
        },

        item : Array<Group | Anchor>
    }

    Interface Anchor {
        type: "anchor",

        $attr: {
            HREF: string,
            ADD_DATE: string,
            ICON ?: string
        },

        $text: string
    }
 */

/**
 * bookmark 디렉토리에 .htm 혹은 .html 파일을 추가하면
 * 구글 크롬 브라우저 북마크 내보내기 파일로 판단하고
 * JSON 데이터로 변환 합니다
 */

async function rootFn() {
    const { rejectedFile, fulfilledFile } = await getFiles();

    if (rejectedFile.length) {
        console.log('rejectedFile', rejectedFile);
        rejectedFile.splice(0);
    }

    const parseArray = fulfilledFile.map(i => parseFile(i));
    const mergeData = parseArray.reduce(mergeBookmarks);
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
    }));

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

    const raw = rawString.replaceAll('\r\n', '\n');

    /**
        // Remove Tag
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <!-- This is an automatically generated file.
            It will be read and overwritten.
            DO NOT EDIT! -->
        <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
        <TITLE>Bookmarks</TITLE>
        <H1>Bookmarks</H1>
     */
    const data = raw.substring(254);

    const lines = data.split('\n').map(i => i.trim());
    const objs = lines.map(i => parseLine(i));

    let top = null;
    let stack = [];
    let header = null;

    objs.forEach(i => {

        if (i.type === 'heading') {
            header = i;
            return;
        }

        if (i.type === 'start-group') {
            let parent = stack.at(-1);
            const newGroup = { type: 'group', header: header, item: [] /*, parent: parent */ };

            if (parent !== void 0) {
                parent.item.push(newGroup);
            }

            stack.push(newGroup);

            if (top == null) top = newGroup;

            return;
        }

        if (i.type === 'close-group') {
            stack.pop();
            return;
        }


        if (i.type === 'anchor') {
            let parent = stack.at(-1);
            const newItem = Object.assign({}, i /*, { parent: parent }*/);
            parent.item.push(newItem);
            return;
        }

        if (i.type === 'unknown') {
            return;
        }

    });
    return top;
}

function parseLine(text) {
    const startHeading3 = '<DT><H3';
    const startAnchor = '<DT><A';

    const startGroup = '<DL><p>';
    const closeGroup = '</DL><p>';

    if (text.indexOf(startHeading3) === 0) {
        const $attr = {};
        let $text = '';

        // Remove Close Tag
        text = text.substring(0, text.length - '</H3>'.length);

        $text = text.substring(1 + text.lastIndexOf('>'));
        const attr = text.substring(startHeading3.length + 1, text.lastIndexOf('>'));

        let token = [];
        let buff = '';

        for (let i = 0; i < attr.length; i++) {
            let it = attr.charAt(i);
            buff += it;

            if (it === '"') {
                while ((it = attr.charAt(++i)) != '"') {
                    buff += it;
                }
                buff += it;

                token.push({ type: 'value', value: buff.substring(1, buff.length - 1) });

                buff = '';
            }

            if (it === '=') {
                token.push({ type: 'key', value: buff.substring(0, buff.length - 1) });
                buff = '';
            }

            if (it === ' ') {
                const b = buff.substring(0, buff.length - 1);
                buff = '';
            }
        }

        for (let i = 0; i < token.length; i += 2) {
            let key = token[i].value;
            let value = token[i + 1].value;
            $attr[key] = value;
        }

        return { type: 'heading', $attr, $text };
    }

    if (text.indexOf(startAnchor) === 0) {
        const $attr = {};
        let $text = '';

        // Remove Close Tag
        text = text.substring(0, text.length - '</A>'.length);

        $text = text.substring(1 + text.lastIndexOf('>'));
        const attr = text.substring(startAnchor.length + 1, text.lastIndexOf('>'));

        let token = [];
        let buff = '';

        for (let i = 0; i < attr.length; i++) {
            let it = attr.charAt(i);
            buff += it;

            if (it === '"') {
                while ((it = attr.charAt(++i)) != '"') {
                    buff += it;
                }
                buff += it;

                token.push({ type: 'value', value: buff.substring(1, buff.length - 1) });

                buff = '';
            }

            if (it === '=') {
                token.push({ type: 'key', value: buff.substring(0, buff.length - 1) });
                buff = '';
            }

            if (it === ' ') {
                const b = buff.substring(0, buff.length - 1);
                buff = '';
            }
        }

        for (let i = 0; i < token.length; i += 2) {
            let key = token[i].value;
            let value = token[i + 1].value;
            $attr[key] = value;
        }

        return { type: 'anchor', $attr, $text };
    }

    if (text.indexOf(startGroup) === 0) {
        return { type: 'start-group' };
    }

    if (text.indexOf(closeGroup) === 0) {
        return { type: 'close-group' };
    }

    return { type: 'unknown', text: text };
}

rootFn();

/**
    ADD_DATE(anchor) 혹은 LAST_MODIFIED(group) 현재 시간으로갱신
 */
function updateLastModify(item, value) {
    let newValue = value ?? String(Date.now()).substring(0, 10);
    if (item.type === 'anchor') {
        item.$attr.ADD_DATE = newValue;
    }

    if (item.type === 'group') {
        if (item.header) {
            item.header.$attr.LAST_MODIFIED = newValue;
        }
    }
}

/**
    ADD_DATE 현재 시간으로갱신
 */
function upateAddDate(item, value) {
    let newValue = value ?? String(Date.now()).substring(0, 10);
    if (item.type === 'anchor') {
        item.$attr.ADD_DATE = newValue;
    }

    if (item.type === 'group') {
        if (item.header) {
            item.header.$attr.ADD_DATE = newValue;
            item.header.$attr.LAST_MODIFIED = '0';
        }
    }
}

function mergeBookmarks(prevBookmark, currentBookmark) {

    if (prevBookmark == null) return currentBookmark;

    const mergeItem = [].concat(prevBookmark.item).concat(currentBookmark.item).reduce((init, curr) => {
        const { header, item } = curr;
        const { $text, $attr } = header;

        let preVal = init[$text];

        if (preVal == null) {
            init[$text] = {
                header: $attr,
                item: item
            };
        } else {
            const newItem = [].concat(init[$text].item).concat(item);
            init[$text].item = newItem;

            const initHeader = init[$text].header;

            const [I_ADD_DATE, I_LAST_MODIFIED, I_PERSONAL_TOOLBAR_FOLDER] = [
                initHeader['ADD_DATE'],
                initHeader['LAST_MODIFIED']
            ].map(i => Number(i)).concat(initHeader['PERSONAL_TOOLBAR_FOLDER']);

            const [C_ADD_DATE, C_LAST_MODIFIED, C_PERSONAL_TOOLBAR_FOLDER] = [
                $attr['ADD_DATE'],
                $attr['LAST_MODIFIED']
            ].map(i => Number(i)).concat($attr['PERSONAL_TOOLBAR_FOLDER']);

            const newHeader = init[$text].header = {
                ADD_DATE: String(Math.min(I_ADD_DATE, C_ADD_DATE)),
                LAST_MODIFIED: String(Math.max(I_LAST_MODIFIED, C_LAST_MODIFIED))
            };

            if (I_PERSONAL_TOOLBAR_FOLDER === 'true' || C_PERSONAL_TOOLBAR_FOLDER === 'true') {
                newHeader['PERSONAL_TOOLBAR_FOLDER'] = 'true';
            }

        }

        return init;
    }, {});

    const mItem = Object.entries(mergeItem).map(i => {
        const [text, ot] = i;
        const { header, item } = ot;
        return {
            "type": "group",
            "header": {
                "type": "heading",
                "$attr": header,
                "$text": text
            },
            "item": item
        };
    });

    return {
        "type": "group",
        "header": null,
        "item": mItem
    };
}