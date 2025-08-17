import { FastifyPluginAsync } from 'fastify'
import { PWPixel } from "../../models/PWPixel";
import { User } from "../../models/User";
import { WebSocket } from 'ws';

const route: FastifyPluginAsync = async function (fastify, opts) {
    // Инициализация Map для хранения активных WebSocket соединений
    if (!fastify.pixelwarsConnections) {
        fastify.decorate('pixelwarsConnections', new Map<number, WebSocket>());
    }

    fastify.get('/map', async function (request, reply) {
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
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
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
                where: { id: decoded.id },
                attributes: { exclude: ['updatedAt'] }
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
                    const data = JSON.parse(message.toString()) as { type: string; x?: number; y?: number; color?: string };
                    
                    // Обработка различных типов сообщений
                    switch (data.type) {
                        case 'pixel_place':
                            // Проверяем наличие обязательных полей
                            if (data.x !== undefined && data.y !== undefined && data.color) {
                                // Логика размещения пикселя
                                await handlePixelPlace(fastify, user, { x: data.x, y: data.y, color: data.color }, connection);
                            } else {
                                connection.send(JSON.stringify({ 
                                    type: 'error', 
                                    message: 'Missing required fields for pixel placement' 
                                }));
                            }
                            break;
                        case 'ping':
                            // Pong ответ для проверки соединения
                            connection.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
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

// Функция для обработки размещения пикселя
async function handlePixelPlace(fastify: any, user: User, data: { x: number; y: number; color: string }, connection: WebSocket) {
    try {
        // Здесь можно добавить логику для размещения пикселя
        // Например, сохранение в базу данных, проверка правил игры и т.д.
        
        // Отправляем подтверждение
        connection.send(JSON.stringify({
            type: 'pixel_placed',
            x: data.x,
            y: data.y,
            color: data.color,
            timestamp: Date.now()
        }));

        // Уведомляем других игроков (можно реализовать broadcast)
        // broadcastToOtherPlayers(fastify, user.id, {
        //     type: 'pixel_updated',
        //     x: data.x,
        //     y: data.y,
        //     color: data.color,
        //     userId: user.id
        // });

            } catch (error) {
            connection.send(JSON.stringify({
                type: 'error',
                message: 'Failed to place pixel',
                details: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
}

export default route;
