import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

interface FileUpload {
    filename: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

const s3Client = new S3Client({
    region: process.env.S3_REGION!,
    endpoint: process.env.S3_ENDPOINT!,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
    },
});

/**
 * Функция для загрузки файла в S3
 * @param {Object} file - Объект файла из запроса (fastify-multipart) {filename, mimetype, size, buffer}
 * @param {String} bucketName - Имя S3 бакета
 * @param {String} customPath - Кастомный путь внутри S3 (дополнительная папка)
 * @param {Boolean} toWebp - Флаг преобразования в WebP
 * @returns {String} - URL загруженного файла
 */
export async function uploadToS3(
    file: FileUpload,
    bucketName: string,
    customPath: string = '',
    toWebp: boolean = false
): Promise<string> {
    const uniqueFileName = `${randomUUID()}-${Date.now()}`;
    const s3Root = process.env.S3_ROOT || '';
    let fullPath = path.posix.join(s3Root, customPath, uniqueFileName);
    const tempPath = path.join(__dirname, '../uploads', uniqueFileName);

    if (toWebp) {
        try {
            const webpBuffer = await sharp(file.buffer).webp({ quality: 80 }).toBuffer();
            await fs.promises.writeFile(tempPath, webpBuffer);
            fullPath += '.webp';
        } catch (error) {
            console.error('Ошибка преобразования изображения в WebP:', error);
            throw new Error('Не удалось преобразовать изображение в WebP.');
        }
    } else {
        await fs.promises.writeFile(tempPath, file.buffer);
    }

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fullPath,
            Body: await fs.promises.readFile(tempPath),
            ContentType: toWebp ? 'image/webp' : file.mimetype,
            ACL: 'public-read',
        });

        await s3Client.send(command);
        await fs.promises.unlink(tempPath);

        return `${process.env.S3_SHORT_ENDPOINT}/${fullPath}`;
    } catch (error) {
        console.error('Ошибка загрузки файла в S3:', error);
        throw new Error('Не удалось загрузить файл в S3.');
    }
}
