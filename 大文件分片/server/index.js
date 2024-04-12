const fs = require('fs-extra');
const path = require('path');

const express = require('express');
const multer = require('multer');
const opn = require('opn');

const app = express();
const uploader = multer({ dest: path.resolve(__dirname, 'tmp') });

// 将 client 作为静态目录
app.use(express.static(path.resolve(__dirname, '../client')));

// 关键代码
app.post('/upload', uploader.single('file'), (req, res) => {
    // 将上传的片进行临时存储
    saveChunks(
        req.file,
        req.body.md5,
        req.body.index,
        req.body.chunksLength,
        req.body.originFileName
    ).then((res2) => {
        let sendData = {
            msg: '分片上传成功',
            chunk_index: req.body.index,
            over: 0,
        };

        if (res2) {
            sendData.msg = '上传成功';
            sendData.over = 1;
        }

        res.send(sendData);
    });
});

function saveChunks(req, fileMD5, index, chunksLength, originFileName) {
    return new Promise(async (resolve, reject) => {
        const fileDir = path.join(__dirname, 'tmp', fileMD5);

        // 如果文件夹不存在，就创建
        fs.ensureDirSync(fileDir);

        // 从tmp根目录移动文件到目标文件夹
        fs.copySync(req.path, path.resolve(fileDir, index));

        // 然后移除临时上传的片
        fs.removeSync(req.path);
        let isOk = false;

        // 所有片传完了，可以合并
        if (Number(chunksLength) && Number(index) === chunksLength - 1) {
            console.log('进入合并');
            await genFile(fileMD5, originFileName);
            isOk = true;
        }

        resolve(isOk);
    });
}

function genFile(fileMD5, originFileName) {
    return new Promise((resolve) => {
        const fileDir = path.join(__dirname, 'tmp', fileMD5);
        fs.readdir(fileDir, (err, files) => {
            // 排个序
            files.sort();

            // 循环读取每个片文件
            const buffers = [];
            files.forEach((itemFile) => {
                const filePath = path.resolve(fileDir, itemFile);
                buffers.push(fs.readFileSync(filePath));
            });

            // 将片合成文件
            const bufferData = Buffer.concat(buffers);
            const filePath = path.resolve(__dirname, 'uploads', originFileName);

            // 将合好的文件写入磁盘
            fs.writeFile(filePath, bufferData, function (err) {
                if (!err) {
                    resolve(filePath);
                }
            });
        });
    });
}

app.listen(3650, () => {
    console.log('运行： http://localhost:3650');
    opn('http://localhost:3650');
});
