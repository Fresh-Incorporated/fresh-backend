import { FastifyPluginAsync } from 'fastify';
import { uploadToS3 } from '../../../../utils/s3Util';
import { Location } from '../../../../models/Location';
import { LocationImage } from '../../../../models/LocationImage';
import { LocationCoordinate } from '../../../../models/LocationCoordinate';
import { LocationCell } from '../../../../models/LocationCell';
import {User} from "../../../../models/User";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const accessToken = request.cookies.access_token;
      if (!accessToken) {
        return reply.status(401).send({ error: 'Missing access token' });
      }
      const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
      const user = await User.findOne({
        where: { id: jwtUser.id },
        attributes: { exclude: ['updatedAt'] },
      });
      if (!user) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      if (user.fm_worker < 4) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      (request as any).user = user;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/locations', async (request, reply) => {
    const locations = await Location.findAll({
      include: [
        { model: LocationCoordinate, as: 'coordinates' },
        { model: LocationImage, as: 'images' },
        { model: LocationCell, as: 'cells' },
      ],
    });
    return reply.status(200).send(locations);
  });

  fastify.post('/location/create', async (request, reply) => {
    const formData = await (request as any).formData?.();
    const name = formData?.get('name');
    const description = formData?.get('description');
    const type = formData?.get('type');
    const city = formData?.get('city');
    const coordinates = JSON.parse(formData?.get('coordinates') || '[]');
    if (!['storage', 'refill', 'branch', 'deliver'].includes(type)) {
      return reply.status(400).send({ message: 'Не подходящий тип локации.' });
    }
    const images: any[] = [];
    for (const key in (request.body || {})) {
      const field = (request.body as any)[key];
      if (field?.file) {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimeTypes.includes(field.mimetype)) {
          return reply.status(400).send({ message: 'Допускаются только изображения форматов JPEG, JPG, PNG, SVG или WEBP.' });
        }
        const buffer = await field.toBuffer();
        images.push({ filename: field.filename, mimetype: field.mimetype, size: buffer.length, buffer });
      }
    }
    const imageUrls: string[] = [];
    for (const image of images) {
      const fileUrl = await uploadToS3(image, process.env.S3_BUCKET_NAME!, 'fresh/market/location_image', true);
      imageUrls.push(fileUrl);
    }
    const location = await Location.create({ name, description, type, city } as any);
    for (const coordinate of coordinates) {
      if (coordinate?.x == null || coordinate?.y == null || coordinate?.z == null || coordinate?.world == null) continue;
      await LocationCoordinate.create({ x: coordinate.x, y: coordinate.y, z: coordinate.z, world: coordinate.world, locationId: location.id } as any);
    }
    for (const url of imageUrls) {
      await LocationImage.create({ image: url, locationId: location.id } as any);
    }
    return reply.status(200).send({ message: 'Локация успешно создана' });
  });

  fastify.post<{ Params: { location: string }; Body: { cells: { letter: string; number: number }[] } }>('/location/:location/cells/add', async (request, reply) => {
    const location = await Location.findOne({ where: { id: request.params.location }, attributes: { exclude: ['updatedAt'] } });
    if (!location) {
      return reply.status(400).send({ message: 'Локация не найдена' });
    }
    const cellsToInsert = request.body.cells.map(cell => ({ letter: cell.letter, number: cell.number, locationId: location.id }));
    await LocationCell.bulkCreate(cellsToInsert as any);
    return reply.status(200).send({ message: 'Ячейки добавлены' });
  });

  fastify.post<{ Params: { location: string } }>('/location/:location/enable', async (request, reply) => {
    const location = await Location.findOne({
      where: { id: request.params.location },
      include: [{ model: LocationCell, as: 'cells' }],
      attributes: { exclude: ['updatedAt'] },
    });
    if (!location) {
      return reply.status(400).send({ message: 'Локация не найдена' });
    }
    if ((location as any).cells.length === 0) {
      return reply.status(400).send({ message: 'Невозможно включить локацию с 0 ячеек' });
    }
    await location.update({ enabled: true });
    return reply.status(200).send({ message: 'Локация включена' });
  });

  fastify.post<{ Params: { location: string } }>('/location/:location/disable', async (request, reply) => {
    const location = await Location.findOne({ where: { id: request.params.location }, attributes: { exclude: ['updatedAt'] } });
    if (!location) {
      return reply.status(400).send({ message: 'Локация не найдена' });
    }
    await location.update({ enabled: false });
    return reply.status(200).send({ message: 'Локация выключена' });
  });
};

export default route;
