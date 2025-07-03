const fp = require('fastify-plugin');
const crypto = require('crypto');

/**
 * Middleware to track online users by browser fingerprint.
 */
module.exports = fp(async (fastify) => {
    const userActivityMap = new Map();
    const THRESHOLD = 60 * 1000; // 60 секунд

    // Очистка старых пользователей каждые 30 секунд
    setInterval(() => {
        const now = Date.now();
        for (const [fingerprint, lastSeen] of userActivityMap.entries()) {
            if (now - lastSeen > THRESHOLD) {
                userActivityMap.delete(fingerprint);
            }
        }
    }, 30 * 1000);

    fastify.addHook('onRequest', async (request, reply) => {
        const headers = request.headers;
        const relevantHeaders = [
            headers['user-agent'] || '',
            headers['accept-language'] || '',
            headers['x-real-ip'] || headers['x-forwarded-for'] || '',
        ].join('|');

        const fingerprint = crypto.createHash('sha256').update(relevantHeaders).digest('hex');

        if (fingerprint) {
            userActivityMap.set(fingerprint, Date.now());
        }
    });

    function getOnlineUsers() {
        const now = Date.now();
        return [...userActivityMap.entries()]
            .filter(([_, ts]) => now - ts < THRESHOLD)
            .map(([fp]) => fp);
    }

    fastify.decorate('onlineUsers', getOnlineUsers);
});
