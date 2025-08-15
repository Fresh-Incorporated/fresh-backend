import {FastifyPluginAsync} from 'fastify';
import {User} from '../../../../../../models/User';
import {LocationCell} from "../../../../../../models/LocationCell";
import {Product} from "../../../../../../models/Product";
import {Order} from "../../../../../../models/Order";
import {Shop} from "../../../../../../models/Shop";

const route: FastifyPluginAsync = async (fastify): Promise<void> => {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'});
            }
            const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
            const dbUser = await User.findOne({
                where: {id: jwtUser.id},
                attributes: {exclude: ['updatedAt']},
            });
            if (!dbUser) {
                return reply.status(400).send({message: 'Пользователь не найден.'});
            }
            if (dbUser.fm_worker < 2) {
                return reply.status(403).send({message: 'Недостаточно прав.'});
            }
            request.user = dbUser;
        } catch (err) {
            return reply.status(401).send({error: 'Unauthorized'});
        }
    });

    fastify.get<{
        Params: { location: string, letter: string, number: string }
    }>('/cell/:letter/:number', async (request, reply) => {
        const cell = await LocationCell.findOne({
            where: {
                locationId: request.params.location,
                letter: request.params.letter,
                number: request.params.number
            },
            include: [
                {
                    model: Product,
                    as: 'product',
                    required: false
                },
                {
                    model: Product,
                    as: 'refillProduct',
                    required: false
                },
                {
                    model: Order,
                    as: 'branchOrder',
                    required: false
                },
                {
                    model: Order,
                    as: 'deliverOrder',
                    required: false
                }
            ]
        });

        let products: Product[] = []
        const order = cell?.branchOrder || cell?.deliverOrder || undefined
        if (order) {
            const productIds = (order.data as any)?.products.map((product: any) => product.id);
            products = await Product.findAll({
                where: { id: productIds },
                include: {
                    model: Shop,
                    as: 'shop',
                    attributes: ["id", "name", "icon", "tag"]
                }
            });
        }

        return reply.status(200).send({ cell: {
                id: cell?.id,
                world: cell?.world,
                letter: cell?.letter,
                number: cell?.number,
                x: cell?.x,
                y: cell?.y,
                z: cell?.z,
                slots: cell?.slots,
                product: cell?.product || cell?.refillProduct || undefined,
                order: order
            }, products: products });
    });
};

export default route;
