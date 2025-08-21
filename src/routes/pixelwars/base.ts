import {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {PWPixel} from "../../models/PWPixel";
import {User} from "../../models/User";
import {WebSocket} from 'ws';

const route: FastifyPluginAsync = async function (fastify, opts) {
    // Инициализация Map для хранения активных WebSocket соединений
    if (!fastify.pixelwarsConnections) {
        fastify.decorate('pixelwarsConnections', new Map<number, WebSocket>());
    }

    fastify.get('/map', { preHandler: fastify.requireAuth }, async function (request, reply) {
        return {
            borderPixels: await PWPixel.findAll({
                where: {
                    type: "border"
                },
                raw: true
            }),
            statePixels: await PWPixel.findAll({
                where: {
                    type: "state"
                },
                raw: true
            })
        }
    });

    // WebSocket endpoint для игры PixelWars
    fastify.get('/ws', {websocket: true}, async (connection, req) => {
        try {
            // Проверка авторизации через cookies
            const accessToken = req.cookies.access_token;
            if (!accessToken) {
                connection.close(1008, 'Unauthorized');
                return;
            }

            // Верификация JWT токена
            const decoded = fastify.jwt.verify(accessToken) as { id: number };
            const user = await User.findOne({
                where: {id: decoded.id},
                attributes: {exclude: ['updatedAt']}
            });

            if (!user) {
                connection.close(1008, 'User not found');
                return;
            }

            // Проверка на существующее соединение для пользователя
            const existingConnection = fastify.pixelwarsConnections.get(user.id);
            if (existingConnection) {
                // Закрываем существующее соединение
                existingConnection.close(1000, 'New connection from same user');
            }

            // Сохраняем новое соединение
            fastify.pixelwarsConnections.set(user.id, connection);

            // Отправляем приветственное сообщение
            connection.send(JSON.stringify({
                type: 'connected',
                message: 'Connected to PixelWars game',
                userId: user.id,
                nickname: user.nickname || user.id.toString()
            }));

            // Обработка входящих сообщений
            connection.on('message', async (message: { toString(): string }) => {
                try {
                    const data = JSON.parse(message.toString()) as {
                        type: string;
                        x?: number;
                        y?: number;
                    };

                    // Обработка различных типов сообщений
                    switch (data.type) {
                        case 'pixel_place':
                            if (data.x && data.y) {
                                await handlePixelPlace(fastify, user, {x: data.x, y: data.y}, connection);
                            } else {
                                connection.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Missing required fields for pixel placement'
                                }));
                            }
                            break;
                        case 'ping':
                            connection.send(JSON.stringify({type: 'pong', timestamp: Date.now()}));
                            break;
                        default:
                            connection.send(JSON.stringify({
                                type: 'error',
                                message: 'Unknown message type'
                            }));
                    }
                } catch (error) {
                    connection.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            // Обработка закрытия соединения
            connection.on('close', () => {
                fastify.pixelwarsConnections.delete(user.id);
                console.log(`User ${user.id} disconnected from PixelWars`);
            });

            // Обработка ошибок соединения
            connection.on('error', (error: Error) => {
                console.error(`WebSocket error for user ${user.id}:`, error);
                fastify.pixelwarsConnections.delete(user.id);
            });

            console.log(`User ${user.id} connected to PixelWars`);

        } catch (error) {
            console.error('WebSocket connection error:', error);
            connection.close(1011, 'Internal server error');
        }
    });
};

async function handlePixelPlace(fastify: any, user: User, data: { x: number; y: number }, connection: WebSocket) {
    try {
        const pixel = await PWPixel.findOne({
            where: {
                x: data.x,
                y: data.y,
                type: "state"
            }
        })

        if (!pixel) {
            connection.send(JSON.stringify({
                type: 'error',
                message: "Невозможно изменить этот пиксель!"
            }));
            return;
        }

        if (pixel.owner && pixel.owner.id == user.id) {
            connection.send(JSON.stringify({
                type: 'error',
                message: "Этот пиксель уже захвачен вами!"
            }));
            return;
        }

        await pixel.update({
            ownerId: user.id
        })

        alert(fastify, {
            type: 'pixel_placed',
            x: data.x,
            y: data.y,
            ownerId: user.id
        });

    } catch (error) {
        connection.send(JSON.stringify({
            type: 'error',
            message: 'Failed to place pixel',
            details: error instanceof Error ? error.message : 'Unknown error'
        }));
    }
}

function alert(fastify: FastifyInstance, data: Object) {
    for (const webSocket of fastify.pixelwarsConnections.values()) {
        webSocket.send(JSON.stringify(data))
    }
}

export default route;
