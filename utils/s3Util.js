const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Инициализация S3 клиента
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
});

/**
 * Функция для загрузки файла в S3
 * @param {Object} file - Объект файла из запроса (fastify-multipart)
 * @param {String} bucketName - Имя S3 бакета
 * @param {String} customPath - Кастомный путь внутри S3 (дополнительная папка)
 * @returns {String} - URL загруженного файла
 */
async function uploadToS3(file, bucketName, customPath = '') {
    const uniqueFileName = `${randomUUID()}-${Date.now()}`;
    const s3Root = process.env.S3_ROOT || '';

    // Указанный путь должен начинаться с S3_ROOT (Для директорий с проектами)
    const fullPath = path.posix.join(s3Root, customPath, uniqueFileName);

    // Временное сохранение файла
    const tempPath = path.join(__dirname, '../uploads', uniqueFileName);
    await fs.promises.writeFile(tempPath, await file.toBuffer());

    try {
        // Загрузка файла в S3
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fullPath,
            Body: fs.createReadStream(tempPath),
            ContentType: file.mimetype,
            ACL: 'public-read',
        });

        await s3Client.send(command);

        // Удаление временного файла
        await fs.promises.unlink(tempPath);

        // Возвращаем URL файла
        return `${process.env.S3_SHORT_ENDPOINT}/${fullPath}`;
    } catch (error) {
        console.error('Ошибка загрузки файла в S3:', error);
        throw new Error('Не удалось загрузить файл в S3.');
    }
}

module.exports = { uploadToS3 };
