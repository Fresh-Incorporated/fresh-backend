'use strict'

const {uploadToS3} = require("../../../../utils/s3Util");
const {Op, literal} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'});
            }

            request.user = fastify.jwt.verify(accessToken);

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: {exclude: ['updatedAt']},
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            if (request.user.fm_worker < 4) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'});
        }
    });

    fastify.get('/salary/generate', async function (request, reply) {
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const ProductHistory = fastify.sequelize.model('ProductHistory');
        const User = fastify.sequelize.model('User');

        const orders = await Order.findAll({
            where: {
                id: {
                    [Op.gte]: 1
                },
                status: 5,
            },
            attributes: ["id", "type", "price", "status", "customerId"],
            include: {
                model: OrderHistory,
                as: "history",
                attributes: ["id", "action_type", "userId"],
                include: {
                    model: User,
                    as: "user",
                    attributes: ["id", "nickname", "uuid", "discordId"],
                }
            }
        });

        const productRefills = await ProductHistory.findAll({
            where: {
                action_type: "refill_completed"
            },
            attributes: ["id", "action_type", "userId", "productId"],
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nickname", "uuid", "discordId"],
                }
            ]
        })

        const totalSalary = orders.reduce((acc, order) => acc + (order.price * 0.1), 0);

        const salaries = []
        for (const order of orders) {
            for (const history of order.history) {
                let salary;
                if (history.action_type === "collect_finished" ||
                    history.action_type === "deliver_finished") {
                    salary = salaries.find(s => s.id === history.user.id);
                    if (!salary) {
                        salary = {
                            id: history.user.id,
                            pays: {}
                        }
                        salaries.push(salary);
                    }
                }
                if (history.action_type === "collect_finished") {
                    const pay = totalSalary * 0.2;
                    if (!salary.pays.logic) {
                        salary.pays.logic = {
                            pay
                        }
                    } else {
                        salary.pays.logic.pay += pay;
                    }
                } else if (history.action_type === "deliver_finished") {
                    const pay = totalSalary * 0.2;
                    console.log(pay)
                    if (!salary.pays.deliver) {
                        salary.pays.deliver = {
                            pay
                        }
                    } else {
                        salary.pays.deliver.pay += pay;
                    }
                }
            }
        }

        const refillWorkers = []
        let sum = 0;
        for (const history of productRefills) {
            let refillWorker = refillWorkers.find(worker => worker.id !== history.user.id);
            if (!refillWorker) {
                refillWorker = {
                    id: history.user.id,
                    count: 1
                }
                sum++;
                refillWorkers.push(refillWorker);
            } else {
                refillWorker.count++;
                sum++;
            }
        }

        for (const refill of refillWorkers) {
            const pay = (refill.count / sum) * (totalSalary * 0.2);
            let salary = salaries.find(s => s.id === refill.id);
            if (!salary) {
                salary = {
                    id: refill.id,
                    pays: {}
                }
                salaries.push(salary);
            }
            if (!salary.pays.logic) {
                salary.pays.logic = {
                    pay
                }
            } else {
                salary.pays.logic.pay += pay;
            }
        }

        // На оплату уходит 10% цены заказа (оно же равно 10% каждого товара)
        // 2% - зп директоров (фикса, простое или ручное распределение)
        // 2% - зп секретарей (фикса, простое или ручное распределение)
        // 4% - зп логистов (2% от заказа, 2% на все пополнения)
        // 2% - зп курьеров + [оплата доставки до координат (Later..)]

        return reply.status(200).send({
            totalSalary,
            salaries
        });
    });
};
