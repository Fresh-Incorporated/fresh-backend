import { FastifyPluginAsync } from 'fastify'
import {Order} from "../../models/Order";
import {Op} from "sequelize";
import {Product} from "../../models/Product";

const route: FastifyPluginAsync = async function (fastify, opts) {
  fastify.get('/stats', async function (request, reply) {
    const ordersCount = await Order.count();
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);
    const lastOrders = await Order.count({
      where: {
        createdAt: {
          [Op.gte]: dayAgo
        }
      }
    })

    const lastFiveOrders = await Order.findAll({
      limit: 25,
      order: [['id', 'DESC']]
    })

    const rawProducts = lastFiveOrders.map(o => (o.data as any).products).flat(1)
    const productsIds = [...new Set(rawProducts.map(o => o.id))]
    console.log(productsIds)
    const products = await Product.findAll({
      where: {
        id: productsIds,
        verify_status: 1
      },
      attributes: ["id", "name", "description", "icon"],
      raw: true,
      paranoid: false
    })
    console.log(products)

    for (const product of products) {
      if (!product.count) {
        product.count = 0
      }

      product.count += rawProducts.find(p => p.id == product.id).count
    }

    return {
      totalOrders: ordersCount,
      last24hOrders: lastOrders,
      lastProducts: products,
    }
  })
}

export default route;
